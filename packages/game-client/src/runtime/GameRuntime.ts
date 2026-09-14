import { EMPTY_INPUT_FRAME, type GamePhase, type Vec3 } from "../core/types";
import { Input } from "../core/Input";

import type { CharacterPhysics } from "../physics/characterPhysics";
import {
	DEFAULT_MOVEMENT_CONFIG,
	type MovementConfig,
} from "../player/MovementConfig";
import { PlayerController } from "../player/PlayerController";
import { LocomotionResponse } from "../sim/LocomotionResponse";
import { CameraState, DEFAULT_CAMERA_STATE_CONFIG } from "../sim/cameraState";
import { ProjectileSimulation } from "../weapons/fire/ProjectileFire";
import { resolveHitscan } from "../weapons/fire/HitscanFire";
import {
	primaryLoadout,
	knifeDefinition,
} from "../weapons/definitions/loadout";
import { WeaponLoadout } from "../weapons/WeaponLoadout";

import { WeaponObstruction } from "../weapons/view/WeaponObstruction";
import type { FireWeaponCommand } from "../weapons/WeaponDefinition";
import { useGameStore } from "./gameStore";

export type WeaponImpact = {
	weaponId: string;
	damage: number;
	point: Vec3;
	colliderHandle?: number;
};

export type ShotEvent = {
	id: number;
	/** Tracer start (view-model muzzle, world). */
	origin: Vec3;
	/** Tracer/impact end. */
	point: Vec3;
	normal: Vec3 | null;
	hit: boolean;
};

export type RuntimeOptions = {
	mapId: string;
	debug?: boolean;
};

/**
 * Mutable simulation orchestrator. Framework-independent: no Three.js, no
 * React, no R3F. React/R3F own composition and read low-frequency snapshots
 * from the zustand store; per-frame state lives here in plain fields.
 *
 * Intended future: input → local sim → network command → server sim →
 * snapshot → reconciliation → R3F presentation. Keep sim methods pure-ish
 * and decoupled from presentation for that move.
 */
export class GameRuntime {
	readonly input: Input;
	locomotion = new LocomotionResponse();
	readonly camera = new CameraState({ ...DEFAULT_CAMERA_STATE_CONFIG });
	readonly projectiles = new ProjectileSimulation();
	readonly equipment = new WeaponLoadout(primaryLoadout, knifeDefinition);
	get weapon() {
		return this.equipment.firearm;
	}
	/** Tunable at runtime by Leva (dev only). Production truth stays in code. */
	readonly movementConfig: MovementConfig = { ...DEFAULT_MOVEMENT_CONFIG };
	/** Scope render resolution scale override (dev only). Null = definition. */
	scopeResolutionScale: number | null = null;
	mapId: string;
	debug: boolean;
	/** Dev-only overrides (Leva). Null = code config. */
	fovOverride: number | null = null;
	adsSpeedScale = 1;
	recoilScale = 1;
	/** Speed FOV kick scale (Leva). 1 = default subtle fisheye at sprint. */
	fovKickScale = 1;
	/** Current kick in degrees, smoothed toward the speed target. */
	fovKick = 0;
	/** Dev diagnostics: rapier version/instance behind the active bridge. */
	physicsInfo: string | null = null;
	/** Dev inspection: live view-model refs (set by WeaponViewModel). */
	weaponNodes: Record<string, unknown> | null = null;

	phase: GamePhase = "menu";
	health = 100;
	maxHealth = 100;
	fps = 0;

	player: PlayerController | null = null;
	obstruction: WeaponObstruction | null = null;
	physics: CharacterPhysics | null = null;

	/** World-space eye position, updated every fixed step. */
	eye: Vec3 = { x: 0, y: 1.5, z: 0 };
	feet: Vec3 = { x: 0, y: 0, z: 0 };

