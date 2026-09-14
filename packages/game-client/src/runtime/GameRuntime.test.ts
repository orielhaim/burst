import { afterAll, beforeAll, expect, test } from "bun:test";
import { EMPTY_INPUT_FRAME, type InputFrame } from "../core/types";
import { PhysicsWorld, initRapier } from "../physics/PhysicsWorld";
import { GameRuntime } from "./GameRuntime";
import { useGameStore } from "./gameStore";
const worlds: PhysicsWorld[] = [];
beforeAll(initRapier);
afterAll(() => {
	for (const world of worlds) world.dispose();
});
function setup() {
	const runtime = new GameRuntime({} as HTMLCanvasElement, { mapId: "test" });
	const physics = new PhysicsWorld();
	worlds.push(physics);
	physics.createStaticBox({
		position: { x: 0, y: -0.5, z: 0 },
		size: { x: 40, y: 1, z: 40 },
	});
	physics.createStaticBox({
		position: { x: 0, y: 1.5, z: -1.4 },
		size: { x: 4, y: 3, z: 0.1 },
	});
	physics.step(1 / 60);
	runtime.attachPhysics(physics, { x: 0, y: 0.9, z: 0 }, 0);
	runtime.phase = "playing";
	return {
		runtime,
		step(input: Partial<InputFrame> = {}, count = 1) {
			for (let i = 0; i < count; i++) {
				runtime.input.captureFrame = () => ({ ...EMPTY_INPUT_FRAME, ...input });
				runtime.fixedUpdate(1 / 60);
				physics.step(1 / 60);
				runtime.frameTick(0.11, 60);
			}
		},
	};
}

test("runtime switches the displayed HUD loadout and clears held ADS", () => {
	const { runtime, step } = setup();
	step({ aimHeld: true }, 20);
	expect(runtime.adsProgress).toBe(1);
	step({ weaponCycle: 1, aimHeld: true });
	expect(runtime.adsProgress).toBe(0);
	step({ aimHeld: true }, 40);
	expect(runtime.adsProgress).toBe(0);
	expect(useGameStore.getState().ui.selectedWeaponId).toBe(
		runtime.equipment.definition.id,
	);
	expect(useGameStore.getState().ui.loadout.map((weapon) => weapon.id)).toEqual(
		runtime.equipment.primaries.map((weapon) => weapon.definition.id),
	);
	step();
	step({ aimHeld: true }, 20);
	expect(runtime.adsProgress).toBe(1);
});

test("runtime emits one timed knife impact and returns to the firearm", () => {
	const { runtime, step } = setup();
	const impacts: number[] = [];
	const unsubscribe = runtime.onImpact((event) => impacts.push(event.damage));
	step({ meleePressed: true, meleeHeld: true });
	step({}, 90);
	expect(impacts).toEqual([runtime.equipment.melee.definition.damage]);
	expect(runtime.equipment.knifeEquipped).toBe(false);
	unsubscribe();
});
