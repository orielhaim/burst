import { describe, expect, test } from "bun:test";
import { rifleDefinition } from "./definitions/rifle";
import { createProjectileLaunch } from "./fire/ProjectileFire";
import { ScopeRegistry } from "./optics/ScopeRegistry";
import { lensAngularFovDegrees, magnifiedFovDegrees } from "../sim/scopeMath";
import type { WeaponDefinition } from "./WeaponDefinition";
import { type WeaponIntent, WeaponRuntime } from "./WeaponRuntime";

const IDLE: WeaponIntent = {
	primaryFireHeld: false,
	primaryFirePressed: false,
	aimHeld: false,
	reloadPressed: false,
	origin: { x: 0, y: 1, z: 0 },
	direction: { x: 0, y: 0, z: -1 },
};

function perRoundDefinition(): WeaponDefinition {
	return {
		...rifleDefinition,
		id: "runtime-test-per-round",
		magazineSize: 6,
		autoReloadOnEmpty: false,
		fireMode: "semiAutomatic",
		reload: {
			type: "perRound",
			firstRoundDuration: 0.4,
			roundDuration: 0.3,
			finishDuration: 0,
			allowFireInterrupt: true,
			cancelOnWeaponSwitch: true,
		},
	};
}

describe("WeaponRuntime", () => {
	test("keeps definitions immutable and the rifle fully specified", () => {
		expect(Object.isFrozen(rifleDefinition)).toBe(true);
		expect(Object.isFrozen(rifleDefinition.reload)).toBe(true);
		expect(rifleDefinition.projectile).toEqual({ type: "hitscan", range: 80 });
		expect(ScopeRegistry.require(rifleDefinition.opticId).magnification).toBe(
			1.25,
		);
	});

	test("automatic fire consumes ammunition at the configured RPM", () => {
		const runtime = new WeaponRuntime(rifleDefinition);
		let shots = 0;
		for (let index = 0; index < 119; index += 1) {
			shots += runtime.update(1 / 120, {
				...IDLE,
				primaryFireHeld: true,
			}).length;
		}
		expect(shots).toBe(8);
		expect(runtime.state.ammoInMagazine).toBe(22);
		expect(runtime.definition.roundsPerMinute).toBe(480);
	});

	test("empty magazines never create fire commands", () => {
		const runtime = new WeaponRuntime(rifleDefinition);
		runtime.state.ammoInMagazine = 0;
		expect(runtime.update(1 / 60, { ...IDLE, primaryFireHeld: true })).toEqual(
			[],
		);
	});

	test("pressing reload starts a magazine reload", () => {
		const runtime = new WeaponRuntime(rifleDefinition);
		runtime.state.ammoInMagazine = 7;
		runtime.update(1 / 60, { ...IDLE, reloadPressed: true });
		expect(runtime.state.reloadState.type).toBe("magazine");
		expect(runtime.state.ammoInMagazine).toBe(7);
	});

	test("the rifle automatically reloads after firing its final round", () => {
		const runtime = new WeaponRuntime(rifleDefinition);
		runtime.state.ammoInMagazine = 1;
		const commands = runtime.update(1 / 60, {
			...IDLE,
			primaryFireHeld: true,
		});
		expect(commands).toHaveLength(1);
		expect(runtime.state.ammoInMagazine).toBe(0);
		expect(runtime.state.reloadState.type).toBe("magazine");
	});

	test("magazine reload applies ammunition only after the full duration", () => {
		const runtime = new WeaponRuntime(rifleDefinition);
		runtime.state.ammoInMagazine = 7;
		expect(runtime.startReload()).toBe(true);
		runtime.update(1.59, IDLE);
		expect(runtime.state.ammoInMagazine).toBe(7);
		expect(runtime.update(0.005, { ...IDLE, primaryFireHeld: true })).toEqual(
			[],
		);
		expect(runtime.state.ammoInMagazine).toBe(7);
		runtime.update(0.01, IDLE);
		expect(runtime.state.ammoInMagazine).toBe(30);
		expect(runtime.state.reloadState.type).toBe("idle");
		expect(runtime.startReload()).toBe(false);
	});

	test("per-round reload inserts only missing rounds", () => {
		const runtime = new WeaponRuntime(perRoundDefinition());
		runtime.state.ammoInMagazine = 3;
		runtime.startReload();
		runtime.update(0.39, IDLE);
		expect(runtime.state.ammoInMagazine).toBe(3);
		runtime.update(0.01, IDLE);
		expect(runtime.state.ammoInMagazine).toBe(4);
		runtime.update(0.3, IDLE);
		expect(runtime.state.ammoInMagazine).toBe(5);
		runtime.update(0.3, IDLE);
		expect(runtime.state.ammoInMagazine).toBe(6);
		expect(runtime.state.reloadState.type).toBe("idle");
	});

	test("per-round fire interrupts as soon as one round is available", () => {
		const runtime = new WeaponRuntime(perRoundDefinition());
		runtime.state.ammoInMagazine = 0;
		runtime.startReload();
		runtime.update(0.4, IDLE);
		expect(runtime.state.ammoInMagazine).toBe(1);
		const commands = runtime.update(1 / 60, {
			...IDLE,
			primaryFirePressed: true,
		});
		expect(commands).toHaveLength(1);
		expect(runtime.state.ammoInMagazine).toBe(0);
		expect(runtime.state.reloadState.type).toBe("idle");
	});

	test("ADS is gameplay state and semi-auto requires a press", () => {
		const runtime = new WeaponRuntime(perRoundDefinition());
		expect(runtime.update(1 / 60, { ...IDLE, aimHeld: true }).length).toBe(0);
		expect(runtime.state.aiming).toBe(true);
		expect(runtime.update(1, { ...IDLE, primaryFireHeld: true }).length).toBe(
			0,
		);
		expect(
			runtime.update(1 / 60, { ...IDLE, primaryFirePressed: true }).length,
		).toBe(1);
	});

	test("projectile definitions produce velocity without fake hitscan speed", () => {
		const launch = createProjectileLaunch({
			weaponId: "test",
			sequence: 1,
			simulationTick: 1,
			origin: { x: 1, y: 2, z: 3 },
			direction: { x: 0, y: 0, z: -2 },
			projectile: { type: "projectile", speed: 50, gravity: 9.81, lifetime: 2 },
		});
		expect(launch.velocity).toEqual({ x: 0, y: 0, z: -50 });
		expect(launch.lifetimeRemaining).toBe(2);
	});

	test("scope FOV produces the requested apparent magnification", () => {
		const lensAngularSize = 16.6;
		const scopeFov = magnifiedFovDegrees(lensAngularSize, 1.25);
		const apparentMagnification =
			Math.tan((lensAngularSize * Math.PI) / 360) /
			Math.tan((scopeFov * Math.PI) / 360);
		expect(apparentMagnification).toBeCloseTo(1.25, 8);
	});

	test("scope magnification derives from the lens angular size", () => {
		// Optical-center sharing is structural (ScopeLens copies the main
		// camera transform); here we pin the definition-driven FOV math.
		const lensAngularSize = lensAngularFovDegrees(0.046, 0.315);
		expect(lensAngularSize).toBeGreaterThan(0);
		expect(lensAngularSize).toBeLessThan(90);
		const scopeFov = magnifiedFovDegrees(lensAngularSize, 1.25);
		expect(scopeFov).toBeLessThan(lensAngularSize);
		const apparentMagnification =
			Math.tan((lensAngularSize * Math.PI) / 360) /
			Math.tan((scopeFov * Math.PI) / 360);
		expect(apparentMagnification).toBeCloseTo(1.25, 8);
	});
});