	// —— camera snapshots for render interpolation ——
	// The sim runs at 60Hz but displays refresh faster; presenting the raw
	// fixed-step state judders. Each step stores the previous applied camera
	// transform, and the R3F camera interpolates between them using
	// renderAlpha (set per-frame by the driver from its accumulator).
	prevCam: { eye: Vec3; yaw: number; pitch: number } = {
		eye: { x: 0, y: 1.5, z: 0 },
		yaw: 0,
		pitch: 0,
	};
	cam: { eye: Vec3; yaw: number; pitch: number } = {
		eye: { x: 0, y: 1.5, z: 0 },
		yaw: 0,
		pitch: 0,
	};
	renderAlpha = 1;

	// —— presentation state (mutable, read per-frame by R3F components) ——
	adsProgress = 0;
	viewRecoil = 0;
	viewRecoilVelocity = 0;
	obstructionRetraction = 0;
	/** Signed sideways shift (camera space) away from crowding geometry. */
	obstructionLateral = 0;
	/** Last blocking normal from the obstruction probes (world space). */
	obstructionNormal: Vec3 | null = null;
	/** Written by WeaponViewModel from its muzzle anchor ref. */
	muzzleWorld: Vec3 | null = null;
	/** Written by WeaponViewModel from probe locals → world. */
	probeWorldPositions: Array<{ position: Vec3; radius: number }> | null = null;

	/** Drained by WorldEffects every frame. */
	shots: ShotEvent[] = [];
	private readonly impactListeners = new Set<(event: WeaponImpact) => void>();
	onImpact(listener: (event: WeaponImpact) => void): () => void {
		this.impactListeners.add(listener);
		return () => {
			this.impactListeners.delete(listener);
		};
	}
	private emitImpact(event: WeaponImpact): void {
		for (const listener of this.impactListeners) listener(event);
	}

	private shotId = 0;
	private uiEmitTimer = 0;
	private debugEmitTimer = 0;
	private readonly speedHistory: number[] = [];
	private lastUiForceKey = "";

	constructor(
		readonly canvas: HTMLCanvasElement,
		options: RuntimeOptions,
	) {
		this.mapId = options.mapId;
		this.debug = options.debug ?? false;
		this.input = new Input(canvas);
		this.input.setPointerLockListener((locked) => {
			if (!locked && this.phase === "playing") {
				this.setPhase("paused");
			} else if (locked && this.phase === "paused") {
				this.setPhase("playing");
			}
		});
	}

	get definition() {
		return this.weapon.definition;
	}

	attachInput(): void {
		this.input.attach();
	}

	detachInput(): void {
		this.input.detach();
		this.input.setPointerLockListener(undefined);
	}

	/** Called once the R3F `<Physics>` world bridge exists. */
	attachPhysics(physics: CharacterPhysics, spawn: Vec3, yaw: number): void {
		this.physics = physics;
		this.player = new PlayerController(physics, spawn, this.movementConfig);
		this.obstruction = new WeaponObstruction(
			physics,
			this.player.body,
			this.definition.viewModel.obstruction.returnSpeed,
		);
		this.camera.setYawPitch(yaw, 0);
		this.camera.resetPresentation();
		this.locomotion = new LocomotionResponse();
		this.fovKick = 0;
		this.adsProgress = 0;
		this.viewRecoil = 0;
		this.viewRecoilVelocity = 0;
		this.obstructionRetraction = 0;
		this.obstructionLateral = 0;
		this.obstructionNormal = null;
		this.snapCamera();
		this.emitUi(true);
	}

	/** Snap interpolation snapshots (spawn/teleport — never lerp across those). */
	snapCamera(): void {
		const recoil = this.camera.getRecoil();
		this.cam = {
			eye: { ...this.eye },
			yaw: this.camera.getYaw() + recoil.yaw + this.locomotion.aimYaw.value,
			pitch:
				this.camera.getPitch() + recoil.pitch + this.locomotion.aimPitch.value,
		};
		this.prevCam = {
			eye: { ...this.cam.eye },
			yaw: this.cam.yaw,
			pitch: this.cam.pitch,
		};
		this.renderAlpha = 1;
	}

