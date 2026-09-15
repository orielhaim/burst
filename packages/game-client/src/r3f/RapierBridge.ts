import type RAPIER from "@dimforge/rapier3d-compat";
import type { Vec3 } from "../core/types";
import { CollisionGroups, groupsInteract } from "../physics/CollisionGroups";
import type {
	CharacterBody,
	CharacterPhysics,
	PlayerBodyOptions,
	RayHit,
	ShapeHit,
} from "../physics/characterPhysics";
import { devLog } from "../runtime/log";

type RapierModule = typeof RAPIER;

/**
 * `CharacterPhysics` backed by the `@react-three/rapier`-owned world.
 * The R3F `<Physics>` component owns the world, steps it, and creates map
 * colliders declaratively; this bridge gives the framework-independent
 * simulation (player motor, detectors, ballistics, obstruction) query access
 * plus kinematic player-body management (character-controller oriented —
 * never a generic dynamic body).
 */
export class RapierBridge implements CharacterPhysics {
	private readonly controllers: RAPIER.KinematicCharacterController[] = [];
	private readonly playerBodies: CharacterBody[] = [];

	constructor(
		private readonly world: RAPIER.World,
		private readonly rapier: RapierModule,
	) {}

	/** Human-readable module identity for diagnosing multi-instance issues. */
	describe(): string {
		return RapierBridge.describeModule(this.rapier);
	}

	static describeModule(rapier: RapierModule): string {
		let version = "unknown";
		try {
			const withVersion = rapier as unknown as { version?: () => string };
			version = withVersion.version?.() ?? "unknown";
		} catch {
			version = "unavailable";
		}
		return `rapier3d-compat ${version}`;
	}

	get native(): RAPIER.World {
		return this.world;
	}

	getGravity(): Vec3 {
		const gravity = this.world.gravity;
		return { x: gravity.x, y: gravity.y, z: gravity.z };
	}

	syncColliderPositions(): void {
		this.world.propagateModifiedBodyPositionsToColliders();
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
		// Query the live R3F world (declarative colliders included).
		const all = this.world.colliders.getAll();
		devLog(
			`spawn search: ${all.length} colliders, ${candidates.length} candidates`,
		);
		for (const [candidateIndex, candidate] of candidates.entries()) {
			// Fresh shape + rotation per candidate: the compat bindings guard
			// against reusing an object that is still borrowed ("recursive use
			// ... unsafe aliasing"), so never share these across calls.
			const shape = new this.rapier.Capsule(
				Math.max(0, halfHeight - clearanceEpsilon),
				Math.max(clearanceEpsilon, radius - clearanceEpsilon),
			);
			let overlap = false;
			let overlapCount = 0;
			for (const collider of all) {
				if (collider === excludeCollider || collider.isSensor()) continue;
				if (!groupsInteract(CollisionGroups.player, collider.collisionGroups()))
					continue;
				try {
					if (
						collider.intersectsShape(
							shape,
							{ ...candidate },
							{ x: 0, y: 0, z: 0, w: 1 },
						)
					) {
						overlap = true;
						overlapCount += 1;
						if (candidateIndex === 0 && overlapCount <= 3) {
							let info: unknown = null;
							try {
								const t = collider.translation();
								const l = collider.translationWrtParent();
								const parent = collider.parent();
								const pt = parent ? parent.translation() : null;
								info = {
									world: t,
									local: l,
									body: pt,
									shape: collider.shapeType(),
								};
							} catch {
								info = "unavailable";
							}
							devLog(
								`spawn search: candidate 0 blocked by ${JSON.stringify(info)}`,
							);
						} else {
							break;
						}
					}
				} catch (error) {
					// A stale (removed) collider handle throws instead of
					// returning false. Skip it — but log, since it means
					// disposal missed something.
					devLog(
						`spawn search: stale collider at candidate ${candidateIndex}:`,
						error,
					);
				}
			}
			if (!overlap) {
				devLog(`spawn search: candidate ${candidateIndex} clear`);
				return candidate;
			}
		}
		if (typeof console !== "undefined") {
			const bodies: unknown[] = [];
			try {
				this.world.forEachRigidBody((body) => {
					if (bodies.length < 8) {
						try {
							bodies.push(body.translation());
						} catch {
							bodies.push("unavailable");
						}
					}
				});
			} catch (error) {
				devLog("spawn search: body dump failed:", error);
			}
			devLog(`spawn search: FAILED, first bodies at ${JSON.stringify(bodies)}`);
			console.error(
				"[burst] findValidCapsuleSpawn failed; colliders in world:",
				all.map((collider) => {
					let translation: unknown = null;
					try {
						translation = collider.translation();
					} catch {
						translation = "unavailable";
					}
					return { translation, groups: collider.collisionGroups() };
				}),
			);
		}
		return null;
	}

