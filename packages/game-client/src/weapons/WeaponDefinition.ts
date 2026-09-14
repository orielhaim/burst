import type { ScopeDefinition } from "./optics/ScopeDefinition";

export type FireMode = "automatic" | "semiAutomatic";

/** Distances use world units, durations use seconds, and fire rate uses RPM. */
export type ProjectileDefinition =
	| { readonly type: "hitscan"; readonly range: number }
	| {
			readonly type: "projectile";
			readonly speed: number;
			readonly gravity: number;
			readonly lifetime: number;
	  };

export type ReloadDefinition =
	| {
			readonly type: "magazine";
			readonly duration: number;
			readonly cancelOnWeaponSwitch: boolean;
	  }
	| {
			readonly type: "perRound";
			readonly firstRoundDuration: number;
			readonly roundDuration: number;
			readonly finishDuration?: number;
			readonly allowFireInterrupt: boolean;
			readonly cancelOnWeaponSwitch: boolean;
	  };

export type RecoilProfile = {
	readonly cameraPitch: number;
	readonly cameraYaw: number;
	readonly visualKick: number;
};

export type RecoilDefinition = {
	readonly hip: RecoilProfile;
	readonly ads: RecoilProfile;
};

export type WeaponPose = {
	readonly position: readonly [number, number, number];
	readonly rotation: readonly [number, number, number];
};

export type WeaponPartDefinition =
	| {
			readonly animationSlot?: "magazine";
			readonly type: "box";
			readonly size: readonly [number, number, number];
			readonly position: readonly [number, number, number];
			readonly rotation?: readonly [number, number, number];
			readonly material: "body" | "accent" | "grip";
	  }
	| {
			readonly animationSlot?: "magazine";
			readonly type: "cylinder";
			readonly radius: number;
			readonly length: number;
			readonly position: readonly [number, number, number];
			readonly rotation?: readonly [number, number, number];
			readonly material: "body" | "accent" | "grip";
	  };

export type WeaponViewModelDefinition = {
	readonly hipPose: WeaponPose;
	readonly adsPose: WeaponPose;
	readonly muzzlePosition: readonly [number, number, number];
	readonly opticMount: WeaponPose;
	readonly obstruction: {
		readonly probes: ReadonlyArray<{
			readonly position: readonly [number, number, number];
			readonly radius: number;
		}>;
		readonly returnSpeed: number;
		readonly fullTiltRetraction: number;
		readonly maxDisplacement: number;
		readonly approachDistance: number;
	};
	readonly parts: readonly WeaponPartDefinition[];
};

export type EquipDefinition = {
	readonly lowerDuration: number;
	readonly raiseDuration: number;
};
export type MotionDefinition = {
	readonly inertia: number;
	readonly response: number;
	readonly recoilDistance: number;
	readonly recoilAngle: number;
	readonly switchDrop: number;
	readonly reloadTilt: number;
	readonly insertDistance: number;
};

export interface WeaponDefinition {
	readonly category: "firearm";
	readonly pellets: number;
	readonly equip: EquipDefinition;
	readonly motion: MotionDefinition;
	readonly id: string;
	readonly name: string;
	readonly damage: number;
	readonly fireMode: FireMode;
	readonly roundsPerMinute: number;
	readonly projectile: ProjectileDefinition;
	readonly magazineSize: number;
	/** When true, reaching zero rounds starts the configured reload state machine. */
	readonly autoReloadOnEmpty: boolean;
	readonly reload: ReloadDefinition;
	readonly hipSpread: number;
	readonly adsSpread: number;
	readonly recoil: RecoilDefinition;
	readonly ads: {
		readonly enterDuration: number;
		readonly exitDuration: number;
		readonly movementSpeedMultiplier: number;
	};
	readonly opticId: ScopeDefinition["id"];
	readonly viewModel: WeaponViewModelDefinition;
}

export type FireWeaponCommand = {
	pellet?: number;
	weaponId: string;
	sequence: number;
	simulationTick: number;
	origin: { x: number; y: number; z: number };
	direction: { x: number; y: number; z: number };
	projectile: ProjectileDefinition;
};

export type FireHit = {
	colliderHandle?: number;
	point: { x: number; y: number; z: number };
	normal: { x: number; y: number; z: number };
	distance: number;
};

export type FireResolution = {
	command: FireWeaponCommand;
	hit: FireHit | null;
	damage: number;
};

export interface MeleeDefinition {
	readonly category: "melee";
	readonly id: string;
	readonly name: string;
	readonly damage: number;
	readonly range: number;
	readonly radius: number;
	readonly attackInterval: number;
	readonly windup: number;
	readonly hitWindow: number;
	readonly recovery: number;
	readonly holdThreshold: number;
	readonly swingDistance: number;
	readonly swingAngle: number;
	readonly equip: EquipDefinition;
	readonly motion: MotionDefinition;
	readonly viewModel: WeaponViewModelDefinition;
}
export type AnyWeaponDefinition = WeaponDefinition | MeleeDefinition;
