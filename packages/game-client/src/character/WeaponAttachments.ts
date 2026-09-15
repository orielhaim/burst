import type { Vec3 } from "../core/types";
import type { AnyWeaponDefinition } from "../weapons/WeaponDefinition";
import { add, lerp, rotate } from "./CharacterMath";
export type WorldWeaponPose = { position: Vec3; yaw: number; pitch: number };
export function weaponPoint(
	pose: WorldWeaponPose,
	local: readonly [number, number, number],
): Vec3 {
	const [x, y, z] = local;
	return add(
		pose.position,
		rotate(
			{
				x,
				y: y * Math.cos(pose.pitch) - z * Math.sin(pose.pitch),
				z: y * Math.sin(pose.pitch) + z * Math.cos(pose.pitch),
			},
			pose.yaw,
		),
	);
}
export function resolveWeaponAttachments(
	definition: AnyWeaponDefinition,
	eye: Vec3,
	yaw: number,
	pitch: number,
	ads: number,
	lowered: number,
	retraction: number,
	lateral: number,
	reload: { active: boolean; progress: number },
) {
	const model = definition.viewModel;
	const blend = ads * ads * (3 - 2 * ads);
	const hip = {
		x: model.hipPose.position[0],
		y: model.hipPose.position[1],
		z: model.hipPose.position[2],
	};
	const aim = {
		x: model.adsPose.position[0],
		y: model.adsPose.position[1],
		z: model.adsPose.position[2],
	};
	const offset = lerp(hip, aim, blend);
	offset.y -= lowered * definition.motion.switchDrop;
	offset.z += retraction;
	offset.x += lateral;
	const base = { position: eye, yaw, pitch };
	const pose = {
		position: weaponPoint(base, [offset.x, offset.y, offset.z]),
		yaw,
		pitch,
	};
	const primary = weaponPoint(pose, model.primaryGrip);
	const supportGrip = weaponPoint(pose, model.supportGrip);
	const loading = weaponPoint(pose, model.loadingPoint);
	const reach = reload.active ? Math.sin(Math.PI * reload.progress) : 0;
	const idleSupport = add(eye, rotate({ x: -0.28, y: -0.52, z: -0.12 }, yaw));
	return {
		pose,
		muzzle: weaponPoint(pose, model.muzzlePosition),
		primary,
		support:
			definition.category === "melee" && definition.handed === "one"
				? idleSupport
				: lerp(supportGrip, loading, reach),
	};
}
