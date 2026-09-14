import type RAPIER from "@dimforge/rapier3d-compat";
import type { Vec3 } from "../core/types";
import { CollisionGroups } from "../physics/CollisionGroups";
import type { CharacterPhysics } from "../physics/characterPhysics";

export type GroundContact = {
	normal: Vec3;
	distance: number;
	angle: number;
	colliderHandle: number;
};

export class GroundDetector {
	constructor(private readonly physics: CharacterPhysics) {}

	detect(
		body: RAPIER.RigidBody,
		position: Vec3,
		radius: number,
		halfHeight: number,
		probeDistance: number,
		minNormalY: number,
	): GroundContact | null {
		// Support ray from the bottom-hemisphere center straight down. A thin
		// ray only hits what is actually UNDERNEATH the body, so side faces
		// and sharp lip corners can never disguise themselves as walkable
		// floor (the failure behind edge-perching and stair jitter).
		const origin = {
			x: position.x,
			y: position.y - halfHeight,
			z: position.z,
		};
		const hit = this.physics.raycast(
			origin,
			{ x: 0, y: -1, z: 0 },
			radius + probeDistance,
			body,
			CollisionGroups.player,
		);
		if (!hit || hit.normal.y < minNormalY) return null;
		return {
			normal: hit.normal,
			distance: Math.max(0, hit.toi - radius),
			angle: Math.acos(Math.max(-1, Math.min(1, hit.normal.y))),
			colliderHandle: hit.colliderHandle,
		};
	}
}
