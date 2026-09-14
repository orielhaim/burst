import { rifleDefinition } from "./rifle";
import { WeaponRegistry } from "../WeaponRegistry";
import { ScopeRegistry } from "../optics/ScopeRegistry";
import { optic125x } from "../optics/scopes/optic-1_25x";
import type {
	MeleeDefinition,
	WeaponViewModelDefinition,
} from "../WeaponDefinition";

const reflex = ScopeRegistry.register({
	...optic125x,
	id: "reflex-1x",
	name: "Reflex",
	magnification: 1,
	housing: { radius: 0.052, length: 0.065 },
});
const precision = ScopeRegistry.register({
	...optic125x,
	id: "precision-6x",
	name: "Precision 6x",
	magnification: 6,
	lens: { radius: 0.052, renderResolutionScale: 0.65 },
	housing: { radius: 0.064, length: 0.24 },
});

function model(
	length: number,
	width: number,
	magazine: number,
): WeaponViewModelDefinition {
	return {
		...rifleDefinition.viewModel,
		muzzlePosition: [0, 0.01, -length],
		obstruction: {
			...rifleDefinition.viewModel.obstruction,
			probes: [
				{ position: [0, 0, 0.12], radius: width },
				{ position: [0, 0.01, -length * 0.5], radius: width * 0.7 },
				{ position: [0, 0.01, -length], radius: width * 0.5 },
			],
		},
		parts: [
			{
				type: "box",
				size: [width, 0.12, length * 0.7],
				position: [0, 0, 0],
				material: "body",
			},
			{
				type: "box",
				size: [width * 0.55, 0.06, length * 0.7],
				position: [0, 0.01, -length * 0.65],
				material: "body",
			},
			{
				type: "box",
				size: [0.09, 0.13, 0.3],
				position: [0, -0.02, 0.3],
				material: "grip",
			},
			{
				type: "box",
				size: [width * 0.8, 0.08, length * 0.3],
				position: [0, -0.045, -length * 0.35],
				material: "grip",
			},
			{
				type: "box",
				animationSlot: "magazine",
				size: [0.065, magazine, 0.1],
				position: [0, -0.12, -0.05],
				material: "accent",
			},
		],
	};
}
export const smgDefinition = WeaponRegistry.register({
	...rifleDefinition,
	id: "smg",
	name: "SMG",
	damage: 14,
	magazineSize: 36,
	roundsPerMinute: 900,
	projectile: { type: "hitscan", range: 45 },
	hipSpread: 0.035,
	adsSpread: 0.012,
	opticId: reflex.id,
	ads: {
		enterDuration: 0.12,
		exitDuration: 0.1,
		movementSpeedMultiplier: 0.92,
	},
	reload: { type: "magazine", duration: 1.35, cancelOnWeaponSwitch: true },
	equip: { lowerDuration: 0.09, raiseDuration: 0.12 },
	recoil: {
		hip: { cameraPitch: 0.008, cameraYaw: 0.006, visualKick: 0.8 },
		ads: { cameraPitch: 0.006, cameraYaw: 0.004, visualKick: 0.6 },
	},
	motion: {
		...rifleDefinition.motion,
		inertia: 0.6,
		response: 38,
		recoilDistance: 0.025,
	},
	viewModel: model(0.4, 0.095, 0.23),
});
export const sniperDefinition = WeaponRegistry.register({
	...rifleDefinition,
	id: "sniper",
	name: "Sniper",
	damage: 110,
	magazineSize: 5,
	roundsPerMinute: 48,
	fireMode: "semiAutomatic",
	projectile: { type: "hitscan", range: 180 },
	hipSpread: 0.055,
	adsSpread: 0.0005,
	opticId: precision.id,
	ads: {
		enterDuration: 0.38,
		exitDuration: 0.22,
		movementSpeedMultiplier: 0.55,
	},
	reload: { type: "magazine", duration: 2.6, cancelOnWeaponSwitch: true },
	equip: { lowerDuration: 0.16, raiseDuration: 0.28 },
	recoil: {
		hip: { cameraPitch: 0.06, cameraYaw: 0.012, visualKick: 3.4 },
		ads: { cameraPitch: 0.045, cameraYaw: 0.008, visualKick: 2.8 },
	},
	motion: {
		...rifleDefinition.motion,
		inertia: 1.65,
		response: 16,
		recoilDistance: 0.065,
		recoilAngle: 0.22,
	},
	viewModel: model(0.95, 0.11, 0.09),
});
export const shotgunDefinition = WeaponRegistry.register({
	...rifleDefinition,
	id: "shotgun",
	name: "Shotgun",
	damage: 14,
	pellets: 8,
	magazineSize: 5,
	roundsPerMinute: 85,
	fireMode: "semiAutomatic",
	projectile: { type: "hitscan", range: 24 },
	hipSpread: 0.075,
	adsSpread: 0.052,
	opticId: reflex.id,
	autoReloadOnEmpty: false,
	ads: {
		enterDuration: 0.23,
		exitDuration: 0.16,
		movementSpeedMultiplier: 0.75,
	},
	reload: {
		type: "perRound",
		firstRoundDuration: 0.55,
		roundDuration: 0.45,
		finishDuration: 0,
		allowFireInterrupt: true,
		cancelOnWeaponSwitch: true,
	},
	equip: { lowerDuration: 0.13, raiseDuration: 0.2 },
	recoil: {
		hip: { cameraPitch: 0.04, cameraYaw: 0.01, visualKick: 2.8 },
		ads: { cameraPitch: 0.03, cameraYaw: 0.006, visualKick: 2.2 },
	},
	motion: {
		...rifleDefinition.motion,
		inertia: 1.2,
		response: 22,
		recoilDistance: 0.075,
		recoilAngle: 0.2,
	},
	viewModel: model(0.67, 0.15, 0.055),
});
export const knifeDefinition = WeaponRegistry.register<MeleeDefinition>({
	category: "melee",
	id: "knife",
	name: "Knife",
	damage: 65,
	range: 1.65,
	radius: 0.16,
	attackInterval: 0.5,
	windup: 0.1,
	hitWindow: 0.1,
	recovery: 0.22,
	holdThreshold: 0.24,
	swingDistance: 0.48,
	swingAngle: 0.9,
	equip: { lowerDuration: 0.07, raiseDuration: 0.08 },
	motion: { ...rifleDefinition.motion, inertia: 0.55, response: 36 },
	viewModel: {
		...model(0.3, 0.05, 0.05),
		parts: [
			{
				type: "box",
				size: [0.045, 0.045, 0.16],
				position: [0, 0, 0.05],
				material: "grip",
			},
			{
				type: "box",
				size: [0.11, 0.02, 0.025],
				position: [0, 0, -0.045],
				material: "body",
			},
			{
				type: "box",
				size: [0.045, 0.012, 0.28],
				position: [0, 0, -0.18],
				rotation: [0, 0.08, 0],
				material: "accent",
			},
		],
	},
});
export const primaryLoadout = [
	rifleDefinition,
	smgDefinition,
	sniperDefinition,
	shotgunDefinition,
] as const;
