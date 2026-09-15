import { expect, test } from "bun:test";
import { EntryDrop, ENTRY_DROP_CONFIG } from "./entryDrop";

function flight() {
	const drop = new EntryDrop();
	drop.start({ position: { x: 0, y: 1, z: 0 }, yaw: 0 });
	return drop;
}

test("flight steering follows the same camera axes as ground movement", () => {
	const drop = flight();
	const forward = drop.flightVelocity(0, 1, Math.PI / 2, false, 1 / 60);
	expect(forward.x).toBeLessThan(0);
	expect(Math.abs(forward.z)).toBeLessThan(1e-6);
	const right = flight().flightVelocity(1, 0, Math.PI / 2, false, 1 / 60);
	expect(right.z).toBeLessThan(0);
});

test("diagonal steering is capped and diving increases descent without ending entry", () => {
	const drop = flight();
	let velocity = { x: 0, y: 0, z: 0 };
	for (let i = 0; i < 1200; i++) velocity = drop.flightVelocity(1, 1, 0, true, 1 / 60);
	expect(Math.hypot(velocity.x, velocity.z)).toBeCloseTo(ENTRY_DROP_CONFIG.airSteerSpeed, 5);
	expect(velocity.y).toBeCloseTo(-ENTRY_DROP_CONFIG.diveSpeed, 5);
	expect(drop.active).toBe(true);
	expect(drop.observe({ x: 12, y: 10, z: 3 }, false)).toBe(false);
	expect(drop.observe({ x: 12, y: 10, z: 3 }, true)).toBe(true);
});
