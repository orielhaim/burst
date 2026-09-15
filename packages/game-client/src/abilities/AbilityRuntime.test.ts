import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { initRapier, PhysicsWorld } from "../physics/PhysicsWorld";
import { PlayerController } from "../player/PlayerController";
import { AbilityRuntime } from "./AbilityRuntime";
import { dashDefinition, grappleDefinition } from "./definitions";
import type { AbilityUpdateContext } from "./AbilityRuntime";
import type { MovementInput } from "../player/MovementState";

const DT = 1 / 60;
const worlds: PhysicsWorld[] = [];

beforeAll(async () => {
	await initRapier();
});

afterAll(() => {
	for (const world of worlds) world.dispose();
});

function createWorld() {
	const physics = new PhysicsWorld();
	worlds.push(physics);
	physics.createStaticBox({
		position: { x: 0, y: -0.5, z: 0 },
		size: { x: 40, y: 1, z: 40 },
	});
	// Ceiling / grapple target above-forward
	physics.createStaticBox({
		position: { x: 0, y: 4, z: -10 },
		size: { x: 8, y: 0.4, z: 8 },
	});
	const player = new PlayerController(physics, { x: 0, y: 0.9, z: 0 });
	physics.step(DT);
	return { physics, player };
}

function idleInput(overrides: Partial<MovementInput> = {}): MovementInput {
	return {
		moveX: 0,
		moveY: 0,
		jumpPressed: false,
		jumpHeld: false,
		sprintHeld: false,
		crouchHeld: false,
		crouchPressed: false,
		lookYaw: 0,
		...overrides,
	};
}

function context(
	physics: PhysicsWorld,
	player: PlayerController,
	overrides: Partial<AbilityUpdateContext> = {},
): AbilityUpdateContext {
	return {
		dt: DT,
		activated: false,
		jumpPressed: false,
		origin: { x: 0, y: 1.5, z: 0 },
		direction: { x: 0, y: 0, z: -1 },
		player,
		physics,
		...overrides,
	};
}

function aimAtCeiling() {
	const origin = { x: 0, y: 1.5, z: 0 };
	const target = { x: 0, y: 4, z: -10 };
	const direction = {
		x: target.x - origin.x,
		y: target.y - origin.y,
		z: target.z - origin.z,
	};
	const len = Math.hypot(direction.x, direction.y, direction.z);
	direction.x /= len;
	direction.y /= len;
	direction.z /= len;
	return { origin, direction };
}

function fireGrapple(
	physics: PhysicsWorld,
	player: PlayerController,
	ability: AbilityRuntime,
) {
	const { origin, direction } = aimAtCeiling();
	return ability.update(
		context(physics, player, { activated: true, origin, direction }),
	);
}

function stepGrapple(
	physics: PhysicsWorld,
	player: PlayerController,
	ability: AbilityRuntime,
	overrides: {
		activated?: boolean;
		jumpPressed?: boolean;
		moveX?: number;
		moveZ?: number;
	} = {},
) {
	const { origin, direction } = aimAtCeiling();
	const cableStart = { x: origin.x, y: origin.y - 0.4, z: origin.z };
	const motion = ability.prepareMotion({
		jumpPressed: overrides.jumpPressed ?? false,
		activated: overrides.activated ?? false,
		player,
		physics,
		cableStart,
		moveX: overrides.moveX ?? 0,
		moveZ: overrides.moveZ ?? 0,
		lookYaw: 0,
	});
	player.update(
		DT,
		idleInput({
			moveX: overrides.moveX ?? 0,
			moveY: overrides.moveZ ?? 0,
			velocityOverride: motion,
		}),
	);
	physics.step(DT);
	return ability.update(context(physics, player, { origin, direction, cableStart }));
}

describe("AbilityRegistry", () => {
	test("registers dash and grapple definitions", () => {
		expect(dashDefinition.kind).toBe("dash");
		expect(grappleDefinition.kind).toBe("grapple");
		expect(grappleDefinition.maxRange).toBeGreaterThan(0);
		expect(grappleDefinition.hookSpeed).toBeGreaterThan(0);
	});
});

