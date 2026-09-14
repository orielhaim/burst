import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { initRapier, PhysicsWorld } from "../../physics/PhysicsWorld";
import { WeaponObstruction } from "./WeaponObstruction";

const worlds: PhysicsWorld[] = [];

beforeAll(async () => {
	await initRapier();
});

afterAll(() => {
	for (const world of worlds) world.dispose();
});

describe("WeaponObstruction", () => {
	test("begins a smooth retraction instead of snapping backward at contact", () => {
		const physics = new PhysicsWorld({ x: 0, y: 0, z: 0 });
		worlds.push(physics);
		physics.createStaticBox({
			position: { x: 0, y: 1.5, z: -0.6 },
			size: { x: 4, y: 4, z: 0.08 },
		});
		const { body } = physics.createPlayerBody(
			{ x: 0, y: 0.9, z: 0 },
			0.35,
			0.55,
		);
		physics.step(1 / 60);
		const obstruction = new WeaponObstruction(physics, body);
		const result = obstruction.resolve(
			{ x: 0, y: 1.5, z: 0 },
			[{ position: { x: 0.18, y: 1.45, z: -1 }, radius: 0.08 }],
			1 / 60,
		);
		expect(result.blocked).toBe(true);
		expect(result.retraction).toBeGreaterThan(0);
		expect(result.retraction).toBeLessThan(0.1);
	});

	test("restores the desired pose gradually after the obstruction clears", () => {
		const physics = new PhysicsWorld({ x: 0, y: 0, z: 0 });
		worlds.push(physics);
		physics.createStaticBox({
			position: { x: 0, y: 1.5, z: -0.6 },
			size: { x: 4, y: 4, z: 0.08 },
		});
		const { body } = physics.createPlayerBody(
			{ x: 0, y: 0.9, z: 0 },
			0.35,
			0.55,
		);
		physics.step(1 / 60);
		const obstruction = new WeaponObstruction(physics, body);
		const blocked = obstruction.resolve(
			{ x: 0, y: 1.5, z: 0 },
			[{ position: { x: 0, y: 1.5, z: -1 }, radius: 0.08 }],
			1 / 60,
		);
		const clearing = obstruction.resolve(
			{ x: 5, y: 1.5, z: 0 },
			[{ position: { x: 5, y: 1.5, z: -1 }, radius: 0.08 }],
			1 / 60,
		);
		expect(clearing.retraction).toBeLessThan(blocked.retraction);
		expect(clearing.retraction).toBeGreaterThan(0);
	});
});

test("fixed intended probes settle against a wall and return without oscillation", () => {
	const physics = new PhysicsWorld({ x: 0, y: 0, z: 0 });
	worlds.push(physics);
	physics.createStaticBox({
		position: { x: 0, y: 1.5, z: -0.6 },
		size: { x: 4, y: 4, z: 0.08 },
	});
	const { body } = physics.createPlayerBody({ x: 0, y: 0.9, z: 0 }, 0.35, 0.55);
	physics.step(1 / 60);
	const solver = new WeaponObstruction(physics, body);
	const eye = { x: 0, y: 1.5, z: 0 };
	const probes = [{ position: { x: 0, y: 1.5, z: -1 }, radius: 0.08 }];
	let previous = 0;
	for (let i = 0; i < 180; i++) {
		const result = solver.resolve(eye, probes, 1 / 120);
		if (i > 120)
			expect(Math.abs(result.retraction - previous)).toBeLessThan(0.0001);
		previous = result.retraction;
	}
	for (let i = 0; i < 180; i++) {
		const result = solver.resolve(eye, [], 1 / 120);
		expect(result.retraction).toBeLessThanOrEqual(previous + 1e-8);
		previous = result.retraction;
	}
	expect(previous).toBeLessThan(0.0001);
});

test("side contact displaces the weapon before retracting", () => {
	const physics = new PhysicsWorld({ x: 0, y: 0, z: 0 });
	worlds.push(physics);
	physics.createStaticBox({
		position: { x: 0.3, y: 1.5, z: -0.6 },
		size: { x: 0.04, y: 4, z: 4 },
	});
	const { body } = physics.createPlayerBody({ x: 0, y: 0.9, z: 0 }, 0.1, 0.55);
	physics.step(1 / 60);
	const solver = new WeaponObstruction(physics, body);
	let result = solver.resolve(
		{ x: 0, y: 1.5, z: 0 },
		[{ position: { x: 0.24, y: 1.5, z: -0.7 }, radius: 0.07 }],
		1 / 60,
	);
	for (let i = 0; i < 60; i++)
		result = solver.resolve(
			{ x: 0, y: 1.5, z: 0 },
			[{ position: { x: 0.24, y: 1.5, z: -0.7 }, radius: 0.07 }],
			1 / 60,
		);
	expect(result.lateral).toBeLessThan(-0.01);
	expect(result.retraction).toBeLessThan(0.01);
	expect(Math.abs(result.lateral)).toBeLessThanOrEqual(0.14);
});
