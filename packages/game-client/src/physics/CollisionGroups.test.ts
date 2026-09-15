import { beforeAll, expect, test } from "bun:test";
import { initRapier, PhysicsWorld } from "./PhysicsWorld";

beforeAll(initRapier);
test("chaos scenery lands on the desk and remains after entry ends", () => {
	const physics = new PhysicsWorld();
	try {
		physics.createStaticBox({ position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 40 } });
		const { body } = physics.createDynamicBox({ position: { x: 0, y: 35, z: 0 }, size: { x: 4, y: 1, z: 3 } });
		for (let i = 0; i < 1200; i++) physics.step(1 / 60);
		expect(body.translation().y).toBeGreaterThan(0.45);
		expect(body.translation().y).toBeLessThan(0.6);
	} finally { physics.dispose(); }
});
