import { WORLD_ENVIRONMENT } from "../sim/Environment";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Vec3 } from "../core/types";
import { CollisionGroups, groupsInteract } from "./CollisionGroups";
import type { CharacterPhysics, RayHit } from "./characterPhysics";

export type StaticBoxParams = {
	position: Vec3;
	/** Full size in world units (width, height, depth). */
	size: Vec3;
	/** Euler rotation in radians. */
	rotation?: Vec3;
};

let rapierReady: Promise<void> | null = null;

/** Initialize Rapier once (WASM). Safe to call multiple times. */
export async function initRapier(): Promise<void> {
	if (!rapierReady) {
		rapierReady = RAPIER.init();
	}
	await rapierReady;
}

/**
 * Thin wrapper around Rapier world.
 * Owns colliders and raycasts; rendering never touches raw Rapier types.
 *
 * Legacy manual world owner: kept for unit tests. The R3F runtime owns its
 * world via `<Physics>` and exposes the same `CharacterPhysics` seam through
 * `RapierBridge`, so gameplay code below never depends on this class.
 */
export class PhysicsWorld implements CharacterPhysics {
	readonly world: RAPIER.World;
	private readonly colliders: RAPIER.Collider[] = [];
	private readonly bodies: RAPIER.RigidBody[] = [];

	constructor(gravity: Vec3 = WORLD_ENVIRONMENT.gravity) {
		this.world = new RAPIER.World(gravity);
	}

	step(dt: number): void {
		this.world.timestep = dt;
		this.world.step();
	}

	syncColliderPositions(): void {
		this.world.propagateModifiedBodyPositionsToColliders();
	}

	getGravity(): Vec3 {
		const gravity = this.world.gravity;
		return { x: gravity.x, y: gravity.y, z: gravity.z };
	}

