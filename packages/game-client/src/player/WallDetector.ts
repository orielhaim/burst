import type RAPIER from "@dimforge/rapier3d-compat";
import type { Vec3 } from "../core/types";
import type { CharacterPhysics } from "../physics/characterPhysics";

export type WallContact = {
	normal: Vec3;
	distance: number;
	colliderHandle: number;
};

const PROBE_DIRECTIONS = Array.from({ length: 8 }, (_, index) => {
	const angle = (index / 8) * Math.PI * 2;
	return { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
});

export class WallDetector {
	constructor(private readonly physics: CharacterPhysics) {}

	detect(
		body: RAPIER.RigidBody,
		position: Vec3,
		radius: number,
		halfHeight: number,
		probeDistance: number,
		maxNormalY: number,
	): WallContact | null {
		let closest: WallContact | null = null;
		for (const direction of PROBE_DIRECTIONS) {
			const hit = this.physics.castCapsule(
				position,
				direction,
				radius,
				halfHeight,
				probeDistance,
				body,
			);
			if (!hit || Math.abs(hit.normal.y) > maxNormalY) continue;
			if (!closest || hit.toi < closest.distance) {
				closest = {
					normal: normalizeHorizontal(hit.normal),
					distance: hit.toi,
					colliderHandle: hit.colliderHandle,
				};
			}
		}
		return closest;
	}
}

function normalizeHorizontal(value: Vec3): Vec3 {
	const length = Math.hypot(value.x, value.z);
	if (length < 1e-6) return { x: 0, y: 0, z: 0 };
	return { x: value.x / length, y: 0, z: value.z / length };
}