	detachPhysics(): void {
		this.player = null;
		this.obstruction = null;
		this.physics = null;
		this.muzzleWorld = null;
		this.shots.length = 0;
		this.projectiles.clear();
	}

	play(): void {
		if (this.phase === "playing") return;
		this.setPhase("playing");
		this.input.requestPointerLock();
	}

	pause(): void {
		if (this.phase !== "playing") return;
		this.setPhase("paused");
		this.input.exitPointerLock();
	}

	resume(): void {
		if (this.phase !== "paused" && this.phase !== "menu") return;
		this.setPhase("playing");
		this.input.requestPointerLock();
	}

	private setPhase(phase: GamePhase): void {
		this.phase = phase;
		this.emitUi(true);
	}

	/** Fixed-step simulation. Called from the R3F driver with dt ≈ 1/60. */
	fixedUpdate(rawDt: number): void {
		const dt = Number.isFinite(rawDt)
			? Math.max(0, Math.min(rawDt, 1 / 20))
			: 0;
		const playing = this.phase === "playing";
		const frame = playing ? this.input.captureFrame() : EMPTY_INPUT_FRAME;
		const previousDefinition = this.equipment.definition.id;
		const meleeWindow = playing ? this.equipment.update(dt, frame) : false;
		if (this.equipment.switching || this.equipment.knifeEquipped)
			this.adsProgress = 0;
		if (previousDefinition !== this.equipment.definition.id) {
			this.viewRecoil = 0;
			this.viewRecoilVelocity = 0;
			this.muzzleWorld = null;
			this.emitUi(true);
		}

		if (playing) this.camera.applyLookDelta(frame.lookX, frame.lookY);

		if (this.player) {
			this.player.update(dt, {
				moveX: frame.moveX,
				moveY: frame.moveZ,
				jumpPressed: frame.jumpPressed,
				jumpHeld: frame.jumpHeld,
				sprintHeld: frame.sprintHeld && this.adsProgress <= 0.01,
				aimHeld: frame.aimHeld && this.equipment.canAim,
				lookPitch: this.camera.getPitch(),
				crouchHeld: frame.crouchHeld,
				crouchPressed: frame.crouchPressed,
				lookYaw: this.camera.getYaw(),
				movementSpeedMultiplier:
					frame.aimHeld && this.equipment.canAim
						? this.definition.ads.movementSpeedMultiplier
						: 1,
			});
			this.feet = this.player.getFeetPosition();
			const eyeHeight = this.camera.smoothEyeHeight(
				this.player.getCameraHeight(),
				dt,
			);
			this.eye = { x: this.feet.x, y: this.feet.y + eyeHeight, z: this.feet.z };
		}

		this.camera.updateRecoil(dt);

		// ADS + view-model recoil springs (presentation state, fixed rate).
		const aiming =
			playing &&
			frame.aimHeld &&
			this.equipment.canAim &&
			!this.player?.movement.sprinting;
		const adsDuration = aiming
			? this.definition.ads.enterDuration
			: this.definition.ads.exitDuration;
		const direction = aiming ? 1 : -1;
		const rate = adsDuration <= 0 ? 1 : (dt / adsDuration) * this.adsSpeedScale;
		this.adsProgress = clamp(this.adsProgress + direction * rate, 0, 1);
		this.viewRecoilVelocity += -this.viewRecoil * 120 * dt;
		this.viewRecoilVelocity *= Math.exp(-16 * dt);
		this.viewRecoil += this.viewRecoilVelocity * dt;

		if (this.player)
			this.locomotion.update(
				dt,
				this.player.movement,
				this.camera.getYaw(),
				this.camera.getPitch(),
				this.adsProgress,
			);
		const forward = this.camera.forward(
			this.locomotion.aimPitch.value,
			this.locomotion.aimYaw.value,
		);
		const canFire =
			playing && !this.equipment.switching && !this.equipment.knifeEquipped;
		const commands = canFire
			? this.weapon.update(dt, {
					primaryFireHeld: canFire && frame.primaryFireHeld,
					primaryFirePressed: canFire && frame.primaryFirePressed,
					aimHeld: aiming,
					reloadPressed: canFire && frame.reloadPressed,
					origin: { ...this.eye },
					direction: forward,
				})
			: [];
		if (playing)
			for (const weapon of this.equipment.primaries) {
				if (weapon !== this.weapon || !canFire) weapon.advance(dt);
			}
		for (const command of commands) this.fireWeapon(command);
		if (playing && this.physics && this.player)
			for (const event of this.projectiles.update(
				dt,
				this.physics,
				this.player.body,
			)) {
				this.shots.push({
					id: ++this.shotId,
					origin: event.origin,
					point: event.point,
					normal: event.normal,
					hit: event.normal !== null,
				});
				if (event.normal) this.emitImpact(event);
			}
		if (meleeWindow && this.physics && this.player) {
			const melee = this.equipment.melee;
			const hit = this.physics.castSphere(
				this.eye,
				forward,
				melee.definition.radius,
				melee.definition.range,
				this.player.body,
			);
			if (hit) {
				melee.confirmHit();
				const point = {
					x: this.eye.x + forward.x * hit.toi,
					y: this.eye.y + forward.y * hit.toi,
					z: this.eye.z + forward.z * hit.toi,
				};
				this.emitImpact({
					weaponId: melee.definition.id,
					damage: melee.definition.damage,
					point,
					colliderHandle: hit.colliderHandle,
				});
				this.shots.push({
					id: ++this.shotId,
					origin: point,
					point,
					normal: hit.normal,
					hit: true,
				});
			}
		}

		if (this.player) {
			this.speedHistory.push(this.player.movement.horizontalSpeed);
			if (this.speedHistory.length > 90) this.speedHistory.shift();
		}

		// Camera snapshot for render interpolation (includes this step's kicks).
		this.fovKick = this.locomotion.fov.value * this.fovKickScale;
		const recoil = this.camera.getRecoil();
		const nextCam = {
			eye: { ...this.eye },
			yaw: this.camera.getYaw() + recoil.yaw + this.locomotion.aimYaw.value,
			pitch:
				this.camera.getPitch() + recoil.pitch + this.locomotion.aimPitch.value,
		};
		const jumped =
			Math.hypot(
				nextCam.eye.x - this.cam.eye.x,
				nextCam.eye.y - this.cam.eye.y,
				nextCam.eye.z - this.cam.eye.z,
			) > 4;
		this.prevCam = jumped
			? { eye: { ...nextCam.eye }, yaw: nextCam.yaw, pitch: nextCam.pitch }
			: this.cam;
		this.cam = nextCam;
	}

