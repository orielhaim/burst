import { expect, test } from "bun:test";
import { EMPTY_INPUT_FRAME, type InputFrame } from "../core/types";
import {
	primaryLoadout,
	knifeDefinition,
	shotgunDefinition,
	sniperDefinition,
	smgDefinition,
} from "./definitions/loadout";
import { WeaponLoadout } from "./WeaponLoadout";
import { WeaponRuntime, type WeaponIntent } from "./WeaponRuntime";
import { ScopeRegistry } from "./optics/ScopeRegistry";
import { MeleeRuntime } from "./MeleeRuntime";
const idle: WeaponIntent = {
	primaryFireHeld: false,
	primaryFirePressed: false,
	reloadPressed: false,
	aimHeld: false,
	origin: { x: 0, y: 0, z: 0 },
	direction: { x: 0, y: 0, z: -1 },
};
function advance(
	loadout: WeaponLoadout,
	count: number,
	input: Partial<InputFrame> = {},
) {
	for (let i = 0; i < count; i++)
		loadout.update(1 / 60, { ...EMPTY_INPUT_FRAME, ...input });
}

test("all primary definitions fire, with distinct optics and persistent ammo", () => {
	const loadout = new WeaponLoadout(primaryLoadout, knifeDefinition);
	for (const weapon of loadout.primaries) {
		const shots = weapon.update(1 / 60, {
			...idle,
			primaryFireHeld: true,
			primaryFirePressed: true,
		});
		expect(shots.length).toBe(weapon.definition.pellets);
		expect(shots.every((shot) => shot.weaponId === weapon.definition.id)).toBe(
			true,
		);
		expect(weapon.state.ammoInMagazine).toBe(
			weapon.definition.magazineSize - 1,
		);
	}
	expect(ScopeRegistry.require(primaryLoadout[0].opticId).magnification).toBe(
		1.25,
	);
	expect(ScopeRegistry.require(smgDefinition.opticId).magnification).toBe(1);
	expect(ScopeRegistry.require(sniperDefinition.opticId).magnification).toBe(6);
});

test("wheel wraps only primaries and held ADS must release before aiming again", () => {
	const loadout = new WeaponLoadout(primaryLoadout, knifeDefinition);
	for (let index = 1; index <= 4; index++) {
		loadout.update(1 / 60, {
			...EMPTY_INPUT_FRAME,
			weaponCycle: 1,
			aimHeld: true,
		});
		expect(loadout.canAim).toBe(false);
		advance(loadout, 40, { aimHeld: true });
		expect(loadout.selected).toBe(index % 4);
		expect(loadout.knifeEquipped).toBe(false);
		expect(loadout.canAim).toBe(false);
	}
	advance(loadout, 1);
	expect(loadout.canAim).toBe(true);
	loadout.update(1 / 60, { ...EMPTY_INPUT_FRAME, weaponCycle: -1 });
	advance(loadout, 40);
	expect(loadout.selected).toBe(3);
});

test("SMG repeats on hold, sniper requires another press, shotgun spreads eight pellets", () => {
	const smg = new WeaponRuntime(smgDefinition);
	const sniper = new WeaponRuntime(sniperDefinition);
	let smgShots = 0;
	let sniperShots = 0;
	for (let i = 0; i < 120; i++) {
		const intent = {
			...idle,
			primaryFireHeld: true,
			primaryFirePressed: i === 0,
		};
		smgShots += smg.update(1 / 60, intent).length;
		sniperShots += sniper.update(1 / 60, intent).length;
	}
	expect(smgShots).toBeGreaterThan(25);
	expect(sniperShots).toBe(1);
	const shotgun = new WeaponRuntime(shotgunDefinition);
	const pellets = shotgun.update(1 / 60, {
		...idle,
		primaryFireHeld: true,
		primaryFirePressed: true,
	});
	expect(pellets).toHaveLength(8);
	expect(
		new Set(pellets.map((p) => JSON.stringify(p.direction))).size,
	).toBeGreaterThan(1);
	expect(shotgun.state.ammoInMagazine).toBe(4);
});

test("shotgun inserts only missing shells and firing interrupts immediately", () => {
	const shotgun = new WeaponRuntime(shotgunDefinition);
	shotgun.state.ammoInMagazine = 3;
	shotgun.startReload();
	shotgun.update(0.55, idle);
	expect(shotgun.state.ammoInMagazine).toBe(4);
	shotgun.update(0.45, idle);
	expect(shotgun.state.ammoInMagazine).toBe(5);
	expect(shotgun.state.reloadState.type).toBe("idle");
	shotgun.state.ammoInMagazine = 1;
	shotgun.startReload();
	expect(
		shotgun.update(0.01, { ...idle, primaryFirePressed: true }).length,
	).toBe(8);
	expect(shotgun.state.reloadState.type).toBe("idle");
	expect(shotgun.state.ammoInMagazine).toBe(0);
});

test("tap F attacks once and returns, hold F remains equipped and primary fire repeats", () => {
	const quick = new WeaponLoadout(primaryLoadout, knifeDefinition);
	quick.update(1 / 60, {
		...EMPTY_INPUT_FRAME,
		meleePressed: true,
		meleeHeld: true,
	});
	let hitWindows = 0;
	for (let i = 0; i < 80; i++)
		if (quick.update(1 / 60, EMPTY_INPUT_FRAME)) hitWindows++;
	expect(hitWindows).toBeGreaterThan(0);
	expect(quick.knifeEquipped).toBe(false);
	expect(quick.selected).toBe(0);
	const held = new WeaponLoadout(primaryLoadout, knifeDefinition);
	held.update(1 / 60, {
		...EMPTY_INPUT_FRAME,
		meleePressed: true,
		meleeHeld: true,
	});
	advance(held, 80, { meleeHeld: true });
	expect(held.knifeEquipped).toBe(true);
	let attacks = 0;
	for (let i = 0; i < 120; i++)
		if (held.update(1 / 60, { ...EMPTY_INPUT_FRAME, primaryFireHeld: true })) {
			attacks++;
			held.melee.confirmHit();
		}
	expect(attacks).toBeGreaterThanOrEqual(3);
	held.update(1 / 60, { ...EMPTY_INPUT_FRAME, weaponCycle: 1 });
	advance(held, 40);
	expect(held.knifeEquipped).toBe(false);
});

test("melee does no damage before windup and consumes one hit per swing", () => {
	const melee = new MeleeRuntime(knifeDefinition);
	melee.start();
	expect(melee.update(0.05)).toBe(false);
	expect(melee.update(0.06)).toBe(true);
	melee.confirmHit();
	expect(melee.update(0.02)).toBe(false);
});