describe("DashAbility", () => {
	test("boosts horizontal speed along facing on Q", () => {
		const { physics, player } = createWorld();
		const ability = new AbilityRuntime(dashDefinition);
		player.update(DT, idleInput());
		physics.step(DT);

		const before = player.getVelocity();
		expect(Math.hypot(before.x, before.z)).toBeLessThan(1);

		ability.update(
			context(physics, player, {
				activated: true,
				origin: { ...player.getPosition(), y: player.getPosition().y + 0.6 },
				direction: { x: 0, y: 0, z: -1 },
			}),
		);

		const after = player.getVelocity();
		expect(after.z).toBeLessThan(-dashDefinition.speed * 0.9);
		expect(Math.abs(after.x)).toBeLessThan(0.01);
	});

	test("cooldown blocks a second activation", () => {
		const { physics, player } = createWorld();
		const ability = new AbilityRuntime(dashDefinition);
		ability.update(
			context(physics, player, { activated: true, direction: { x: 0, y: 0, z: -1 } }),
		);
		const first = player.getVelocity();
		player.motor.setVelocity({ x: 0, y: 0, z: 0 });
		ability.update(
			context(physics, player, { activated: true, direction: { x: 0, y: 0, z: -1 } }),
		);
		const second = player.getVelocity();
		expect(Math.hypot(second.x, second.z)).toBeLessThan(0.01);
		expect(first.z).toBeLessThan(-10);
	});
});

