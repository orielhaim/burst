import type { Vec3 } from "@burst/game-core";

export type { Vec3 };

export type GamePhase = "menu" | "playing" | "paused";

export type InputFrame = {
	weaponCycle: number;
	meleePressed: boolean;
	meleeHeld: boolean;
	moveX: number;
	moveZ: number;
	jumpPressed: boolean;
	jumpHeld: boolean;
	primaryFireHeld: boolean;
	primaryFirePressed: boolean;
	primaryFireReleased: boolean;
	aimHeld: boolean;
	aimPressed: boolean;
	aimReleased: boolean;
	sprintHeld: boolean;
	crouchHeld: boolean;
	crouchPressed: boolean;
	reloadPressed: boolean;
	specialAbilityPressed: boolean;
	lookX: number;
	lookY: number;
};

export const EMPTY_INPUT_FRAME: InputFrame = {
	weaponCycle: 0,
	meleePressed: false,
	meleeHeld: false,
	moveX: 0,
	moveZ: 0,
	jumpPressed: false,
	jumpHeld: false,
	primaryFireHeld: false,
	primaryFirePressed: false,
	primaryFireReleased: false,
	aimHeld: false,
	aimPressed: false,
	aimReleased: false,
	sprintHeld: false,
	crouchHeld: false,
	crouchPressed: false,
	reloadPressed: false,
	specialAbilityPressed: false,
	lookX: 0,
	lookY: 0,
};

export type UiSnapshot = {
	loadout: Array<{ id: string; name: string; ammo: number; capacity: number }>;
	selectedWeaponId: string;
	meleeEquipped: boolean;
	phase: GamePhase;
	ammo: number;
	magazineSize: number;
	reloading: boolean;
	reloadPhase: "idle" | "magazine" | "starting" | "inserting" | "finishing";
	reloadProgress: number;
	aiming: boolean;
	adsProgress: number;
	health: number;
	maxHealth: number;
	fps: number;
	weaponName: string;
	abilityId: string;
	abilityName: string;
	abilityReady: boolean;
	abilityCooldown: number;
	abilityCooldownDuration: number;
	abilityPulling: boolean;
};

export type DebugSnapshot = {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	grounded: boolean;
	mode: "grounded" | "airborne" | "crouching" | "sliding";
	horizontalSpeed: number;
	desiredSpeed: number;
	acceleration: number;
	groundAngle: number;
	timeAirborne: number;
	speedHistory: number[];
	sprinting: boolean;
	crouching: boolean;
	sliding: boolean;
	wallNormal: Vec3 | null;
	weaponRetraction: number;
	weaponLateral: number;
	fps: number;
};
