import { expect, test } from "bun:test";
import { createMovementState } from "../player/MovementState";
import { LocomotionResponse, ResponseSpring } from "./LocomotionResponse";
import { CameraState } from "./cameraState";

test("spring converges equally at 60 and 120 Hz", () => {
	const a = new ResponseSpring();
	const b = new ResponseSpring();
	for (let i = 0; i < 60; i++) a.step(1, 18, 1 / 60);
	for (let i = 0; i < 120; i++) b.step(1, 18, 1 / 120);
	expect(a.value).toBeCloseTo(b.value, 10);
});

test("ADS walking remains alive, sprint has stronger motion, resting settles", () => {
	const ads = new LocomotionResponse();
	const run = new LocomotionResponse();
	const motion = createMovementState();
	motion.grounded = true;
	let adsEnergy = 0;
	let runEnergy = 0;
	for (let i = 0; i < 120; i++) {
		motion.velocity = { x: 0, y: 0, z: -3 }; motion.horizontalSpeed = 3;
		ads.update(1 / 60, motion, 0, 0, 1);
		motion.velocity.z = -9.1; motion.horizontalSpeed = 9.1;
		run.update(1 / 60, motion, 0, 0, 0);
		adsEnergy += Math.abs(ads.y.value); runEnergy += Math.abs(run.y.value);
	}
	expect(adsEnergy).toBeGreaterThan(0.01);
	expect(runEnergy).toBeGreaterThan(adsEnergy * 3);
	motion.velocity = { x: 0, y: 0, z: 0 }; motion.horizontalSpeed = 0;
	for (let i = 0; i < 180; i++) run.update(1 / 60, motion, 0, 0, 0);
	expect(Math.abs(run.pitch.value)).toBeLessThan(0.00001);
});

test("landing response scales with impact velocity and aim follows the shared offset", () => {
	function land(speed: number) {
		const response = new LocomotionResponse();
		const motion = createMovementState();
		motion.velocity.y = -speed;
		for (let i = 0; i < 60; i++) response.update(1 / 60, motion, 0, 0, 1);
		motion.velocity.y = 0; motion.grounded = true;
		for (let i = 0; i < 4; i++) response.update(1 / 60, motion, 0, 0, 1);
		return response;
	}
	const soft = land(0.5); const hard = land(10);
	expect(Math.abs(hard.y.value)).toBeGreaterThan(Math.abs(soft.y.value));
	const camera = new CameraState();
	const forward = camera.forward(hard.aimPitch.value, hard.aimYaw.value);
	expect(Math.asin(forward.y)).toBeCloseTo(hard.aimPitch.value, 8);
});


test("sprint weapon motion stays below five vertical cycles per second", () => {
	const response = new LocomotionResponse();
	const motion = createMovementState();
	motion.grounded = true; motion.horizontalSpeed = 9.1;
	motion.velocity.z = -9.1;
	let previous = 0; let crossings = 0;
	for (let i = 0; i < 600; i++) {
		response.update(1 / 120, motion, 0, 0, 0);
		if (i >= 120 && previous < 0 && response.y.value >= 0) crossings++;
		previous = response.y.value;
	}
	expect(crossings / 4).toBeLessThanOrEqual(5);
});