describe("GrappleAbility", () => {
	test("does not fire when nothing is within range", () => {
		const { physics, player } = createWorld();
		const ability = new AbilityRuntime(grappleDefinition);
		const presentation = ability.update(
			context(physics, player, {
				activated: true,
				direction: { x: 0, y: 1, z: 0 },
				origin: { x: 0, y: 1.5, z: 0 },
			}),
		);
		expect(presentation.pulling).toBe(false);
		expect(presentation.lineStart).toBeNull();
		expect(presentation.cooldownRemaining).toBe(0);
	});

	test("hook takes distance / hookSpeed time before the pull starts", () => {
		const { physics, player } = createWorld();
		const ability = new AbilityRuntime(grappleDefinition);
		fireGrapple(physics, player, ability);
		expect(ability.isActive).toBe(true);
		expect(ability.isPulling).toBe(false);

		// Flight advances in update(); one step moves the tip partway out.
		const startZ = player.getPosition().z;
		const motion = ability.prepareMotion({
			jumpPressed: false,
			activated: false,
			player,
			physics,
			cableStart: { x: 0, y: 1.1, z: 0 },
			moveX: 0,
			moveZ: 0,
			lookYaw: 0,
		});
		expect(motion).toBeNull();
		stepGrapple(physics, player, ability);
		const tip = ability.anchorPoint;
		expect(tip).not.toBeNull();
		expect(tip!.z).toBeGreaterThan(-10);
		expect(tip!.z).toBeLessThan(0);

		// Flight time for ~10.3m at 48 m/s ≈ 0.21s ≈ 13 frames.
		let frames = 1;
		while (!ability.isPulling && frames < 60) {
			stepGrapple(physics, player, ability);
			frames += 1;
		}
		expect(ability.isPulling).toBe(true);
		expect(frames).toBeGreaterThan(5);
		expect(player.getPosition().z).toBeCloseTo(startZ, 3);
	});

	test("pulls toward an anchor and allows light air strafe", () => {
		const { physics, player } = createWorld();
		const ability = new AbilityRuntime(grappleDefinition);
		fireGrapple(physics, player, ability);
		while (!ability.isPulling) stepGrapple(physics, player, ability);

		const before = { ...player.getPosition() };
		const motion = ability.prepareMotion({
			jumpPressed: false,
			activated: false,
			player,
			physics,
			cableStart: { x: 0, y: 1.1, z: 0 },
			moveX: 1,
			moveZ: 0,
			lookYaw: 0,
		});
		expect(motion).not.toBeNull();
		expect(motion!.z).toBeLessThan(-1);
		expect(motion!.y).toBeGreaterThan(0);
		// Strafe adds a positive X component (look yaw 0 → +X is right).
		expect(motion!.x).toBeGreaterThan(1);

		player.update(DT, idleInput({ moveX: 1, velocityOverride: motion }));
		physics.step(DT);
		const after = player.getPosition();
		expect(after.z).toBeLessThan(before.z);
		expect(after.x).toBeGreaterThan(before.x);
	});

	test("Q cuts the line mid-flight or mid-pull", () => {
		const { physics, player } = createWorld();
		const ability = new AbilityRuntime(grappleDefinition);
		fireGrapple(physics, player, ability);
		expect(ability.isActive).toBe(true);

		// Cut during flight.
		const cutFlight = ability.prepareMotion({
			jumpPressed: false,
			activated: true,
			player,
			physics,
			cableStart: { x: 0, y: 1.1, z: 0 },
			moveX: 0,
			moveZ: 0,
			lookYaw: 0,
		});
		expect(cutFlight).toBeNull();
		expect(ability.isActive).toBe(false);
		expect(ability.anchorPoint).toBeNull();

		// Same-frame update must not immediately re-fire.
		const { origin, direction } = aimAtCeiling();
		const afterCut = ability.update(
			context(physics, player, { activated: true, origin, direction }),
		);
		expect(afterCut.pulling).toBe(false);
		expect(ability.isActive).toBe(false);
	});

	test("jump cancels an active pull before motion is applied", () => {
		const { physics, player } = createWorld();
		const ability = new AbilityRuntime(grappleDefinition);
		fireGrapple(physics, player, ability);
		while (!ability.isPulling) stepGrapple(physics, player, ability);

		const motion = ability.prepareMotion({
			jumpPressed: true,
			activated: false,
			player,
			physics,
			cableStart: { x: 0, y: 1.1, z: 0 },
			moveX: 0,
			moveZ: 0,
			lookYaw: 0,
		});
		expect(motion).toBeNull();
		// Re-read through a local so TS does not keep pre-call narrowing.
		const stillActive: boolean = ability.isActive;
		expect(stillActive).toBe(false);
		expect(ability.anchorPoint).toBeNull();
	});

	test("severs the cable when geometry blocks the path to the anchor", () => {
		const { physics, player } = createWorld();
		const ability = new AbilityRuntime(grappleDefinition);
		fireGrapple(physics, player, ability);
		while (!ability.isPulling) stepGrapple(physics, player, ability);
		expect(ability.isActive).toBe(true);

		// Drop a wall between the body and the ceiling anchor.
		physics.createStaticBox({
			position: { x: 0, y: 2.5, z: -5 },
			size: { x: 6, y: 2, z: 0.3 },
		});
		physics.step(DT);

		const motion = ability.prepareMotion({
			jumpPressed: false,
			activated: false,
			player,
			physics,
			cableStart: { x: 0, y: 1.1, z: 0 },
			moveX: 0,
			moveZ: 0,
			lookYaw: 0,
		});
		expect(motion).toBeNull();
		const stillActive: boolean = ability.isActive;
		expect(stillActive).toBe(false);
		expect(ability.anchorPoint).toBeNull();
	});

	test("respects max range", () => {
		const { physics, player } = createWorld();
		const short = AbilityRuntime.fromId("grapple");
		short.equip({
			...grappleDefinition,
			maxRange: 2,
		});
		const origin = { x: 0, y: 1.5, z: 0 };
		const direction = { x: 0, y: 0, z: -1 };
		const presentation = short.update(
			context(physics, player, { activated: true, origin, direction }),
		);
		expect(presentation.pulling).toBe(false);
		expect(short.isActive).toBe(false);
	});
});
