import { expect, test } from "bun:test";
import {
	ProceduralCharacter,
	type CharacterInput,
} from "./ProceduralCharacter";
import { createMovementState } from "../player/MovementState";
import { length, sub } from "./CharacterMath";
const ground = (p: { x: number; y: number; z: number }) => ({
	position: { x: p.x, y: 0.045, z: p.z },
	normal: { x: 0, y: 1, z: 0 },
});
function input(): CharacterInput {
	return {
		feet: { x: 0, y: 0, z: 0 },
		motion: { ...createMovementState(), grounded: true },
		aimYaw: 0,
		aimPitch: 0,
		ads: 0,
		hands: {
			primary: { x: 0.2, y: 1.2, z: -0.3 },
			support: { x: 0.1, y: 1.2, z: -0.6 },
		},
	};
}
test("flight spreads the hands and returns the same rig to weapon grips after landing", () => {
	const rig = new ProceduralCharacter();
	const state = input();
	state.skydiving = true;
	state.motion.grounded = false;
	state.motion.velocity.y = -8;
	for (let i = 0; i < 60; i++) rig.update(1 / 60, state, () => null);
	expect(rig.pose.hands[0].x).toBeLessThan(-0.4);
	expect(rig.pose.hands[1].x).toBeGreaterThan(0.4);
	expect(rig.pose.feet.every((foot) => !foot.planted)).toBe(true);
	state.skydiving = false;
	state.motion.grounded = true;
	state.motion.velocity.y = 0;
	for (let i = 0; i < 120; i++) rig.update(1 / 60, state, ground);
	expect(length(sub(rig.pose.hands[1], state.hands.primary))).toBeLessThan(0.001);
});
test("planted feet remain world-locked while independent steps recover direction changes", () => {
	const rig = new ProceduralCharacter();
	const state = input();
	rig.update(1 / 60, state, ground);
	const directions = [
		{ x: 0, z: -1 },
		{ x: -1, z: 0 },
		{ x: 0, z: 1 },
		{ x: 1, z: -1 },
		{ x: -1, z: 1 },
	];
	for (const direction of directions)
		for (let i = 0; i < 30; i++) {
			const before = rig.pose.feet.map((f) => ({
				position: { ...f.position },
				planted: f.planted,
			}));
			state.motion.velocity = { x: direction.x * 6, y: 0, z: direction.z * 6 };
			state.motion.horizontalSpeed = Math.hypot(
				state.motion.velocity.x,
				state.motion.velocity.z,
			);
			state.feet.x += state.motion.velocity.x / 60;
			state.feet.z += state.motion.velocity.z / 60;
			rig.update(1 / 60, state, ground);
			for (let f = 0; f < 2; f++)
				if (before[f]!.planted && rig.pose.feet[f]!.planted)
					expect(rig.pose.feet[f]!.position).toEqual(before[f]!.position);
			expect(
				length(sub(rig.pose.feet[0].position, rig.pose.feet[1].position)),
			).toBeGreaterThanOrEqual(rig.config.minFootSeparation - 0.001);
			if (state.motion.horizontalSpeed < 4.5)
				expect(
					rig.pose.feet.filter((f) => !f.planted).length,
				).toBeLessThanOrEqual(1);
		}
});
test("crouch lowers hips, slide extends feet, airborne feet unplant and landing recovers", () => {
	const rig = new ProceduralCharacter();
	const state = input();
	rig.update(1 / 60, state, ground);
	const standing = rig.pose.hips.y;
	state.motion.crouched = true;
	for (let i = 0; i < 30; i++) rig.update(1 / 60, state, ground);
	expect(rig.pose.hips.y).toBeLessThan(standing - 0.2);
	state.motion.sliding = true;
	state.motion.velocity.z = -8;
	state.motion.horizontalSpeed = 8;
	for (let i = 0; i < 30; i++) rig.update(1 / 60, state, ground);
	expect(rig.pose.feet[0].position.z).toBeLessThan(-0.5);
	state.motion.sliding = false;
	state.motion.grounded = false;
	state.motion.velocity.y = 6;
	rig.update(1 / 60, state, ground);
	expect(rig.pose.feet.every((f) => !f.planted)).toBe(true);
	state.motion.grounded = true;
	state.motion.velocity.y = 0;
	for (let i = 0; i < 60; i++) rig.update(1 / 60, state, ground);
	expect(rig.pose.feet.some((f) => f.planted)).toBe(true);
});
test("feet use terrain normals and arms follow changed grip targets exactly", () => {
	const rig = new ProceduralCharacter();
	const state = input();
	rig.update(1 / 60, state, (p) => ({
		position: { x: p.x, y: p.x * 0.2, z: p.z },
		normal: { x: -0.196, y: 0.981, z: 0 },
	}));
	expect(rig.pose.feet[0].position.y).not.toBe(rig.pose.feet[1].position.y);
	expect(rig.pose.feet[0].normal.x).toBeLessThan(0);
	state.hands.support = { x: -0.2, y: 1.1, z: -0.1 };
	rig.solveHands(state.hands);
	expect(rig.pose.hands[0]).toEqual(state.hands.support);
	expect(rig.pose.hands[1]).toEqual(state.hands.primary);
});

