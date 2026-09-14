import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { initRapier, PhysicsWorld } from "../../physics/PhysicsWorld";
import { resolveHitscan } from "./HitscanFire";

const worlds: PhysicsWorld[] = [];

beforeAll(async () => {
	await initRapier();
});

afterAll(() => {
	for (const world of worlds) world.dispose();
});

describe("resolveHitscan", () => {
	test("a blocked muzzle hits nearby cover even when the camera ray is clear", () => {
		const physics = new PhysicsWorld({ x: 0, y: 0, z: 0 });
		worlds.push(physics);
		physics.createStaticBox({
			position: { x: 0.8, y: 1.5, z: -0.45 },
			size: { x: 0.5, y: 2, z: 0.15 },
		});
		const { body } = physics.createPlayerBody(
			{ x: 0, y: 0.9, z: 0 },
			0.35,
			0.55,
		);
		physics.step(1 / 60);
		const result = resolveHitscan(
			{
				weaponId: "test",
				sequence: 1,
				simulationTick: 1,
				origin: { x: 0, y: 1.5, z: 0 },
				direction: { x: 0, y: 0, z: -1 },
				projectile: { type: "hitscan", range: 20 },
			},
			10,
			physics,
			body,
			{ x: 1, y: 1.5, z: -0.1 },
		);
		expect(result.hit).not.toBeNull();
		expect(result.hit?.distance).toBeLessThan(1);
	});
});
