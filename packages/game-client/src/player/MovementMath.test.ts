import { describe, expect, test } from "bun:test";
import { accelerate, applyFriction, projectOnPlane, steerVelocity } from "./MovementMath";

describe("movement math", () => {
	test("acceleration approaches desired speed without replacing momentum", () => {
		const first = accelerate({ x: 0, z: 0 }, { x: 1, z: 0 }, 6, 12, 0.1);
		expect(first.x).toBeCloseTo(1.2, 6);
		const capped = accelerate({ x: 5.8, z: 0 }, { x: 1, z: 0 }, 6, 12, 0.1);
		expect(capped.x).toBe(6);
	});

	test("release applies finite deceleration", () => {
		const stopped = applyFriction({ x: 8, z: 0 }, 20, 0, 1 / 60);
		expect(stopped.x).toBeGreaterThan(0);
		expect(stopped.x).toBeLessThan(8);
	});

	test("steering rotates direction while preserving speed", () => {
		const result = steerVelocity({ x: 10, z: 0 }, { x: 0, z: 1 }, Math.PI / 4);
		expect(Math.hypot(result.x, result.z)).toBeCloseTo(10, 6);
		expect(result.x).toBeGreaterThan(0);
		expect(result.z).toBeGreaterThan(0);
	});

	test("slope projection removes the normal component", () => {
		const normal = { x: 0, y: Math.SQRT1_2, z: Math.SQRT1_2 };
		const projected = projectOnPlane({ x: 0, y: -28, z: 0 }, normal);
		expect(projected.y * normal.y + projected.z * normal.z).toBeCloseTo(0, 6);
		expect(projected.z).toBeGreaterThan(0);
	});

	test("downhill gravity increases slide speed", () => {
		const normal = { x: 0, y: Math.cos(0.3), z: Math.sin(0.3) };
		const gravity = projectOnPlane({ x: 0, y: -28, z: 0 }, normal);
		const before = 7;
		const after = before + gravity.z / 60;
		expect(after).toBeGreaterThan(before);
	});
});
