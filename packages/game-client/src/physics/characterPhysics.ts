import type RAPIER from "@dimforge/rapier3d-compat";
import type { Vec3 } from "../core/types";

/**
 * Framework-independent physics seam for character/weapon simulation.
 *
 * The old manual `PhysicsWorld` (raw Rapier world ownership) implements this
 * interface for unit tests. The R3F runtime provides `RapierBridge`, backed by
 * the `@react-three/rapier` world, so simulation code never owns a world.
 *
 * Simulation modules (PlayerController, PlayerMotor, detectors, hitscan,
 * obstruction) depend only on this interface — never on a concrete world.
 */
export type CharacterBody = {
	body: RAPIER.RigidBody;
	collider: RAPIER.Collider;
	controller: RAPIER.KinematicCharacterController;
};

export type ShapeHit = {
	normal: Vec3;
	toi: number;
	colliderHandle: number;
};

export type RayHit = {
	point: Vec3;
	normal: Vec3;
	toi: number;
	colliderHandle: number;
};

export type PlayerBodyOptions = {
	collisionSkinWidth: number;
	stepHeight: number;
	stepMinWidth: number;
	groundSnapDistance: number;
	maxWalkableSlope: number;
};

export interface CharacterPhysics {
	getGravity(): Vec3;
	syncColliderPositions(): void;
	findValidCapsuleSpawn(
		desired: Vec3,
		radius: number,
		halfHeight: number,
		searchRadius?: number,
		excludeCollider?: RAPIER.Collider,
	): Vec3 | null;
	createPlayerBody(
		position: Vec3,
		radius: number,
		halfHeight: number,
		options?: PlayerBodyOptions,
	): CharacterBody;
	/**
	 * Resize a capsule collider in place (crouch/stand). Must go through the
	 * physics owner so the shape is created by the same Rapier module instance
	 * as the world — never `new RAPIER.Capsule` from another copy.
	 */
	setCapsuleShape(
		collider: RAPIER.Collider,
		halfHeight: number,
		radius: number,
	): void;
	resolveCharacterMovement(
		controller: RAPIER.KinematicCharacterController,
		collider: RAPIER.Collider,
		desired: Vec3,
	): {
		movement: Vec3;
		grounded: boolean;
		collisionNormals: Vec3[];
	};
	castSphere(
		origin: Vec3,
		direction: Vec3,
		radius: number,
		maxDistance: number,
		excludeBody?: RAPIER.RigidBody | null,
	): ShapeHit | null;
	castCapsule(
		position: Vec3,
		direction: Vec3,
		radius: number,
		halfHeight: number,
		maxDistance: number,
		excludeBody: RAPIER.RigidBody,
		stopAtPenetration?: boolean,
	): ShapeHit | null;
	raycast(
		origin: Vec3,
		direction: Vec3,
		maxToi: number,
		excludeBody?: RAPIER.RigidBody | null,
		queryGroups?: number,
	): RayHit | null;
}