test("sprint stride keeps feet within anatomical reach", () => {
	const rig = new ProceduralCharacter();
	const state = input();
	rig.update(1 / 60, state, ground);
	state.motion.sprinting = true;
	state.motion.horizontalSpeed = 9.1;
	state.motion.velocity.z = -9.1;
	for (let i = 0; i < 120; i++) {
		state.feet.z -= 9.1 / 60;
		rig.update(1 / 60, state, ground);
		for (let f = 0; f < 2; f++) {
			expect(
				length(sub(rig.pose.hipJoints[f]!, rig.pose.feet[f]!.position)),
			).toBeLessThanOrEqual(rig.config.thigh + rig.config.shin);
			expect(
				length(sub(rig.pose.hipJoints[f]!, rig.pose.knees[f]!)),
			).toBeCloseTo(rig.config.thigh, 6);
			expect(
				length(sub(rig.pose.knees[f]!, rig.pose.feet[f]!.position)),
			).toBeCloseTo(rig.config.shin, 6);
		}
	}
});

test("a hit displaces the torso then recovers without moving the hips", () => {
	const rig = new ProceduralCharacter();
	const state = input();
	rig.update(1 / 60, state, ground);
	const hips = { ...rig.pose.hips };
	const chest = { ...rig.pose.chest };
	rig.applyHit({ x: 1, y: 0, z: 0 }, 80);
	rig.update(1 / 60, state, ground);
	expect(rig.pose.hips).toEqual(hips);
	expect(rig.pose.chest.x).toBeGreaterThan(chest.x + 0.05);
	for (let i = 0; i < 90; i++) rig.update(1 / 60, state, ground);
	expect(Math.abs(rig.pose.chest.x - chest.x)).toBeLessThan(0.02);
});

test("lateral gait crosses in front of the trailing foot without overlapping", () => {
	const rig = new ProceduralCharacter();
	const state = input();
	rig.update(1 / 60, state, ground);
	state.motion.velocity.x = 6.2;
	state.motion.horizontalSpeed = 6.2;
	let maxOffset = 0;
	let crossed = false;
	for (let i = 0; i < 180; i++) {
		state.feet.x += 6.2 / 60;
		rig.update(1 / 60, state, ground);
		if (i > 60)
			maxOffset = Math.max(maxOffset, Math.abs(rig.pose.hips.x - state.feet.x));
		const [left, right] = rig.pose.feet;
		expect(
			length(sub(left!.position, right!.position)),
		).toBeGreaterThanOrEqual(rig.config.minFootSeparation - 0.001);
		if (Math.abs(left!.position.z - right!.position.z) > 0.08)
			crossed = true;
	}
	expect(maxOffset).toBeLessThan(0.005);
	expect(crossed).toBe(true);
});

test("walking steps land ahead of the hips and never lift both feet", () => {
	const rig = new ProceduralCharacter();
	const state = input();
	rig.update(1 / 60, state, ground);
	state.motion.velocity.z = -6.2;
	state.motion.horizontalSpeed = 6.2;
	let ahead = 0;
	for (let i = 0; i < 180; i++) {
		state.feet.z -= 6.2 / 60;
		rig.update(1 / 60, state, ground);
		expect(rig.pose.feet.filter((f) => !f.planted).length).toBeLessThanOrEqual(
			2,
		);
		for (const foot of rig.pose.feet) {
			ahead = Math.min(ahead, foot.position.z - state.feet.z);
			expect(
				length(sub(foot.position, rig.pose.hipJoints[rig.pose.feet.indexOf(foot)]!)),
			).toBeLessThanOrEqual(rig.config.thigh + rig.config.shin);
		}
	}
	expect(ahead).toBeLessThan(-0.12);
});
