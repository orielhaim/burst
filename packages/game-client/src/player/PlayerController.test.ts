import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { initRapier, PhysicsWorld } from "../physics/PhysicsWorld";
import { DEFAULT_MOVEMENT_CONFIG } from "./MovementConfig";
import type { MovementInput } from "./MovementState";
import { PlayerController } from "./PlayerController";

const DT = 1 / 60;
const IDLE: MovementInput = {
	moveX: 0,
	moveY: 0,
	jumpPressed: false,
	jumpHeld: false,
	sprintHeld: false,
	crouchHeld: false,
	crouchPressed: false,
	lookYaw: 0,
};

const worlds: PhysicsWorld[] = [];

beforeAll(async () => {
	await initRapier();
});

afterAll(() => {
	for (const world of worlds) world.dispose();
});

function createPlayer(spawn = { x: 0, y: 0.9, z: 0 }) {
	const physics = new PhysicsWorld();
	worlds.push(physics);
	physics.createStaticBox({
		position: { x: 0, y: -0.5, z: 0 },
		size: { x: 40, y: 1, z: 40 },
	});
	const player = new PlayerController(physics, spawn);
	return { physics, player };
}

function step(
	physics: PhysicsWorld,
	player: PlayerController,
	input: MovementInput,
	count = 1,
) {
	for (let index = 0; index < count; index += 1) {
		player.update(DT, input);
		physics.step(DT);
	}
}