	createPlayerBody(
		position: Vec3,
		radius: number,
		halfHeight: number,
		options?: PlayerBodyOptions,
	): CharacterBody {
		const bodyDesc = this.rapier.RigidBodyDesc.kinematicPositionBased()
			.setTranslation(position.x, position.y, position.z)
			.setCcdEnabled(true);
		const body = this.world.createRigidBody(bodyDesc);
		const colliderDesc = this.rapier.ColliderDesc.capsule(halfHeight, radius)
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
		this.controllers.push(controller);
		const created = { body, collider, controller };
		this.playerBodies.push(created);
		return created;
	}

	setCapsuleShape(
		collider: RAPIER.Collider,
		halfHeight: number,
		radius: number,
	): void {
		collider.setShape(new this.rapier.Capsule(halfHeight, radius));
	}

	/** Remove every player body created through this bridge. */
	disposePlayerBodies(): void {
		devLog(
			`disposePlayerBodies: ${this.playerBodies.length} bodies, world colliders: ${this.world.colliders.getAll().length}`,
		);
		for (const created of this.playerBodies.splice(0)) {
			this.removePlayerBody(created);
		}
		devLog(
			`disposePlayerBodies: done, world colliders: ${this.world.colliders.getAll().length}`,
		);
	}

	/** Remove a player body created through this bridge. */
	removePlayerBody(body: CharacterBody): void {
		const index = this.controllers.indexOf(body.controller);
		if (index >= 0) this.controllers.splice(index, 1);
		const bodyIndex = this.playerBodies.indexOf(body);
		if (bodyIndex >= 0) this.playerBodies.splice(bodyIndex, 1);
		// Teardown must never throw: an unmount-time throw would abort React's
		// cleanup pass and poison the subsequent world.free(). Log and continue.
		// Controllers are owned by the world: remove through the world, never
		// `.free()` directly, or a later `world.free()` throws a Rust borrow
		// error on the dangling entry.
		try {
			this.world.removeCharacterController(body.controller);
		} catch (error) {
			console.debug("[burst] removeCharacterController failed:", error);
		}
		try {
			// Removing the body also removes its attached colliders.
			this.world.removeRigidBody(body.body);
		} catch (error) {
			console.debug("[burst] removeRigidBody failed:", error);
		}
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

	castSphere(
		origin: Vec3,
		direction: Vec3,
		radius: number,
		maxDistance: number,
		excludeBody?: RAPIER.RigidBody | null,
	): ShapeHit | null {
		if (maxDistance <= 0) return null;
		const hit = this.world.castShape(
			origin,
			{ x: 0, y: 0, z: 0, w: 1 },
			normalize(direction),
			new this.rapier.Ball(radius),
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
	): ShapeHit | null {
		const hit = this.world.castShape(
			position,
			{ x: 0, y: 0, z: 0, w: 1 },
			normalize(direction),
			new this.rapier.Capsule(halfHeight, radius),
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
			normal: normalize(hit.normal1),
			toi: hit.time_of_impact,
			colliderHandle: hit.collider.handle,
		};
	}

	raycast(
		origin: Vec3,
		direction: Vec3,
		maxToi: number,
		excludeBody?: RAPIER.RigidBody | null,
		queryGroups = CollisionGroups.projectile,
	): RayHit | null {
		const dir = normalize(direction);
		const ray = new this.rapier.Ray(
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
		return {
			point: {
				x: origin.x + dir.x * toi,
				y: origin.y + dir.y * toi,
				z: origin.z + dir.z * toi,
			},
			normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
			toi,
			colliderHandle: hit.collider.handle,
		};
	}
}

function normalize(v: Vec3): Vec3 {
	const len = Math.hypot(v.x, v.y, v.z);
	if (len < 1e-8) return { x: 0, y: 0, z: -1 };
	return { x: v.x / len, y: v.y / len, z: v.z / len };
}
