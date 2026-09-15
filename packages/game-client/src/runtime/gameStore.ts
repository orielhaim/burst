import { create } from "zustand";
import type { DebugSnapshot, UiSnapshot } from "../core/types";
import type { GameRuntime } from "./GameRuntime";

export const DEFAULT_UI: UiSnapshot = {
	phase: "menu",
	loadout: [],
	selectedWeaponId: "",
	meleeEquipped: false,
	ammo: 0,
	magazineSize: 0,
	reloading: false,
	reloadPhase: "idle",
	reloadProgress: 0,
	aiming: false,
	adsProgress: 0,
	health: 100,
	maxHealth: 100,
	fps: 0,
	weaponName: "",
	abilityId: "grapple",
	abilityName: "Grapple",
	abilityReady: true,
	abilityCooldown: 0,
	abilityCooldownDuration: 0,
	abilityPulling: false,
};

type GameStore = {
	ui: UiSnapshot;
	debug: DebugSnapshot | null;
	/** Active runtime instance (set by RuntimeBootstrap, cleared on unmount). */
	runtime: GameRuntime | null;
	setUi: (ui: UiSnapshot) => void;
	setDebug: (debug: DebugSnapshot) => void;
	setRuntime: (runtime: GameRuntime | null) => void;
};

function sameUi(a: UiSnapshot, b: UiSnapshot): boolean {
	return (
		a.phase === b.phase &&
		a.selectedWeaponId === b.selectedWeaponId &&
		a.meleeEquipped === b.meleeEquipped &&
		JSON.stringify(a.loadout) === JSON.stringify(b.loadout) &&
		a.ammo === b.ammo &&
		a.magazineSize === b.magazineSize &&
		a.reloading === b.reloading &&
		a.reloadPhase === b.reloadPhase &&
		Math.abs(a.reloadProgress - b.reloadProgress) < 0.004 &&
		a.aiming === b.aiming &&
		Math.abs(a.adsProgress - b.adsProgress) < 0.004 &&
		a.health === b.health &&
		a.maxHealth === b.maxHealth &&
		a.fps === b.fps &&
		a.weaponName === b.weaponName &&
		a.abilityId === b.abilityId &&
		a.abilityName === b.abilityName &&
		a.abilityReady === b.abilityReady &&
		a.abilityPulling === b.abilityPulling &&
		Math.abs(a.abilityCooldown - b.abilityCooldown) < 0.02
	);
}

/**
 * Low-frequency UI store. Simulation writes snapshots at ~10Hz; R3F/Canvas
 * state stays in mutable refs. HUD subscribes here — never to frame state.
 */
export const useGameStore = create<GameStore>((set) => ({
	ui: DEFAULT_UI,
	debug: null,
	runtime: null,
	setUi: (ui) => set((state) => (sameUi(state.ui, ui) ? state : { ui })),
	setDebug: (debug) => set({ debug }),
	setRuntime: (runtime) => set({ runtime }),
}));