describe("PlayerController", () => {
	test("sweeps a sprint-speed capsule through a thin wall without tunneling", () => {
		const { physics, player } = createPlayer({ x: 0, y: 0.9, z: 1 });
		physics.createStaticBox({
			position: { x: 0, y: 1, z: 0 },
			size: { x: 5, y: 3, z: 0.04 },
		});
		physics.step(DT);
		player.motor.move({ x: 0, y: 0, z: -180 }, DT);
		physics.step(DT);
		expect(player.getPosition().z).toBeGreaterThanOrEqual(0.36);
		expect(Math.abs(player.getVelocity().z)).toBeLessThan(0.01);
	});

	test("collision response removes wall-normal speed but preserves wall sliding", () => {
		const { physics, player } = createPlayer({ x: 0, y: 0.9, z: 1 });
		physics.createStaticBox({
			position: { x: 0, y: 1, z: 0 },
			size: { x: 20, y: 3, z: 0.1 },
		});
		physics.step(DT);
		player.motor.move({ x: 8, y: 0, z: -30 }, 0.1);
		expect(player.getPosition().z).toBeGreaterThanOrEqual(0.36);
		expect(Math.abs(player.getVelocity().z)).toBeLessThan(0.01);
		expect(player.getVelocity().x).toBeGreaterThan(7.5);
	});

	test("two character capsules preserve separation under head-on movement", () => {
		const physics = new PhysicsWorld();
		worlds.push(physics);
		physics.createStaticBox({
			position: { x: 0, y: -0.5, z: 0 },
			size: { x: 40, y: 1, z: 40 },
		});
		const left = new PlayerController(physics, { x: -1.5, y: 0.9, z: 0 });
		const right = new PlayerController(physics, { x: 1.5, y: 0.9, z: 0 });
		for (let index = 0; index < 120; index += 1) {
			left.update(DT, { ...IDLE, moveX: 1, sprintHeld: true });
			right.update(DT, { ...IDLE, moveX: -1, sprintHeld: true });
			physics.step(DT);
		}
		const separation = Math.abs(left.getPosition().x - right.getPosition().x);
		expect(separation).toBeGreaterThanOrEqual(
			DEFAULT_MOVEMENT_CONFIG.radius * 2 - DEFAULT_MOVEMENT_CONFIG.collisionSkinWidth,
		);
	});

	test("moves an occupied spawn to a nearby collision-free position", () => {
		const physics = new PhysicsWorld();
		worlds.push(physics);
		physics.createStaticBox({
			position: { x: 0, y: -0.5, z: 0 },
			size: { x: 40, y: 1, z: 40 },
		});
		const first = new PlayerController(physics, { x: 0, y: 0.9, z: 0 });
		const second = new PlayerController(physics, { x: 0, y: 0.9, z: 0 });
		const separation = Math.hypot(
			first.getPosition().x - second.getPosition().x,
			first.getPosition().z - second.getPosition().z,
		);
		expect(separation).toBeGreaterThanOrEqual(
			DEFAULT_MOVEMENT_CONFIG.radius * 2,
		);
	});

	test("blocks movement against dynamic rigid bodies", () => {
		const { physics, player } = createPlayer({ x: 0, y: 0.9, z: 2 });
		physics.createDynamicBox({
			position: { x: 0, y: 1, z: 0 },
			size: { x: 3, y: 2, z: 0.4 },
		});
		physics.step(DT);
		player.motor.move({ x: 0, y: 0, z: -120 }, DT);
		expect(player.getPosition().z).toBeGreaterThan(0.5);
	});

	test("stops an upward jump at a low ceiling", () => {
		const { physics, player } = createPlayer();
		physics.createStaticBox({
			position: { x: 0, y: 2.05, z: 0 },
			size: { x: 4, y: 0.2, z: 4 },
		});
		physics.step(DT);
		step(physics, player, IDLE, 2);
		step(physics, player, { ...IDLE, jumpPressed: true });
		step(physics, player, IDLE, 20);
		expect(player.getPosition().y).toBeLessThanOrEqual(1.04);
	});

	test("rejects invalid velocity and oversized simulation deltas", () => {
		const { physics, player } = createPlayer();
		player.update(Number.NaN, { ...IDLE, moveY: 1 });
		player.motor.move({ x: Number.NaN, y: Infinity, z: 0 }, 10);
		physics.step(DT);
		const position = player.getPosition();
		const velocity = player.getVelocity();
		expect(Object.values(position).every(Number.isFinite)).toBe(true);
		expect(Object.values(velocity).every(Number.isFinite)).toBe(true);
	});

	test("walks, sprints forward, and returns to walk speed", () => {
		const { physics, player } = createPlayer();
		step(physics, player, { ...IDLE, moveY: 1 }, 90);
		expect(player.movement.horizontalSpeed).toBeCloseTo(
			DEFAULT_MOVEMENT_CONFIG.walkSpeed,
			1,
		);

		step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true }, 45);
		expect(player.movement.sprinting).toBe(true);
		expect(player.movement.horizontalSpeed).toBeCloseTo(
			DEFAULT_MOVEMENT_CONFIG.sprintSpeed,
			1,
		);

		step(physics, player, { ...IDLE, moveY: 1 }, 45);
		expect(player.movement.sprinting).toBe(false);
		expect(player.movement.horizontalSpeed).toBeCloseTo(
			DEFAULT_MOVEMENT_CONFIG.walkSpeed,
			1,
		);
	});

	test("changes collider once for crouch and refuses to stand into a ceiling", () => {
		const { physics, player } = createPlayer();
		physics.createStaticBox({
			position: { x: 0, y: 1.5, z: 0 },
			size: { x: 3, y: 0.4, z: 3 },
		});
		step(
			physics,
			player,
			{ ...IDLE, crouchHeld: true, crouchPressed: true },
			2,
		);
		expect(player.movement.crouched).toBe(true);
		expect(player.motor.getHalfHeight()).toBe(
			DEFAULT_MOVEMENT_CONFIG.crouchingHalfHeight,
		);
		expect(player.getCameraHeight()).toBe(
			DEFAULT_MOVEMENT_CONFIG.crouchingEyeHeight,
		);

		step(physics, player, IDLE, 4);
		expect(player.movement.crouched).toBe(true);

		player.body.setTranslation({ x: 4, y: player.getPosition().y, z: 0 }, true);
		step(physics, player, IDLE, 2);
		expect(player.movement.crouched).toBe(false);
		expect(player.motor.getHalfHeight()).toBe(
			DEFAULT_MOVEMENT_CONFIG.standingHalfHeight,
		);
	});

	test("starts a momentum slide and loses speed", () => {
		const { physics, player } = createPlayer();
		step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true }, 60);
		step(physics, player, {
			...IDLE,
			moveY: 1,
			sprintHeld: true,
			crouchHeld: true,
			crouchPressed: true,
		});
		expect(player.movement.sliding).toBe(true);
		const initialSpeed = player.movement.slideSpeed;

		step(physics, player, { ...IDLE, moveY: -1, crouchHeld: true }, 12);
		expect(player.movement.slideSpeed).toBeLessThan(initialSpeed);
	});

	test("uses sprint momentum to slide when Ctrl follows a released run input", () => {
		const { physics, player } = createPlayer();
		step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true }, 60);
		expect(player.movement.horizontalSpeed).toBeGreaterThan(8);
		step(physics, player, {
			...IDLE,
			crouchHeld: true,
			crouchPressed: true,
		});
		expect(player.movement.sliding).toBe(true);
		expect(player.movement.slideSpeed).toBeGreaterThan(8);
	});

	test("buffers Ctrl in the air and starts a forward slide on landing", () => {
		const { physics, player } = createPlayer();
		step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true }, 45);
		step(physics, player, {
			...IDLE,
			moveY: 1,
			sprintHeld: true,
			jumpPressed: true,
		});
		step(physics, player, { ...IDLE, moveY: 1 }, 22);
		step(physics, player, {
			...IDLE,
			moveY: 1,
			crouchHeld: true,
			crouchPressed: true,
		});
		for (let index = 0; index < 90 && !player.movement.sliding; index += 1) {
			step(physics, player, {
				...IDLE,
				moveY: 1,
				crouchHeld: true,
			});
		}
		expect(player.movement.sliding).toBe(true);
		expect(player.movement.crouched).toBe(true);
	});

	test("can jump while moving uphill on a ramp", () => {
		const physics = new PhysicsWorld();
		worlds.push(physics);
		physics.createStaticBox({
			position: { x: 0, y: -0.5, z: 0 },
			size: { x: 20, y: 1, z: 20 },
		});
		physics.createStaticBox({
			position: { x: 0, y: 0.65, z: 0 },
			size: { x: 4, y: 0.3, z: 5 },
			rotation: { x: -0.35, y: 0, z: 0 },
		});
		physics.step(DT);
		const player = new PlayerController(physics, { x: 0, y: 1.5, z: 2 });
		step(physics, player, { ...IDLE, moveY: 1 }, 30);
		step(physics, player, { ...IDLE, moveY: 1, jumpPressed: true });
		expect(player.movement.velocity.y).toBeCloseTo(
			DEFAULT_MOVEMENT_CONFIG.jumpVelocity,
			3,
		);
	});

	test("ground jump is edge-triggered and does not repeat in mid-air", () => {
		const { physics, player } = createPlayer();
		step(physics, player, IDLE, 4);
		step(physics, player, { ...IDLE, jumpPressed: true });
		const firstJumpVelocity = player.movement.velocity.y;
		expect(firstJumpVelocity).toBeCloseTo(DEFAULT_MOVEMENT_CONFIG.jumpVelocity, 5);

		step(physics, player, { ...IDLE, jumpPressed: true }, 5);
		expect(player.getVelocity().y).toBeLessThan(firstJumpVelocity);
	});

	test("wall jump uses the wall normal for lift and separation", () => {
		const { physics, player } = createPlayer({ x: 0, y: 2, z: -1.64 });
		physics.createStaticBox({
			position: { x: 0, y: 2, z: -2.5 },
			size: { x: 6, y: 5, z: 1 },
		});
		physics.step(DT);
		step(physics, player, { ...IDLE, jumpPressed: true });
		expect(player.movement.wallNormal?.z).toBeGreaterThan(0.8);
		expect(player.getVelocity().z).toBeGreaterThan(2);
		expect(player.movement.velocity.y).toBeCloseTo(
			DEFAULT_MOVEMENT_CONFIG.wallJumpUpSpeed,
			5,
		);

		player.motor.teleport({ x: 0, y: 2, z: -1.64 });
		physics.step(DT);
		step(physics, player, { ...IDLE, jumpPressed: true });
		expect(player.movement.velocity.y).not.toBe(
			DEFAULT_MOVEMENT_CONFIG.wallJumpUpSpeed,
		);

		physics.createStaticBox({
			position: { x: 2.5, y: 2, z: 0 },
			size: { x: 1, y: 5, z: 6 },
		});
		player.motor.teleport({ x: 1.64, y: 2, z: 0 });
		physics.step(DT);
		step(physics, player, { ...IDLE, jumpPressed: true });
		expect(player.movement.velocity.x).toBeLessThan(-2);
		expect(player.movement.velocity.y).toBeCloseTo(
			DEFAULT_MOVEMENT_CONFIG.wallJumpUpSpeed,
			5,
		);
	});

	test("buffers a jump pressed shortly before landing", () => {
		const { physics, player } = createPlayer({ x: 0, y: 2.2, z: 0 });
		let buffered = false;
		for (let index = 0; index < 120; index += 1) {
			const velocity = player.getVelocity();
			const shouldBuffer: boolean =
				!buffered && velocity.y < 0 && player.getPosition().y < 1.25;
			step(physics, player, { ...IDLE, jumpPressed: shouldBuffer });
			buffered ||= shouldBuffer;
			if (
				buffered &&
				Math.abs(
					player.movement.velocity.y - DEFAULT_MOVEMENT_CONFIG.jumpVelocity,
				) < 1e-4
			)
				break;
		}
		expect(buffered).toBe(true);
		expect(player.movement.velocity.y).toBeCloseTo(
			DEFAULT_MOVEMENT_CONFIG.jumpVelocity,
			5,
		);
	});

	test("allows coyote jump just after leaving a ledge", () => {
		const physics = new PhysicsWorld();
		worlds.push(physics);
		physics.createStaticBox({
			position: { x: 0, y: -0.5, z: 0 },
			size: { x: 2, y: 1, z: 4 },
		});
		const player = new PlayerController(physics, { x: 0.4, y: 0.9, z: 0 });
		let leftGround = false;
		for (let index = 0; index < 60; index += 1) {
			step(physics, player, { ...IDLE, moveX: 1 });
			if (!player.movement.grounded && player.getPosition().x > 1.2) {
				leftGround = true;
				break;
			}
		}
		expect(leftGround).toBe(true);
		step(physics, player, { ...IDLE, moveX: 1, jumpPressed: true });
		expect(player.movement.velocity.y).toBeCloseTo(
			DEFAULT_MOVEMENT_CONFIG.jumpVelocity,
			5,
		);
	});

	test("reverse input brakes harder than release", () => {
		const released = createPlayer();
		const reversed = createPlayer();
		step(released.physics, released.player, { ...IDLE, moveY: 1, sprintHeld: true }, 60);
		step(reversed.physics, reversed.player, { ...IDLE, moveY: 1, sprintHeld: true }, 60);
		step(released.physics, released.player, IDLE);
		step(reversed.physics, reversed.player, { ...IDLE, moveY: -1 });
		expect(reversed.player.movement.horizontalSpeed).toBeLessThan(released.player.movement.horizontalSpeed);
	});

	test("a ninety-degree running turn redirects momentum promptly", () => {
		const { physics, player } = createPlayer();
		step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true }, 60);
		expect(player.movement.velocity.z).toBeLessThan(-8);

		step(
			physics,
			player,
			{ ...IDLE, moveY: 1, sprintHeld: true, lookYaw: -Math.PI / 2 },
			12,
		);
		expect(player.movement.velocity.x).toBeGreaterThan(6);
		expect(Math.abs(player.movement.velocity.z)).toBeLessThan(3);
		expect(player.movement.horizontalSpeed).toBeGreaterThan(6);
	});

	test("flat sprint does not lose grounded state or suffer a one-tick stop", () => {
		const { physics, player } = createPlayer();
		const speeds: number[] = [];
		for (let index = 0; index < 120; index += 1) {
			step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true });
			if (index > 60) {
				expect(player.movement.grounded).toBe(true);
				speeds.push(player.movement.horizontalSpeed);
			}
		}
		expect(Math.min(...speeds)).toBeGreaterThan(DEFAULT_MOVEMENT_CONFIG.sprintSpeed * 0.95);
	});

	test("autostep traversal does not erase running velocity", () => {
		const { physics, player } = createPlayer({ x: 0, y: 0.9, z: 4 });
		physics.createStaticBox({
			position: { x: 0, y: 0.1, z: 0 },
			size: { x: 5, y: 0.2, z: 1.2 },
		});
		physics.step(DT);
		let minimumSpeed = Number.POSITIVE_INFINITY;
		for (let index = 0; index < 90; index += 1) {
			step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true });
			if (player.getPosition().z < 1 && player.getPosition().z > -1) {
				minimumSpeed = Math.min(minimumSpeed, player.movement.horizontalSpeed);
			}
		}
		expect(minimumSpeed).toBeGreaterThan(DEFAULT_MOVEMENT_CONFIG.sprintSpeed * 0.75);
	});

	test("jump and slide jump preserve horizontal momentum", () => {
		const normal = createPlayer();
		step(normal.physics, normal.player, { ...IDLE, moveY: 1, sprintHeld: true }, 60);
		const runSpeed = normal.player.movement.horizontalSpeed;
		step(normal.physics, normal.player, { ...IDLE, moveY: 1, jumpPressed: true, jumpHeld: true });
		expect(normal.player.movement.horizontalSpeed).toBeGreaterThan(runSpeed * 0.95);

		const sliding = createPlayer();
		step(sliding.physics, sliding.player, { ...IDLE, moveY: 1, sprintHeld: true }, 60);
		step(sliding.physics, sliding.player, { ...IDLE, moveY: 1, crouchHeld: true, crouchPressed: true });
		const slideSpeed = sliding.player.movement.horizontalSpeed;
		step(sliding.physics, sliding.player, { ...IDLE, crouchHeld: true, jumpPressed: true, jumpHeld: true });
		expect(sliding.player.movement.sliding).toBe(false);
		expect(sliding.player.movement.horizontalSpeed).toBeGreaterThan(slideSpeed * 0.85);
	});

	test("air control cannot instantly reverse sprint momentum", () => {
		const { physics, player } = createPlayer();
		step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true }, 60);
		step(physics, player, { ...IDLE, moveY: 1, jumpPressed: true, jumpHeld: true });
		step(physics, player, { ...IDLE, moveY: -1 }, 10);
		expect(player.movement.velocity.z).toBeLessThan(0);
	});

	test("low-speed crouch does not enter slide", () => {
		const { physics, player } = createPlayer();
		step(physics, player, IDLE, 3);
		step(physics, player, { ...IDLE, crouchHeld: true, crouchPressed: true });
		expect(player.movement.crouched).toBe(true);
		expect(player.movement.sliding).toBe(false);
	});

	test("expired coyote time and jump buffer do not jump", () => {		const physics = new PhysicsWorld();
		worlds.push(physics);
		physics.createStaticBox({ position: { x: 0, y: -0.5, z: 0 }, size: { x: 2, y: 1, z: 4 } });
		const player = new PlayerController(physics, { x: 0.4, y: 0.9, z: 0 });
		while (player.movement.timeAirborne <= DEFAULT_MOVEMENT_CONFIG.coyoteTime + DT) step(physics, player, { ...IDLE, moveX: 1 });
		step(physics, player, { ...IDLE, jumpPressed: true, jumpHeld: true });
		expect(player.movement.velocity.y).toBeLessThan(DEFAULT_MOVEMENT_CONFIG.jumpVelocity);

		const falling = createPlayer({ x: 0, y: 4, z: 0 });
		step(falling.physics, falling.player, { ...IDLE, jumpPressed: true, jumpHeld: true });
		step(falling.physics, falling.player, IDLE, Math.ceil(DEFAULT_MOVEMENT_CONFIG.jumpBufferTime / DT) + 2);
		for (let index = 0; index < 120 && !falling.player.movement.grounded; index += 1) step(falling.physics, falling.player, IDLE);
		expect(falling.player.movement.velocity.y).not.toBeCloseTo(DEFAULT_MOVEMENT_CONFIG.jumpVelocity, 3);
	});

	test("a tap of Ctrl starts a latched slide that continues without holding", () => {
		const { physics, player } = createPlayer();
		step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true }, 60);
		step(physics, player, {
			...IDLE,
			moveY: 1,
			sprintHeld: true,
			crouchHeld: true,
			crouchPressed: true,
		});
		expect(player.movement.sliding).toBe(true);
		// Release Ctrl entirely: the slide must persist with momentum.
		step(physics, player, { ...IDLE, moveY: 1 }, 12);
		expect(player.movement.sliding).toBe(true);
		expect(player.movement.crouched).toBe(true);
		expect(player.movement.horizontalSpeed).toBeLessThan(
			DEFAULT_MOVEMENT_CONFIG.sprintSpeed,
		);
	});

	test("jump grace leaves a ramp instead of sticking to it", () => {
		const physics = new PhysicsWorld();
		worlds.push(physics);
		physics.createStaticBox({
			position: { x: 0, y: -0.5, z: 0 },
			size: { x: 20, y: 1, z: 20 },
		});
		physics.createStaticBox({
			position: { x: 0, y: 0.65, z: 0 },
			size: { x: 4, y: 0.3, z: 5 },
			rotation: { x: -0.35, y: 0, z: 0 },
		});
		physics.step(DT);
		const player = new PlayerController(physics, { x: 0, y: 1.5, z: 2 });
		step(physics, player, { ...IDLE, moveY: 1 }, 30);
		step(physics, player, { ...IDLE, moveY: 1, jumpPressed: true });
		let feetY = player.getFeetPosition().y;
		// The jump must keep rising for several frames, never re-grounded.
		for (let index = 0; index < 6; index += 1) {
			step(physics, player, { ...IDLE, moveY: 1 });
			const nextFeetY = player.getFeetPosition().y;
			expect(nextFeetY).toBeGreaterThan(feetY);
			expect(player.movement.grounded).toBe(false);
			feetY = nextFeetY;
		}
	});

	test("ground stick bridges a small step edge without flicker", () => {
		const physics = new PhysicsWorld();
		worlds.push(physics);
		physics.createStaticBox({
			position: { x: 0, y: 0.5, z: 0 },
			size: { x: 4, y: 1, z: 4 },
		});
		physics.step(DT);
		const player = new PlayerController(physics, { x: 0, y: 1.9, z: 0 });
		step(physics, player, IDLE, 10);
		expect(player.movement.grounded).toBe(true);
		// Walk off the +x edge one frame at a time.
		let leftEdge = false;
		let released = false;
		let stuckFrames = 0;
		for (let index = 0; index < 30; index += 1) {
			step(physics, player, { ...IDLE, moveX: 1 });
			if (player.getPosition().x > 2 && !leftEdge) {
				leftEdge = true;
				// First frame past the edge: stick keeps contact.
				expect(player.movement.grounded).toBe(true);
			}
			if (leftEdge && player.movement.grounded) stuckFrames += 1;
			if (leftEdge && !player.movement.grounded) {
				released = true;
				break;
			}
		}
		expect(leftEdge).toBe(true);
		// Stick is brief: contact must release soon after the edge.
		expect(released).toBe(true);
		expect(stuckFrames).toBeLessThanOrEqual(8);
	});
});


