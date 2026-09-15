import { expect, test } from "bun:test";
import { ProceduralCharacter } from "./ProceduralCharacter";
import { characterRenderPose } from "./CharacterPresentation";

test("body and camera translation stay synchronized between simulation ticks", () => {
	const rig = new ProceduralCharacter();
	const previous = structuredClone(rig.pose);
	const current = structuredClone(previous);
	current.hips.x = 0.1;
	for (const alpha of [0, 0.2, 0.5, 0.8, 1]) {
		const pose = characterRenderPose(previous, current, alpha);
		const interpolatedCameraX = 0.1 * alpha;
		expect(pose.hips.x - interpolatedCameraX).toBeCloseTo(0, 10);
	}
});

test("rendered weapon grips drive arms without changing simulation snapshots", () => {
	const current = new ProceduralCharacter().pose;
	const before = structuredClone(current);
	const hands = {
		primary: { x: 0.2, y: 1.2, z: -0.3 },
		support: { x: -0.1, y: 1.2, z: -0.5 },
	};
	const rendered = characterRenderPose(before, current, 0.5, hands);
	expect(rendered.hands).toEqual([hands.support, hands.primary]);
	expect(current).toEqual(before);
});

test("first-person torso stays behind the eye and does not invade the camera", () => {
	const rig = new ProceduralCharacter();
	const state = {
		feet: { x: 0, y: 0, z: 0 },
		motion: {
			grounded: true,
			crouched: false,
			sliding: false,
			sprinting: false,
			horizontalSpeed: 0,
			velocity: { x: 0, y: 0, z: 0 },
			wallNormal: null,
		},
		aimYaw: 0,
		aimPitch: 0,
		ads: 1,
		hands: {
			primary: { x: 0.12, y: 1.35, z: -0.4 },
			support: { x: -0.08, y: 1.32, z: -0.62 },
		},
	} as Parameters<ProceduralCharacter["update"]>[1];
	const ground = (p: { x: number; y: number; z: number }) => ({
		position: { x: p.x, y: 0.045, z: p.z },
		normal: { x: 0, y: 1, z: 0 },
	});
	rig.update(1 / 60, state, ground);
	const hands = {
		primary: { x: 0.12, y: 1.35, z: -0.4 },
		support: { x: -0.08, y: 1.32, z: -0.62 },
	};
	const rendered = characterRenderPose(rig.pose, rig.pose, 1, hands, true);
	// Eye sits at ~feet + eye height (~1.5). Chest must remain near the torso
	// height, not pulled up into the view-model grip line.
	expect(rendered.chest.y).toBeLessThan(1.35);
	expect(rendered.chest.y).toBeGreaterThan(1.0);
	// Hands still land exactly on the weapon grips.
	expect(rendered.hands[1]).toEqual(hands.primary);
	expect(rendered.hands[0]).toEqual(hands.support);
});

test("body yaw tracks aim with a moderate residual lag", () => {
	const rig = new ProceduralCharacter();
	const state = {
		feet: { x: 0, y: 0, z: 0 },
		motion: {
			grounded: true,
			crouched: false,
			sliding: false,
			sprinting: false,
			horizontalSpeed: 0,
			velocity: { x: 0, y: 0, z: 0 },
			wallNormal: null,
		},
		aimYaw: 0,
		aimPitch: 0,
		ads: 0,
		hands: {
			primary: { x: 0.2, y: 1.2, z: -0.3 },
			support: { x: 0.1, y: 1.2, z: -0.6 },
		},
	} as Parameters<ProceduralCharacter["update"]>[1];
	const ground = (p: { x: number; y: number; z: number }) => ({
		position: { x: p.x, y: 0.045, z: p.z },
		normal: { x: 0, y: 1, z: 0 },
	});
	rig.update(1 / 60, state, ground);
	state.aimYaw = Math.PI / 2;
	for (let i = 0; i < 30; i++) rig.update(1 / 60, state, ground);
	const error = Math.abs(
		Math.atan2(
			Math.sin(state.aimYaw - rig.pose.bodyYaw),
			Math.cos(state.aimYaw - rig.pose.bodyYaw),
		),
	);
	expect(error).toBeLessThan(0.35);
});
