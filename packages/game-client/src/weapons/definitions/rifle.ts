import { optic125x } from "../optics/scopes/optic-1_25x";
import { WeaponRegistry } from "../WeaponRegistry";

export const rifleDefinition = WeaponRegistry.register({
	id: "rifle",
	category: "firearm",
	pellets: 1,
	equip: { lowerDuration: 0.12, raiseDuration: 0.18 },
	motion: {
		inertia: 1,
		response: 28,
		recoilDistance: 0.04,
		recoilAngle: 0.15,
		switchDrop: 0.4,
		reloadTilt: 0.28,
		insertDistance: 0.09,
	},
	name: "Rifle",
	fireMode: "automatic",
	roundsPerMinute: 480,
	projectile: {
		muzzleVelocity: 850,
		mass: 0.004,
		ballisticCoefficient: 500,
		baseDamage: 22,
		headshotMultiplier: 2,
	},
	magazineSize: 30,
	autoReloadOnEmpty: true,
	reload: {
		type: "magazine",
		duration: 1.6,
		cancelOnWeaponSwitch: true,
	},
	hipSpread: 0.012,
	adsSpread: 0.006,
	recoil: {
		hip: { cameraPitch: 0.0054, cameraYaw: 0.0018, visualKick: 2.88 },
		ads: { cameraPitch: 0.00405, cameraYaw: 0.00135, visualKick: 1.92 },
	},
	ads: {
		enterDuration: 0.18,
		exitDuration: 0.15,
		movementSpeedMultiplier: 0.82,
	},
	opticId: optic125x.id,
	viewModel: {
		hipPose: {
			position: [0.22, -0.2, -0.45],
			rotation: [0, 0.04, -0.03],
		},
		adsPose: {
			position: [0, -0.095, -0.34],
			rotation: [0, 0, 0],
		},
		primaryGrip: [0, -0.08, 0.08],
		supportGrip: [0, -0.04, -0.32],
		loadingPoint: [0, -0.18, -0.08],
		muzzlePosition: [0, 0.01, -0.68],
		opticMount: {
			position: [0, 0.095, -0.05],
			rotation: [0, 0, 0],
		},
		obstruction: {
			probes: [
				{ position: [0, 0, 0.12], radius: 0.13 },
				{ position: [0, 0.01, -0.38], radius: 0.075 },
				{ position: [0, 0.01, -0.68], radius: 0.045 },
			],
			returnSpeed: 12,
			fullTiltRetraction: 0.72,
			maxDisplacement: 0.14,
			approachDistance: 0.12,
		},
		parts: [
			{
				type: "box",
				size: [0.1, 0.1, 0.55],
				position: [0, 0, 0],
				material: "body",
			},
			{
				type: "box",
				size: [0.04, 0.04, 0.42],
				position: [0, 0.01, -0.42],
				material: "body",
			},
			{
				type: "box",
				size: [0.05, 0.05, 0.06],
				position: [0, 0.01, -0.64],
				material: "accent",
			},
			{
				type: "box",
				size: [0.08, 0.12, 0.28],
				position: [0, -0.02, 0.36],
				material: "grip",
			},
			{
				type: "box",
				size: [0.07, 0.18, 0.1],
				position: [0, -0.12, 0.08],
				material: "grip",
			},
			{
				type: "box",
				animationSlot: "magazine",
				size: [0.06, 0.16, 0.12],
				position: [0, -0.14, -0.08],
				material: "accent",
			},
		],
	},
});