	/** Render-rate bookkeeping: fps + low-frequency store snapshots. */
	frameTick(dt: number, fps: number): void {
		this.fps = fps;
		this.uiEmitTimer += dt;
		if (this.uiEmitTimer >= 0.1) {
			this.uiEmitTimer = 0;
			this.emitUi(false);
		}
		if (this.debug) {
			this.debugEmitTimer += dt;
			if (this.debugEmitTimer >= 0.15) {
				this.debugEmitTimer = 0;
				this.emitDebug();
			}
		}
	}

	/** Isolated so multiplayer can swap local resolution for server results. */
	resolveFire(command: FireWeaponCommand, muzzle: Vec3) {
		if (!this.physics || !this.player) return { command, hit: null, damage: 0 };
		if (command.projectile.type === "hitscan") {
			return resolveHitscan(
				command,
				this.definition.damage,
				this.physics,
				this.player.body,
				muzzle,
			);
		}
		return { command, hit: null, damage: 0 };
	}

	private fireWeapon(command: FireWeaponCommand): void {
		if (command.projectile.type === "projectile") {
			this.projectiles.launch(command, this.definition.damage);
			if ((command.pellet ?? 0) === 0) this.applyShotRecoil();
			return;
		}
		const forward = this.camera.forward(
			this.locomotion.aimPitch.value,
			this.locomotion.aimYaw.value,
		);
		const fallback = {
			x: this.eye.x + forward.x * 0.5,
			y: this.eye.y + forward.y * 0.5,
			z: this.eye.z + forward.z * 0.5,
		};
		const muzzle = this.muzzleWorld ?? fallback;
		const resolution = this.resolveFire(command, muzzle);
		const range = command.projectile.range;
		const end = resolution.hit
			? resolution.hit.point
			: {
					x: command.origin.x + command.direction.x * range,
					y: command.origin.y + command.direction.y * range,
					z: command.origin.z + command.direction.z * range,
				};
		this.shotId += 1;
		this.shots.push({
			id: this.shotId,
			origin: { ...muzzle },
			point: { ...end },
			normal: resolution.hit ? { ...resolution.hit.normal } : null,
			hit: resolution.hit !== null,
		});

		if (resolution.hit)
			this.emitImpact({
				weaponId: command.weaponId,
				damage: resolution.damage,
				point: resolution.hit.point,
				colliderHandle: resolution.hit.colliderHandle,
			});
		if ((command.pellet ?? 0) !== 0) return;
		this.applyShotRecoil();
	}

