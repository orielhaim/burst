import type { CharacterPose, HandTargets } from "./ProceduralCharacter";
import { lerp, solveLimb, rotate, add, scale } from "./CharacterMath";
import { CHARACTER_CONFIG } from "./ProceduralCharacter";
/** Render-only snapshot. Simulation and hit regions are never mutated by hand IK. */
export function characterRenderPose(
	previous: CharacterPose,
	current: CharacterPose,
	alpha: number,
	hands?: HandTargets,
	firstPerson = false,
): CharacterPose {
	const t = Math.max(0, Math.min(1, alpha));
	const pose = structuredClone(current);
	for (const key of ["hips", "chest", "head"] as const)
		pose[key] = lerp(previous[key], current[key], t);
	for (const key of [
		"knees",
		"hipJoints",
		"shoulders",
		"elbows",
		"hands",
	] as const)
		for (let i = 0; i < 2; i++)
			pose[key][i] = lerp(previous[key][i]!, current[key][i]!, t);
	for (let i = 0; i < 2; i++) {
		pose.feet[i]!.position = lerp(
			previous.feet[i]!.position,
			current.feet[i]!.position,
			t,
		);
		pose.feet[i]!.normal = lerp(
			previous.feet[i]!.normal,
			current.feet[i]!.normal,
			t,
		);
	}
	for (const key of ["bodyYaw", "aimYaw", "aimPitch"] as const)
		pose[key] =
			previous[key] +
			Math.atan2(
				Math.sin(current[key] - previous[key]),
				Math.cos(current[key] - previous[key]),
			) *
				t;
	if (firstPerson) {
		// Anatomical torso sits behind the eye; keep a continuous body instead
		// of hiding its connecting segments when the camera looks down.
		const back = rotate({ x: 0, y: 0, z: 1 }, pose.aimYaw);
		pose.hips = add(pose.hips, scale(back, 0.12));
		pose.chest = add(pose.chest, scale(back, 0.22));
		for (let i = 0; i < 2; i++) {
			pose.hipJoints[i] = add(pose.hipJoints[i]!, scale(back, 0.12));
			pose.shoulders[i] = add(pose.shoulders[i]!, scale(back, 0.22));
			pose.knees[i] = solveLimb(pose.hipJoints[i]!, pose.feet[i]!.position, rotate({ x: i === 0 ? -0.1 : 0.1, y: 0, z: -1 }, pose.bodyYaw), CHARACTER_CONFIG.thigh, CHARACTER_CONFIG.shin);
		}
	}
	if (hands) {
		// Exact view-model grip targets — hands never drift off the weapon.
		pose.hands = [{ ...hands.support }, { ...hands.primary }];
		for (let i = 0; i < 2; i++) {
			// Outward-down poles: natural elbow bend for a held weapon/knife.
			// Fall back if the arm vector aligns with the pole (IK singularity).
			let pole = rotate({ x: i === 0 ? -1 : 1, y: -0.85, z: 0.2 }, pose.aimYaw);
			const armX = pose.hands[i]!.x - pose.shoulders[i]!.x;
			const armY = pose.hands[i]!.y - pose.shoulders[i]!.y;
			const armZ = pose.hands[i]!.z - pose.shoulders[i]!.z;
			const armLen = Math.hypot(armX, armY, armZ);
			if (armLen > 1e-5) {
				const align =
					(pole.x * armX + pole.y * armY + pole.z * armZ) / armLen;
				if (Math.abs(align) > 0.92)
					pole = rotate(
						{ x: i === 0 ? -0.55 : 0.55, y: -0.15, z: 0.85 },
						pose.aimYaw,
					);
			}
			pose.elbows[i] = solveLimb(
				pose.shoulders[i]!,
				pose.hands[i]!,
				pole,
				CHARACTER_CONFIG.upperArm,
				CHARACTER_CONFIG.forearm,
			);
		}
	}
	return pose;
}