	createStaticBox(params: StaticBoxParams): RAPIER.Collider {
		const { position, size, rotation } = params;
		const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
			position.x,
			position.y,
			position.z,
		);
		if (rotation) {
			bodyDesc.setRotation(eulerToQuat(rotation));
		}
		const body = this.world.createRigidBody(bodyDesc);
		const colliderDesc = RAPIER.ColliderDesc.cuboid(
			size.x * 0.5,
			size.y * 0.5,
			size.z * 0.5,
		).setCollisionGroups(CollisionGroups.worldStatic);
		const collider = this.world.createCollider(colliderDesc, body);
		this.bodies.push(body);
		this.colliders.push(collider);
		return collider;
	}

	createDynamicBox(params: StaticBoxParams): {
		body: RAPIER.RigidBody;
		collider: RAPIER.Collider;
	} {
		const { position, size, rotation } = params;
		const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(position.x, position.y, position.z)
			.setCcdEnabled(true);
		if (rotation) bodyDesc.setRotation(eulerToQuat(rotation));
		const body = this.world.createRigidBody(bodyDesc);
		const collider = this.world.createCollider(
			RAPIER.ColliderDesc.cuboid(size.x * 0.5, size.y * 0.5, size.z * 0.5)
				.setCollisionGroups(CollisionGroups.worldDynamic)
				.setFriction(0.7),
			body,
		);
		this.bodies.push(body);
		this.colliders.push(collider);
		return { body, collider };
	}

	createPlayerBody(
		position: Vec3,
		radius: number,
		halfHeight: number,
		options?: {
			collisionSkinWidth: number;
			stepHeight: number;
			stepMinWidth: number;
			groundSnapDistance: number;
			maxWalkableSlope: number;
		},
	): {
		body: RAPIER.RigidBody;
		collider: RAPIER.Collider;
		controller: RAPIER.KinematicCharacterController;
	} {
		const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
			.setTranslation(position.x, position.y, position.z)
			.setCcdEnabled(true);
		const body = this.world.createRigidBody(bodyDesc);
		// Capsule: halfHeight is the cylindrical segment half-length (not including caps).
		const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius)
			.setFriction(0)
			.setRestitution(0)
			.setDensity(1)
			.setCollisionGroups(CollisionGroups.player);
		const collider = this.world.createCollider(colliderDesc, body);
		const controller = this.world.createCharacterController(
			options?.collisionSkinWidth ?? 0.015,
		);
		controller.setSlideEnabled(true);
		controller.enableAutostep(
			options?.stepHeight ?? 0.28,
			options?.stepMinWidth ?? radius * 0.65,
			false,
		);
		controller.enableSnapToGround(options?.groundSnapDistance ?? 0.12);
		controller.setMaxSlopeClimbAngle(
			options?.maxWalkableSlope ?? Math.PI * 0.28,
		);
		controller.setMinSlopeSlideAngle(
			options?.maxWalkableSlope ?? Math.PI * 0.3,
		);
		controller.setApplyImpulsesToDynamicBodies(false);
		this.bodies.push(body);
		this.colliders.push(collider);
		return { body, collider, controller };
	}

	resolveCharacterMovement(
		controller: RAPIER.KinematicCharacterController,
		collider: RAPIER.Collider,
		desired: Vec3,
	): {
		movement: Vec3;
		grounded: boolean;
		collisionNormals: Vec3[];
	} {
		this.syncColliderPositions();
		controller.computeColliderMovement(
			collider,
			desired,
			undefined,
			CollisionGroups.player,
		);
		const movement = controller.computedMovement();
		const collisionNormals: Vec3[] = [];
		for (
			let index = 0;
			index < controller.numComputedCollisions();
			index += 1
		) {
			const collision = controller.computedCollision(index);
			if (collision) collisionNormals.push(normalize(collision.normal1));
		}
		return {
			movement: { x: movement.x, y: movement.y, z: movement.z },
			grounded: controller.computedGrounded(),
			collisionNormals,
		};
	}

	findValidCapsuleSpawn(
		desired: Vec3,
		radius: number,
		halfHeight: number,
		searchRadius = 4,
		excludeCollider?: RAPIER.Collider,
	): Vec3 | null {
		const clearanceEpsilon = 0.005;
		const candidates: Vec3[] = [{ ...desired }];
		for (
			let ring = radius * 2.25;
			ring <= searchRadius;
			ring += radius * 2.25
		) {
			for (let index = 0; index < 12; index += 1) {
				const angle = (index / 12) * Math.PI * 2;
				candidates.push({
					x: desired.x + Math.cos(angle) * ring,
					y: desired.y,
					z: desired.z + Math.sin(angle) * ring,
				});
			}
		}
		for (const candidate of candidates) {
			// Fresh shape per candidate: the compat bindings guard against
			// reusing an object that is still borrowed ("recursive use ...
			// unsafe aliasing"), so never share these across calls.
			const shape = new RAPIER.Capsule(
				Math.max(0, halfHeight - clearanceEpsilon),
				Math.max(clearanceEpsilon, radius - clearanceEpsilon),
			);
			const overlap = this.colliders.some(
				(collider) =>
					collider !== excludeCollider &&
					!collider.isSensor() &&
					groupsInteract(CollisionGroups.player, collider.collisionGroups()) &&
					collider.intersectsShape(
						shape,
						{ ...candidate },
						{ x: 0, y: 0, z: 0, w: 1 },
					),
			);
			if (!overlap) return candidate;
		}
		return null;
	}

	castSphere(
		origin: Vec3,
		direction: Vec3,
		radius: number,
		maxDistance: number,
		excludeBody?: RAPIER.RigidBody | null,
	): { normal: Vec3; toi: number; colliderHandle: number } | null {
		if (maxDistance <= 0) return null;
		const hit = this.world.castShape(
			origin,
			{ x: 0, y: 0, z: 0, w: 1 },
			normalize(direction),
			new RAPIER.Ball(radius),
			0,
			maxDistance,
			true,
			undefined,
			CollisionGroups.weaponQuery,
			undefined,
			excludeBody ?? undefined,
		);
		if (!hit) return null;
		return {
			normal: normalize(hit.normal1),
			toi: hit.time_of_impact,
			colliderHandle: hit.collider.handle,
		};
	}

	castCapsule(
		position: Vec3,
		direction: Vec3,
		radius: number,
		halfHeight: number,
		maxDistance: number,
		excludeBody: RAPIER.RigidBody,
		stopAtPenetration = true,
	): { normal: Vec3; toi: number; colliderHandle: number } | null {
		const hit = this.world.castShape(
			position,
			{ x: 0, y: 0, z: 0, w: 1 },
			normalize(direction),
			new RAPIER.Capsule(halfHeight, radius),
			0,
			maxDistance,
			stopAtPenetration,
			undefined,
			CollisionGroups.player,
			undefined,
			excludeBody,
		);
		if (!hit) return null;
		return {
			// normal1 points out of the cast capsule, away from the hit surface.
			normal: normalize(hit.normal1),
			toi: hit.time_of_impact,
			colliderHandle: hit.collider.handle,
		};
	}

	/**
	 * Cast a ray and return the first hit.
	 * Excludes the given rigid body (typically the local player).
	 */
	raycast(
		origin: Vec3,
		direction: Vec3,
		maxToi: number,
		excludeBody?: RAPIER.RigidBody | null,
		queryGroups = CollisionGroups.projectile,
	): RayHit | null {
		const dir = normalize(direction);
		const ray = new RAPIER.Ray(
			{ x: origin.x, y: origin.y, z: origin.z },
			{ x: dir.x, y: dir.y, z: dir.z },
		);
		const hit = this.world.castRayAndGetNormal(
			ray,
			maxToi,
			true,
			undefined,
			queryGroups,
			undefined,
			excludeBody ?? undefined,
		);
		if (!hit) return null;
		const toi = hit.timeOfImpact;
		const point = {
			x: origin.x + dir.x * toi,
			y: origin.y + dir.y * toi,
			z: origin.z + dir.z * toi,
		};
		const normal = {
			x: hit.normal.x,
			y: hit.normal.y,
			z: hit.normal.z,
		};
		return { point, normal, toi, colliderHandle: hit.collider.handle };
	}

	dispose(): void {
		for (const body of this.bodies) {
			this.world.removeRigidBody(body);
		}
		this.bodies.length = 0;
		this.colliders.length = 0;
		this.world.free();
	}

	setCapsuleShape(
		collider: RAPIER.Collider,
		halfHeight: number,
		radius: number,
	): void {
		collider.setShape(new RAPIER.Capsule(halfHeight, radius));
	}
}

function normalize(v: Vec3): Vec3 {
	const len = Math.hypot(v.x, v.y, v.z);
	if (len < 1e-8) return { x: 0, y: 0, z: -1 };
	return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** XYZ Euler (radians) → quaternion for Rapier setRotation. */
function eulerToQuat(e: Vec3): { x: number; y: number; z: number; w: number } {
	const c1 = Math.cos(e.x / 2);
	const s1 = Math.sin(e.x / 2);
	const c2 = Math.cos(e.y / 2);
	const s2 = Math.sin(e.y / 2);
	const c3 = Math.cos(e.z / 2);
	const s3 = Math.sin(e.z / 2);
	return {
		x: s1 * c2 * c3 + c1 * s2 * s3,
		y: c1 * s2 * c3 - s1 * c2 * s3,
		z: c1 * c2 * s3 + s1 * s2 * c3,
		w: c1 * c2 * c3 - s1 * s2 * s3,
	};
}
