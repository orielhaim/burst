import { afterAll, beforeAll, expect, test } from "bun:test";
import {
	createProjectileLaunch,
	integrateProjectile,
	ProjectileSimulation,
} from "./ProjectileFire";
import { rifleDefinition } from "../definitions/rifle";
import { WORLD_ENVIRONMENT } from "../../sim/Environment";
import { initRapier, PhysicsWorld } from "../../physics/PhysicsWorld";
import { HitRegions } from "../../character/HitRegions";
import type { FireWeaponCommand } from "../WeaponDefinition";
const command: FireWeaponCommand = {
	weaponId: "test",
	sequence: 1,
	simulationTick: 0,
	origin: { x: 0, y: 2, z: 0 },
	direction: { x: 0, y: 0, z: -1 },
	projectile: rifleDefinition.projectile,
};
const worlds: PhysicsWorld[] = [];
beforeAll(initRapier);
afterAll(() => {
	for (const world of worlds) world.dispose();
});
function world() {
	const physics = new PhysicsWorld();
	worlds.push(physics);
	const { body } = physics.createPlayerBody({ x: 5, y: 1, z: 0 }, 0.3, 0.5);
	physics.step(1 / 60);
	return { physics, body };
}
function flight(speed: number, bc = 500, mass = 0.004) {
	const definition = {
		...command.projectile,
		muzzleVelocity: speed,
		ballisticCoefficient: bc,
		mass,
	};
	const state = createProjectileLaunch({ ...command, projectile: definition });
	while (-state.position.z < 100)
		integrateProjectile(state, definition, 1 / 1000);
	return state;
}
test("faster rounds reach a fixed distance sooner with less gravitational drop", () => {
	const fast = flight(850);
	const slow = flight(390);
	expect(fast.age).toBeLessThan(slow.age);
	expect(fast.position.y).toBeGreaterThan(slow.position.y);
	expect(Math.abs(fast.velocity.z)).toBeLessThan(850);
});
test("BC controls retention; equal BC does not double-count projectile mass", () => {
	const efficient = flight(500, 800);
	const lossy = flight(500, 100);
	expect(Math.abs(efficient.velocity.z)).toBeGreaterThan(
		Math.abs(lossy.velocity.z),
	);
	const heavy = flight(500, 800, 0.02);
	expect(heavy.position.y).toBeCloseTo(efficient.position.y, 8);
});
test("vacuum matches Newtonian drop and shared wind affects drag", () => {
	const state = createProjectileLaunch(command);
	const environment = { ...WORLD_ENVIRONMENT, airDensity: 0 };
	for (let i = 0; i < 240; i++)
		integrateProjectile(state, command.projectile, 1 / 240, environment);
	expect(state.position.y).toBeCloseTo(2 + environment.gravity.y / 2, 5);
	const windy = createProjectileLaunch(command);
	integrateProjectile(windy, command.projectile, 0.01, {
		...WORLD_ENVIRONMENT,
		wind: { x: 30, y: 0, z: 0 },
	});
	expect(windy.velocity.x).toBeGreaterThan(0);
});
test("real flight time, head multiplier, impact velocity and shooter exclusion", () => {
	const { physics, body } = world();
	const regions = new HitRegions();
	regions.set("local", [{ name: "head", center: command.origin, radius: 0.2 }]);
	regions.set("target", [
		{ name: "head", center: { x: 0, y: 1.8, z: -80 }, radius: 0.6 },
	]);
	const simulation = new ProjectileSimulation(regions);
	simulation.launch(command);
	expect(
		simulation.update(1 / 60, physics, body).some((event) => event.normal),
	).toBe(false);
	const hits = [];
	for (let i = 0; i < 20; i++)
		hits.push(
			...simulation
				.update(1 / 60, physics, body)
				.filter((event) => event.normal),
		);
	expect(hits).toHaveLength(1);
	expect(hits[0]!.damage).toBe(
		command.projectile.baseDamage * command.projectile.headshotMultiplier,
	);
	expect(hits[0]!.timeOfFlight).toBeGreaterThan(0.08);
	expect(Math.abs(hits[0]!.impactVelocity.z)).toBeLessThan(850);
});
test("thin cover occludes player hit regions and stops the projectile", () => {
	const { physics, body } = world();
	physics.createStaticBox({
		position: { x: 0, y: 2, z: -10 },
		size: { x: 4, y: 4, z: 0.01 },
	});
	physics.step(1 / 60);
	const regions = new HitRegions();
	regions.set("target", [
		{ name: "body", center: { x: 0, y: 2, z: -12 }, radius: 0.5 },
	]);
	const simulation = new ProjectileSimulation(regions);
	simulation.launch(command);
	const event = simulation
		.update(1 / 60, physics, body)
		.find((event) => event.normal)!;
	expect(event.actorId).toBeUndefined();
	expect(event.colliderHandle).toBeDefined();
	expect(simulation.count).toBe(0);
});
