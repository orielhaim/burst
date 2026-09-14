import type RAPIER from "@dimforge/rapier3d-compat";
import type { CharacterPhysics } from "./characterPhysics";
import type { Vec3 } from "../core/types";
import { CollisionGroups } from "./CollisionGroups";

/** Distance below the player feet used to detect ground contact. */
export const GROUND_PROBE_DEPTH = 0.12;

/**
 * Probe downward from the player's feet for ground.
 * Uses a short ray so standing on flat geometry is stable.
 */
export function isGrounded(
	physics: CharacterPhysics,
	feet: Vec3,
	radius: number,
	excludeBody: RAPIER.RigidBody,
): boolean {
	const origin = { x: feet.x, y: feet.y + 0.05, z: feet.z };
	const hit = physics.raycast(
		origin,
		{ x: 0, y: -1, z: 0 },
		radius + GROUND_PROBE_DEPTH,
		excludeBody,
		CollisionGroups.player,
	);
	if (!hit) return false;
	// Ignore steep walls; only treat mostly-upward normals as ground.
	return hit.normal.y > 0.45;
}

/** Spread a direction by a small random cone (for weapon inaccuracy). */
export function applySpread(
	direction: Vec3,
	spreadRadians: number,
	rng: () => number = Math.random,
): Vec3 {
	if (spreadRadians <= 0) {
		return normalize(direction);
	}

	// Build an orthonormal basis around the shot direction.
	const forward = normalize(direction);
	const up =
		Math.abs(forward.y) > 0.99
			? { x: 1, y: 0, z: 0 }
			: { x: 0, y: 1, z: 0 };
	const right = normalize(cross(forward, up));
	const realUp = cross(right, forward);

	const angle = rng() * Math.PI * 2;
	const radius = Math.tan(spreadRadians) * Math.sqrt(rng());
	const ox = Math.cos(angle) * radius;
	const oy = Math.sin(angle) * radius;

	return normalize({
		x: forward.x + right.x * ox + realUp.x * oy,
		y: forward.y + right.y * ox + realUp.y * oy,
		z: forward.z + right.z * ox + realUp.z * oy,
	});
}

function cross(a: Vec3, b: Vec3): Vec3 {
	return {
		x: a.y * b.z - a.z * b.y,
		y: a.z * b.x - a.x * b.z,
		z: a.x * b.y - a.y * b.x,
	};
}

function normalize(v: Vec3): Vec3 {
	const len = Math.hypot(v.x, v.y, v.z);
	if (len < 1e-8) return { x: 0, y: 0, z: -1 };
	return { x: v.x / len, y: v.y / len, z: v.z / len };
}
