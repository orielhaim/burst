import { WORLD_ENVIRONMENT } from "../sim/Environment";
import { CollisionLayer, interactionGroups } from "../physics/CollisionGroups";
import {
	EMPTY_INPUT_FRAME,
	type GameMode,
	type GamePhase,
	type Vec3,
} from "../core/types";
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
import { CharacterWorld } from "../character/CharacterWorld";
import { resolveWeaponAttachments } from "../character/WeaponAttachments";

import {
	primaryLoadout,
	knifeDefinition,
} from "../weapons/definitions/loadout";
import { WeaponLoadout } from "../weapons/WeaponLoadout";

import { WeaponObstruction } from "../weapons/view/WeaponObstruction";
import type { FireWeaponCommand } from "../weapons/WeaponDefinition";
import { AbilityRuntime, type AbilityPresentation } from "../abilities/AbilityRuntime";
import { grappleDefinition } from "../abilities/definitions";
import { useGameStore } from "./gameStore";
import {
	DEFAULT_MAP_ID,
	getMapBounds,
	getMapSpawns,
} from "../maps/definitions";
import { EntryDrop } from "./entryDrop";
import { DEFAULT_CHAOS_DROP_COUNT } from "../chaos/schedule";

export type WeaponImpact = {
	actorId?: string;
	region?: string;
	impactVelocity?: Vec3;
	timeOfFlight?: number;
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
	/** classic or chaos. Chaos rains stationery during parachute entry. */
	mode?: GameMode;
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
	readonly characters = new CharacterWorld(this.projectiles.regions);
	previewPlayer: PlayerController | null = null;
	private previewTime = 0;
	readonly equipment = new WeaponLoadout(primaryLoadout, knifeDefinition);
	get weapon() {
		return this.equipment.firearm;
	}
	/** Local character's Q special ability. Swap via `ability.equip(id)`. */
	readonly ability = new AbilityRuntime(grappleDefinition);
	private abilityUi: AbilityPresentation = {
		id: grappleDefinition.id,
		name: grappleDefinition.name,
		kind: "grapple",
		cooldownRemaining: 0,
		cooldownDuration: grappleDefinition.cooldown,
		ready: true,
		pulling: false,
		lineStart: null,
		lineEnd: null,
	};
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
	mode: GameMode = "classic";
	/** Parachute entry (top-down → land). */
	readonly entryDrop = new EntryDrop();
	/** Leave open routes between the physics-generated cover. */
	chaosDropCount = DEFAULT_CHAOS_DROP_COUNT;
	chaosSeed = 0;
	health = 100;
	maxHealth = 100;
	fps = 0;
	/** Times the local fighter has fallen off the desk this life. */
	fallDeaths = 0;
	private deathFlash = 0;

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
		if (event.actorId) {
			const incoming = event.impactVelocity ?? {
				x: event.point.x - this.eye.x,
				y: event.point.y - this.eye.y,
				z: event.point.z - this.eye.z,
			};
			this.characters.damage(event.actorId, event.damage, incoming);
			const target =
				event.actorId === "preview" ? this.previewPlayer : this.player;
			if (target && event.actorId !== "local") {
				const speed = Math.min(10, Math.max(1.2, event.damage * 0.08));
				const length = Math.hypot(incoming.x, incoming.z) || 1;
				target.applyImpulse({
					x: (incoming.x / length) * speed,
					y: Math.min(2.4, event.damage * 0.012),
					z: (incoming.z / length) * speed,
				});
			}
		}
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
		this.mode = options.mode ?? "classic";
		this.input = new Input(canvas);
		this.input.setPointerLockListener((locked) => {
			if (!locked && (this.phase === "playing" || this.phase === "dropping")) {
				this.setPhase("paused");
			} else if (locked && this.phase === "paused") {
				this.setPhase(this.entryDrop.active ? "dropping" : "playing");
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
		const bounds = getMapBounds(this.mapId);
		this.player.killZone = {
			killY: bounds.killY,
			respawn: { ...spawn },
		};
		// Desk map ships a movement demonstrator on the notebook.
		if (this.mapId === "desk-battlefield" || this.mapId === DEFAULT_MAP_ID) {
			this.previewPlayer = new PlayerController(
				physics,
				{ x: -3.5, y: 1.2, z: 5.5 },
				{ ...this.movementConfig },
			);
		}
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
		this.health = this.maxHealth;
		this.fallDeaths = 0;
		this.deathFlash = 0;
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

	/** Blended eye for render-rate presentation (same curve as PlayerCamera). */
	getRenderEye(): Vec3 {
		const t = this.renderAlpha;
		const a = this.prevCam.eye;
		const b = this.cam.eye;
		return {
			x: a.x + (b.x - a.x) * t,
			y: a.y + (b.y - a.y) * t,
			z: a.z + (b.z - a.z) * t,
		};
	}

	/** Shortest-arc blend of presentation yaw (recoil + locomotion included). */
	getRenderYaw(): number {
		const t = this.renderAlpha;
		const a = this.prevCam.yaw;
		const b = this.cam.yaw;
		let delta = b - a;
		if (delta > Math.PI) delta -= Math.PI * 2;
		if (delta < -Math.PI) delta += Math.PI * 2;
		return a + delta * t;
	}

	/**
	 * World attach point for ability cables — upper torso, not the eye.
	 * Fully interpolated (eye + yaw) so the cable does not step at 60 Hz.
	 */
	getAbilityAttach(): Vec3 {
		const eye = this.getRenderEye();
		const yaw = this.getRenderYaw();
		const forwardX = -Math.sin(yaw);
		const forwardZ = -Math.cos(yaw);
		return {
			x: eye.x + forwardX * 0.22,
			y: eye.y - 0.4,
			z: eye.z + forwardZ * 0.22,
		};
	}

	/** Fixed-step torso attach for sim queries (occlusion), not presentation. */
	private getSimAbilityAttach(): Vec3 {
		const recoil = this.camera.getRecoil();
		const yaw =
			this.camera.getYaw() + recoil.yaw + this.locomotion.aimYaw.value;
		const forwardX = -Math.sin(yaw);
		const forwardZ = -Math.cos(yaw);
		return {
			x: this.eye.x + forwardX * 0.22,
			y: this.eye.y - 0.4,
			z: this.eye.z + forwardZ * 0.22,
		};
	}

	detachPhysics(): void {
		this.player = null;
		this.obstruction = null;
		this.physics = null;
		this.muzzleWorld = null;
		this.shots.length = 0;
		this.projectiles.clear();
		this.characters.clear();
		this.previewPlayer = null;
		this.ability.reset();
		this.abilityUi = {
			id: this.ability.current.id,
			name: this.ability.current.name,
			kind: this.ability.current.kind,
			cooldownRemaining: 0,
			cooldownDuration: this.ability.current.cooldown,
			ready: true,
			pulling: false,
			lineStart: null,
			lineEnd: null,
		};
	}

	play(): void {
		if (this.phase === "playing" || this.phase === "dropping") return;
		// First launch: parachute from above. Resume never re-drops.
		if (this.phase === "menu" && this.player) {
			this.beginEntryDrop();
		} else {
			this.setPhase("playing");
		}
		this.input.requestPointerLock();
	}

	pause(): void {
		if (this.phase !== "playing" && this.phase !== "dropping") return;
		this.setPhase("paused");
		this.input.exitPointerLock();
	}

	resume(): void {
		if (this.phase !== "paused") return;
		// Resume mid-drop continues the parachute; otherwise normal play.
		if (this.entryDrop.active) this.setPhase("dropping");
		else this.setPhase("playing");
		this.input.requestPointerLock();
	}

	setMode(mode: GameMode): void {
		this.mode = mode;
		this.emitUi(true);
	}

	/**
	 * Start the parachute entry. Chaos Mode uses the same window to rain
	 * loose stationery across the desk (seeded so the field is unique).
	 */
	beginEntryDrop(): void {
		if (!this.player) {
			this.setPhase("playing");
			return;
		}
		const spawns = getMapSpawns(this.mapId);
		const pick =
			spawns[Math.floor(Math.random() * spawns.length)] ??
			{ position: { x: 0, y: 1.5, z: 0 }, yaw: 0 };
		const target = {
			position: { x: pick.position.x, y: pick.position.y, z: pick.position.z },
			yaw: pick.yaw,
		};
		this.player.killZone = {
			killY: getMapBounds(this.mapId).killY,
			respawn: { ...target.position },
		};
		this.chaosSeed = (Math.random() * 0x7fffffff) | 0;
		this.entryDrop.start(target);
		this.placePlayer(this.entryDrop.position);
		this.camera.setYawPitch(this.entryDrop.yaw, this.entryDrop.pitch);
		this.ability.reset();
		this.adsProgress = 0;
		this.health = this.maxHealth;
		this.updateEyeFromFeet();
		this.snapCamera();
		this.setPhase("dropping");
		this.emitUi(true);
	}

	private placePlayer(position: Vec3): void {
		if (!this.player) return;
		if (!this.player.teleport(position)) {
			// High-altitude path points can fail capsule search — force set.
			this.player.body.setTranslation(position, true);
		}
	}

	private updateEyeFromFeet(): void {
		if (!this.player) return;
		this.feet = this.player.getFeetPosition();
		const eyeHeight = this.player.getCameraHeight();
		this.eye = {
			x: this.feet.x,
			y: this.feet.y + eyeHeight,
			z: this.feet.z,
		};
	}

	/** The existing player capsule flies, collides, and becomes playable in place. */
	private updateEntryDrop(dt: number, frame: typeof EMPTY_INPUT_FRAME): boolean {
		if (!this.player) return false;
		this.camera.applyLookDelta(frame.lookX, frame.lookY);
		const velocity = this.entryDrop.flightVelocity(frame.moveX, frame.moveZ,
			this.camera.getYaw(), frame.sprintHeld, dt);
		this.player.update(dt, {
			moveX: frame.moveX, moveY: frame.moveZ, lookYaw: this.camera.getYaw(),
			jumpPressed: false, jumpHeld: false, sprintHeld: false,
			crouchHeld: false, crouchPressed: false, velocityOverride: velocity,
		});
		if (this.player.consumeFallDeath()) {
			this.beginEntryDrop();
			return false;
		}
		const finished = this.entryDrop.observe(this.player.getPosition(), this.player.isGrounded());
		this.updateEyeFromFeet();
		this.prevCam = this.cam;
		this.cam = { eye: { ...this.eye }, yaw: this.camera.getYaw(), pitch: this.camera.getPitch() };
		this.updateCharacters(dt);
		if (finished) {
			this.player.killZone = {
				killY: getMapBounds(this.mapId).killY,
				respawn: { ...this.player.getPosition() },
			};
			this.setPhase("playing");
		}
		return finished;
	}

	private setPhase(phase: GamePhase): void {
		this.phase = phase;
		this.emitUi(true);
	}

	/** Fixed-step simulation. Called from the R3F driver with dt ≈ 1/60. */
	fixedUpdate(rawDt: number): void {
		if (this.phase === "paused") return;
		const dt = Number.isFinite(rawDt)
			? Math.max(0, Math.min(rawDt, 1 / 20))
			: 0;

		// —— parachute entry ——
		if (this.phase === "dropping") {
			const dropFrame = this.input.captureFrame();
			this.updateEntryDrop(dt, dropFrame);
			return;
		}

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

		// Ability-owned motion runs first so PlayerController receives it as a
		// velocity override (no locomotion/gravity fight → no cable vibration).
		const abilityMotion =
			playing && this.player
				? this.ability.prepareMotion({
						jumpPressed: frame.jumpPressed,
						activated: frame.specialAbilityPressed,
						player: this.player,
						physics: this.physics,
						cableStart: this.getSimAbilityAttach(),
						moveX: frame.moveX,
						moveZ: frame.moveZ,
						lookYaw: this.camera.getYaw(),
					})
				: null;

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
				velocityOverride: abilityMotion,
			});
			if (this.player.consumeFallDeath()) this.handleFallDeath();
			this.feet = this.player.getFeetPosition();
			const eyeHeight = this.camera.smoothEyeHeight(
				this.player.getCameraHeight(),
				dt,
			);
			this.eye = { x: this.feet.x, y: this.feet.y + eyeHeight, z: this.feet.z };
		}
		if (this.deathFlash > 0) {
			this.deathFlash = Math.max(0, this.deathFlash - dt);
			if (this.deathFlash === 0 && this.health === 0) {
				this.health = this.maxHealth;
				this.emitUi(true);
			}
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
		this.updateCharacters(dt);
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
			const range = melee.definition.range;
			const delta = {
				x: forward.x * range,
				y: forward.y * range,
				z: forward.z * range,
			};
			// Characters use the same hit-region seam as projectiles; world uses a sphere cast.
			const characterHit = this.projectiles.regions.cast(
				this.eye,
				delta,
				"local",
			);
			const worldHit = this.physics.castSphere(
				this.eye,
				forward,
				melee.definition.radius,
				range,
				this.player.body,
			);
			const preferCharacter =
				characterHit && (!worldHit || characterHit.distance <= worldHit.toi);
			if (preferCharacter && characterHit) {
				melee.confirmHit();
				this.emitImpact({
					weaponId: melee.definition.id,
					damage: melee.definition.damage,
					actorId: characterHit.actorId,
					region: characterHit.region,
					point: characterHit.point,
				});
				this.shots.push({
					id: ++this.shotId,
					origin: { ...this.eye },
					point: characterHit.point,
					normal: characterHit.normal,
					hit: true,
				});
			} else if (worldHit) {
				melee.confirmHit();
				const point = {
					x: this.eye.x + forward.x * worldHit.toi,
					y: this.eye.y + forward.y * worldHit.toi,
					z: this.eye.z + forward.z * worldHit.toi,
				};
				this.emitImpact({
					weaponId: melee.definition.id,
					damage: melee.definition.damage,
					point,
					colliderHandle: worldHit.colliderHandle,
				});
				this.shots.push({
					id: ++this.shotId,
					origin: point,
					point,
					normal: worldHit.normal,
					hit: true,
				});
			}
		}

		// Special ability (Q): dash / grapple write velocity after locomotion
		// so the next fixed step starts from their result. Jump cancels a pull.
		if (playing && this.player) {
			this.abilityUi = this.ability.update({
				dt,
				activated: frame.specialAbilityPressed,
				jumpPressed: frame.jumpPressed,
				origin: { ...this.eye },
				direction: forward,
				player: this.player,
				physics: this.physics,
				cableStart: this.getSimAbilityAttach(),
			});
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

	private fireWeapon(command: FireWeaponCommand): void {
		const attachments = this.getWeaponAttachments();
		const muzzle = this.muzzleWorld ?? attachments.muzzle;
		// If the smoothed view model is temporarily inside cover, resolve its
		// muzzle to the near side before launching. No damage occurs at trigger time.
		const delta = {
			x: muzzle.x - this.eye.x,
			y: muzzle.y - this.eye.y,
			z: muzzle.z - this.eye.z,
		};
		const distance = Math.hypot(delta.x, delta.y, delta.z);
		const blocker =
			distance > 0
				? this.physics?.raycast(this.eye, delta, distance, this.player?.body)
				: null;
		const origin = blocker
			? {
					x: blocker.point.x - (delta.x / distance) * 0.01,
					y: blocker.point.y - (delta.y / distance) * 0.01,
					z: blocker.point.z - (delta.z / distance) * 0.01,
				}
			: muzzle;
		// The sight chooses a convergence point, never damage. Flight still starts
		// at the resolved muzzle and every hit is swept by the ballistic simulation.
		const sightRange = WORLD_ENVIRONMENT.sightRange;
		const sightHit = this.physics?.raycast(
			this.eye,
			command.direction,
			sightRange,
			this.player?.body,
		);
		const target = sightHit?.point ?? {
			x: this.eye.x + command.direction.x * sightRange,
			y: this.eye.y + command.direction.y * sightRange,
			z: this.eye.z + command.direction.z * sightRange,
		};
		const direction = {
			x: target.x - origin.x,
			y: target.y - origin.y,
			z: target.z - origin.z,
		};
		this.projectiles.launch({ ...command, origin: { ...origin }, direction });
		if ((command.pellet ?? 0) === 0) this.applyShotRecoil();
	}

	private getWeaponAttachments() {
		return resolveWeaponAttachments(
			this.equipment.definition,
			this.eye,
			this.camera.getYaw(),
			this.camera.getPitch(),
			this.adsProgress,
			this.equipment.lowered,
			this.obstructionRetraction,
			this.obstructionLateral,
			this.weapon.reloadProgress,
		);
	}

	private updateCharacters(dt: number): void {
		if (!this.physics || !this.player) return;
		const physics = this.physics;
		const ground = (position: Vec3) => {
			const hit = physics.raycast(
				{ x: position.x, y: position.y + 0.8, z: position.z },
				{ x: 0, y: -1, z: 0 },
				1.8,
				this.player!.body,
				interactionGroups(
					CollisionLayer.WEAPON_QUERY,
					CollisionLayer.WORLD_STATIC | CollisionLayer.WORLD_DYNAMIC,
				),
			);
			return hit && hit.normal.y > 0.55
				? {
						position: { ...hit.point, y: hit.point.y + 0.045 },
						normal: hit.normal,
					}
				: null;
		};
		const attachments = this.getWeaponAttachments();
		this.characters.update(
			"local",
			dt,
			{
				feet: this.feet,
				motion: this.player.movement,
				aimYaw: this.camera.getYaw(),
				aimPitch: this.camera.getPitch(),
				ads: this.adsProgress,
				hands: attachments,
				wallPush: this.player.movement.wallNormal,
				skydiving: this.entryDrop.active,
			},
			ground,
			this.equipment.definition,
			attachments.pose,
		);
		if (this.previewPlayer) this.updatePreview(dt, ground);
	}

	/** Movement demonstrator bot — used during play and parachute entry. */
	private updatePreview(
		dt: number,
		ground: (position: Vec3) => { position: Vec3; normal: Vec3 } | null,
	): void {
		if (!this.previewPlayer) return;
		const before = this.previewTime;
		this.previewTime += dt;
		const phase = Math.floor(this.previewTime / 2) % 8;
		const last = Math.floor(before / 2) % 8;
		const direction = [
			{ x: 1, y: 0 },
			{ x: 0, y: 1 },
			{ x: -1, y: 0 },
			{ x: 0, y: -1 },
		][phase % 4]!;
		this.previewPlayer.update(dt, {
			moveX: direction.x,
			moveY: direction.y,
			lookYaw: 0,
			sprintHeld: phase === 4 || phase === 5,
			crouchHeld: phase === 2,
			crouchPressed: phase === 5 && last !== phase,
			jumpHeld: false,
			jumpPressed: phase === 6 && last !== phase,
		});
		const feet = this.previewPlayer.getFeetPosition();
		const eye = {
			...feet,
			y: feet.y + this.previewPlayer.getCameraHeight(),
		};
		const weapon = this.equipment.primaries[0]!.definition;
		const pose = resolveWeaponAttachments(
			weapon,
			eye,
			0,
			0,
			phase === 3 ? 1 : 0,
			0,
			0,
			0,
			{ active: false, progress: 0 },
		);
		this.characters.update(
			"preview",
			dt,
			{
				feet,
				motion: this.previewPlayer.movement,
				aimYaw: 0,
				aimPitch: 0,
				ads: phase === 3 ? 1 : 0,
				hands: pose,
				wallPush: this.previewPlayer.movement.wallNormal,
			},
			ground,
			weapon,
			pose.pose,
		);
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

	/**
	 * Fell off the desk. Kill plane already teleported the body; this
	 * presents death (HP → 0, short flash) then restores the fighter.
	 */
	private handleFallDeath(): void {
		this.fallDeaths += 1;
		this.health = 0;
		this.deathFlash = 0.9;
		this.adsProgress = 0;
		this.ability.reset();
		this.snapCamera();
		this.emitUi(true);
	}

	private pickSpawn(): { position: Vec3; yaw: number } {
		const spawns = getMapSpawns(this.mapId);
		const pick = spawns[Math.floor(Math.random() * spawns.length)] ?? {
			position: { x: 0, y: 1.5, z: 0 },
			yaw: 0,
		};
		return {
			position: {
				x: pick.position.x,
				y: pick.position.y,
				z: pick.position.z,
			},
			yaw: pick.yaw,
		};
	}

	/** Soft respawn used by UI / future combat deaths. */
	respawnLocal(): void {
		if (!this.player) return;
		const spawn = this.pickSpawn();
		const bounds = getMapBounds(this.mapId);
		this.player.killZone = {
			killY: bounds.killY,
			respawn: { ...spawn.position },
		};
		this.player.teleport(spawn.position);
		this.health = this.maxHealth;
		this.deathFlash = 0;
		this.snapCamera();
		this.emitUi(true);
	}

	private emitUi(force: boolean): void {
		const reload = this.weapon.reloadProgress;
		const ability = this.abilityUi;
		const key = `${this.phase}|${this.weapon.state.ammoInMagazine}|${this.weapon.state.reloadState.type}|${this.weapon.state.aiming}|${ability.id}`;
		if (!force && key === this.lastUiForceKey) {
			// Still emit at cadence (adsProgress/fps animate); only skip store churn via dedupe there.
		}
		this.lastUiForceKey = key;
		useGameStore.getState().setUi({
			phase: this.phase,
			mode: this.mode,
			dropProgress: this.entryDrop.progress,
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
			abilityId: ability.id,
			abilityName: ability.name,
			abilityReady: ability.ready,
			abilityCooldown: ability.cooldownRemaining,
			abilityCooldownDuration: ability.cooldownDuration,
			abilityPulling: ability.pulling,
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