describe("momentum transitions", () => {
	test("ADS suppresses sprint but permits a slide from existing momentum", () => {
		const { physics, player } = createPlayer();
		step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true }, 35);
		step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true, aimHeld: true, crouchPressed: true });
		expect(player.movement.sprinting).toBe(false);
		expect(player.movement.sliding).toBe(true);
	});

	test("walking momentum can slide and holding Ctrl cannot restart it", () => {
		const { physics, player } = createPlayer();
		step(physics, player, { ...IDLE, moveY: 1 }, 35);
		const speed = player.movement.horizontalSpeed;
		step(physics, player, { ...IDLE, crouchPressed: true, crouchHeld: true });
		expect(player.movement.sliding).toBe(true);
		expect(player.movement.horizontalSpeed).toBeGreaterThan(speed);
		step(physics, player, { ...IDLE, crouchHeld: true }, 60);
		expect(player.movement.sliding).toBe(false);
		expect(player.movement.horizontalSpeed).toBeLessThan(0.1);
	});

	test("a released airborne Ctrl tap survives until landing", () => {
		const { physics, player } = createPlayer({ x: 0, y: 1.4, z: 0 });
		player.motor.move({ x: 8, y: -3, z: 0 }, DT);
		physics.step(DT);
		step(physics, player, { ...IDLE, crouchPressed: true });
		let slid = false;
		for (let i = 0; i < 20; i++) {
			step(physics, player, IDLE);
			slid ||= player.movement.sliding;
		}
		expect(slid).toBe(true);
	});

	test("wall traversal follows the view along a wall and looking up adds lift", () => {
		const { physics, player } = createPlayer({ x: 0, y: 2, z: -1.64 });
		physics.createStaticBox({ position: { x: 0, y: 2, z: -2.5 }, size: { x: 6, y: 5, z: 1 } });
		physics.step(DT);
		step(physics, player, { ...IDLE, moveY: 1, lookYaw: -Math.PI / 2, lookPitch: 0.6, jumpPressed: true });
		expect(player.getVelocity().x).toBeGreaterThan(6);
		expect(player.getVelocity().z).toBeGreaterThan(2);
		expect(player.getVelocity().y).toBeGreaterThan(DEFAULT_MOVEMENT_CONFIG.wallJumpUpSpeed);
	});
});


test("sprint slide starts slightly faster than running and does not stack boosts", () => {
	const { physics, player } = createPlayer();
	step(physics, player, { ...IDLE, moveY: 1, sprintHeld: true }, 40);
	step(physics, player, { ...IDLE, crouchPressed: true });
	const entrySpeed = player.movement.horizontalSpeed;
	expect(entrySpeed).toBeGreaterThan(DEFAULT_MOVEMENT_CONFIG.sprintSpeed);
	expect(entrySpeed).toBeLessThan(DEFAULT_MOVEMENT_CONFIG.sprintSpeed + 1.2);
	step(physics, player, { ...IDLE, crouchPressed: true });
	expect(player.movement.horizontalSpeed).toBeLessThan(entrySpeed);
});
