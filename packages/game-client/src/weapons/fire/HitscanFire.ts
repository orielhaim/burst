import type RAPIER from "@dimforge/rapier3d-compat";
import type { CharacterPhysics } from "../../physics/characterPhysics";
import type { FireResolution, FireWeaponCommand } from "../WeaponDefinition";
import type { Vec3 } from "../../core/types";

export function resolveHitscan(
	command: FireWeaponCommand,
	damage: number,
	physics: CharacterPhysics,
	excludeBody: RAPIER.RigidBody,
	resolvedMuzzle?: Vec3,
): FireResolution {
	if (command.projectile.type !== "hitscan") {
		throw new Error("resolveHitscan requires a hitscan command");
	}
	const cameraHit = physics.raycast(
		command.origin,
		command.direction,
		command.projectile.range,
		excludeBody,
	);
	const aimPoint = cameraHit?.point ?? {
		x: command.origin.x + command.direction.x * command.projectile.range,
		y: command.origin.y + command.direction.y * command.projectile.range,
		z: command.origin.z + command.direction.z * command.projectile.range,
	};
	const muzzle = resolvedMuzzle ?? command.origin;
	const muzzleToTarget = {
		x: aimPoint.x - muzzle.x,
		y: aimPoint.y - muzzle.y,
		z: aimPoint.z - muzzle.z,
	};
	const muzzleDistance = Math.hypot(
		muzzleToTarget.x,
		muzzleToTarget.y,
		muzzleToTarget.z,
	);
	const muzzleHit = physics.raycast(
		muzzle,
		muzzleToTarget,
		muzzleDistance,
		excludeBody,
	);
	const hit = muzzleHit ?? cameraHit;
	return {
		command,
		hit: hit
			? {
					point: hit.point,
					normal: hit.normal,
					distance: hit.toi,
					colliderHandle: hit.colliderHandle,
				}
			: null,
		damage: hit ? damage : 0,
	};
}
