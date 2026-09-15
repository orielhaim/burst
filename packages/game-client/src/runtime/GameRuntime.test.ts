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

test("knife damages a character hit region in front of the player", () => {
	const { runtime, step } = setup();
	// Stand a target slightly forward of spawn so the sphere cast can miss
	// world geo but the region cast still connects.
	runtime.characters.update(
		"target",
		1 / 60,
		{
			feet: { x: 0, y: 0, z: -1.0 },
			motion: {
				grounded: true,
				crouched: false,
				sliding: false,
				sprinting: false,
				horizontalSpeed: 0,
				velocity: { x: 0, y: 0, z: 0 },
				wallNormal: null,
			} as never,
			aimYaw: 0,
			aimPitch: 0,
			ads: 0,
			hands: {
				primary: { x: 0, y: 1.2, z: -1.0 },
				support: { x: 0, y: 1.2, z: -1.0 },
			},
		},
		() => ({
			position: { x: 0, y: 0.045, z: -1.0 },
			normal: { x: 0, y: 1, z: 0 },
		}),
		runtime.equipment.melee.definition,
		{ position: { x: 0, y: 1.2, z: -1.0 }, yaw: 0, pitch: 0 },
	);
	const impacts: Array<{ actorId?: string; damage: number }> = [];
	runtime.onImpact((event) => impacts.push(event));
	step({ meleePressed: true, meleeHeld: true });
	step({}, 30);
	const characterHits = impacts.filter((event) => event.actorId === "target");
	expect(characterHits.length).toBe(1);
	expect(characterHits[0]!.damage).toBe(runtime.equipment.melee.definition.damage);
	expect(runtime.characters.actors.get("target")!.health).toBeLessThan(100);
});

test("muzzle-offset projectiles converge on the sight line at close range", () => {
	const { runtime, step } = setup();
	runtime.recoilScale = 0;
	step({}, 15);
	const impacts: Array<{ point: { x: number; y: number; z: number } }> = [];
	runtime.onImpact((event) => impacts.push(event));
	const eyeY = runtime.cam.eye.y;
	step({ primaryFirePressed: true, primaryFireHeld: true });
	step({}, 5);
	expect(impacts.length).toBe(1);
	expect(Math.abs(impacts[0]!.point.y - eyeY)).toBeLessThan(0.06);
});

test("recoil changes the actual projectile impact along with the sight", () => {
	const shoot = (pitch: number) => {
		const { runtime, step } = setup();
		runtime.recoilScale = 0;
		step({}, 15);
		let height = 0;
		runtime.onImpact((event) => {
			height = event.point.y;
		});
		runtime.camera.addRecoil(pitch, 0);
		step({ primaryFirePressed: true, primaryFireHeld: true });
		step({}, 5);
		return height;
	};
	expect(shoot(0.1) - shoot(0)).toBeGreaterThan(0.09);
});