	private applyShotRecoil(): void {
		const recoil = this.weapon.state.aiming
			? this.definition.recoil.ads
			: this.definition.recoil.hip;
		this.camera.addRecoil(
			recoil.cameraPitch * this.recoilScale,
			(Math.random() - 0.5) * 2 * recoil.cameraYaw * this.recoilScale,
		);
		this.viewRecoilVelocity += recoil.visualKick * this.recoilScale;
	}

	private emitUi(force: boolean): void {
		const reload = this.weapon.reloadProgress;
		const key = `${this.phase}|${this.weapon.state.ammoInMagazine}|${this.weapon.state.reloadState.type}|${this.weapon.state.aiming}`;
		if (!force && key === this.lastUiForceKey) {
			// Still emit at cadence (adsProgress/fps animate); only skip store churn via dedupe there.
		}
		this.lastUiForceKey = key;
		useGameStore.getState().setUi({
			phase: this.phase,
			ammo: this.weapon.state.ammoInMagazine,
			magazineSize: this.definition.magazineSize,
			reloading: this.weapon.state.reloadState.type !== "idle",
			reloadPhase: reload.phase,
			reloadProgress: reload.progress,
			aiming: this.weapon.state.aiming,
			adsProgress: this.adsProgress,
			health: this.health,
			maxHealth: this.maxHealth,
			fps: Math.round(this.fps),
			weaponName: this.equipment.definition.name,
			selectedWeaponId: this.equipment.definition.id,
			meleeEquipped: this.equipment.knifeEquipped,
			loadout: this.equipment.primaries.map((weapon) => ({
				id: weapon.definition.id,
				name: weapon.definition.name,
				ammo: weapon.state.ammoInMagazine,
				capacity: weapon.definition.magazineSize,
			})),
		});
	}

	private emitDebug(): void {
		if (!this.player) return;
		const pos = this.player.getPosition();
		const vel = this.player.getVelocity();
		useGameStore.getState().setDebug({
			x: pos.x,
			y: pos.y,
			z: pos.z,
			vx: vel.x,
			vy: vel.y,
			vz: vel.z,
			grounded: this.player.isGrounded(),
			mode: this.player.movement.mode,
			horizontalSpeed: this.player.movement.horizontalSpeed,
			desiredSpeed: this.player.movement.desiredSpeed,
			acceleration: this.player.movement.acceleration,
			groundAngle: this.player.movement.groundAngle,
			timeAirborne: this.player.movement.timeAirborne,
			speedHistory: this.speedHistory.slice(),
			sprinting: this.player.movement.sprinting,
			crouching: this.player.movement.crouched,
			sliding: this.player.movement.sliding,
			wallNormal: this.player.movement.wallNormal,
			weaponRetraction: this.obstructionRetraction,
			weaponLateral: this.obstructionLateral,
			fps: Math.round(this.fps),
		});
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
