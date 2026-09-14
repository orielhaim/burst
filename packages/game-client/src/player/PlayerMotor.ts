import type RAPIER from "@dimforge/rapier3d-compat";
import type { Vec3 } from "../core/types";
import type { CharacterPhysics } from "../physics/characterPhysics";
import type { MovementConfig } from "./MovementConfig";

export class PlayerMotor {
	readonly body: RAPIER.RigidBody;
	readonly collider: RAPIER.Collider;
	private readonly controller: RAPIER.KinematicCharacterController;
	private halfHeight: number;
	private velocity: Vec3 = { x: 0, y: 0, z: 0 };

	constructor(
		private readonly physics: CharacterPhysics,
		spawn: Vec3,
		readonly radius: number,
		standingHalfHeight: number,
		config: MovementConfig,
	) {
		const validSpawn = physics.findValidCapsuleSpawn(
			spawn,
			radius,
			standingHalfHeight,
		);
		if (!validSpawn) throw new Error("No collision-free player spawn is available");
		const created = physics.createPlayerBody(
			validSpawn,
			radius,
			standingHalfHeight,
			{
				collisionSkinWidth: config.collisionSkinWidth,
				stepHeight: config.stepHeight,
				stepMinWidth: config.stepMinWidth,
				groundSnapDistance: config.groundProbeDistance,
				maxWalkableSlope: config.maxWalkableSlope,
			},
		);
		this.body = created.body;
		this.collider = created.collider;
		this.controller = created.controller;
		this.halfHeight = standingHalfHeight;
	}

	/**
	 * Attach to a body/collider triple owned elsewhere — e.g. a declarative
	 * `<RigidBody>` + `<CapsuleCollider>` in the R3F scene. Movement math is
	 * identical; only body ownership differs.
	 */
	static attach(
		physics: CharacterPhysics,
		existing: {
			body: RAPIER.RigidBody;
			collider: RAPIER.Collider;
			controller: RAPIER.KinematicCharacterController;
		},
		radius: number,
		standingHalfHeight: number,
	): PlayerMotor {
		const motor = Object.create(PlayerMotor.prototype) as PlayerMotor;
		const writable = motor as unknown as {
			physics: CharacterPhysics;
			body: RAPIER.RigidBody;
			collider: RAPIER.Collider;
			controller: RAPIER.KinematicCharacterController;
			radius: number;
			halfHeight: number;
			velocity: Vec3;
		};
		writable.physics = physics;
		writable.body = existing.body;
		writable.collider = existing.collider;
		writable.controller = existing.controller;
		writable.radius = radius;
		writable.halfHeight = standingHalfHeight;
		writable.velocity = { x: 0, y: 0, z: 0 };
		return motor;
	}

	getHalfHeight(): number {
		return this.halfHeight;
	}

	getPosition(): Vec3 {
		const value = this.body.translation();
		return { x: value.x, y: value.y, z: value.z };
	}

	getFeetPosition(): Vec3 {
		const position = this.getPosition();
		return {
			x: position.x,
			y: position.y - this.halfHeight - this.radius,
			z: position.z,
		};
	}

	getVelocity(): Vec3 {
		return { ...this.velocity };
	}

	getGravity(): Vec3 {
		return this.physics.getGravity();
	}

	setVelocity(velocity: Vec3): void {
		this.velocity = finiteOrZero(velocity);
	}

	move(velocity: Vec3, dt: number): Vec3 {
		const safeVelocity = finiteOrZero(velocity);
		const clampedDt = Math.max(0, Math.min(dt, 1 / 20));
		const desired = {
			x: safeVelocity.x * clampedDt,
			y: safeVelocity.y * clampedDt,
			z: safeVelocity.z * clampedDt,
		};
		const resolution = this.physics.resolveCharacterMovement(
			this.controller,
			this.collider,
			desired,
		);
		const movement = resolution.movement;
		const current = this.body.translation();
		this.body.setTranslation(
			{
				x: current.x + movement.x,
				y: current.y + movement.y,
				z: current.z + movement.z,
			},
			true,
		);
		this.physics.syncColliderPositions();
		this.velocity = clampedDt > 0
			? resolveVelocityAfterMovement(safeVelocity, desired, movement, resolution.collisionNormals)
			: { x: 0, y: 0, z: 0 };
		return this.getVelocity();
	}

	setCrouched(crouchingHalfHeight: number): void {
		if (this.halfHeight === crouchingHalfHeight) return;
		this.resizeKeepingFeet(crouchingHalfHeight);
	}

	tryStand(standingHalfHeight: number): boolean {
		if (this.halfHeight === standingHalfHeight) return true;
		const position = this.getPosition();
		const rise = standingHalfHeight - this.halfHeight;
		if (
			this.physics.castCapsule(
				position,
				{ x: 0, y: 1, z: 0 },
				this.radius,
				this.halfHeight,
				rise * 2,
				this.body,
				false,
			)
		) {
			return false;
		}
		this.resizeKeepingFeet(standingHalfHeight);
		return true;
	}

	teleport(position: Vec3): boolean {
		const valid = this.physics.findValidCapsuleSpawn(
			position,
			this.radius,
			this.halfHeight,
			4,
			this.collider,
		);
		if (!valid) return false;
		this.body.setTranslation(valid, true);
		this.velocity = { x: 0, y: 0, z: 0 };
		this.physics.syncColliderPositions();
		return true;
	}

	private resizeKeepingFeet(nextHalfHeight: number): void {
		const position = this.getPosition();
		const centerShift = nextHalfHeight - this.halfHeight;
		this.physics.setCapsuleShape(this.collider, nextHalfHeight, this.radius);
		this.body.setTranslation(
			{ x: position.x, y: position.y + centerShift, z: position.z },
			true,
		);
		this.halfHeight = nextHalfHeight;
	}
}

function resolveVelocityAfterMovement(
	requested: Vec3,
	desired: Vec3,
	movement: Vec3,
	collisionNormals: Vec3[],
): Vec3 {
	let velocity = { ...requested };
	const desiredHorizontal = Math.hypot(desired.x, desired.z);
	const movedHorizontal = Math.hypot(movement.x, movement.z);
	const successfulAutostep =
		desiredHorizontal > 1e-6 &&
		movedHorizontal >= desiredHorizontal * 0.7 &&
		movement.y > desired.y + 1e-4;
	if (!successfulAutostep) {
		for (const normal of collisionNormals) {
			if (Math.abs(normal.y) > 0.7) continue;
			const intoSurface = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
			if (intoSurface < 0) {
				velocity.x -= normal.x * intoSurface;
				velocity.y -= normal.y * intoSurface;
				velocity.z -= normal.z * intoSurface;
			}
		}
	}
	if (Math.abs(movement.y) < Math.abs(desired.y) * 0.25 && desired.y !== 0) velocity.y = 0;
	return finiteOrZero(velocity);
}

function finiteOrZero(value: Vec3): Vec3 {
	return Number.isFinite(value.x) &&
		Number.isFinite(value.y) &&
		Number.isFinite(value.z)
		? { ...value }
		: { x: 0, y: 0, z: 0 };
}
