import { applySpread } from "../physics/collision";
import type { Vec3 } from "../core/types";
import {
	getReloadProgress,
	type ReloadProgress,
	type ReloadState,
} from "./reload/ReloadState";
import type { FireWeaponCommand, WeaponDefinition } from "./WeaponDefinition";

export interface WeaponIntent {
	primaryFireHeld: boolean;
	primaryFirePressed: boolean;
	aimHeld: boolean;
	reloadPressed: boolean;
	origin: Vec3;
	direction: Vec3;
}

export interface WeaponRuntimeState {
	ammoInMagazine: number;
	firing: boolean;
	aiming: boolean;
	cooldownRemaining: number;
	reloadState: ReloadState;
}

export class WeaponRuntime {
	readonly state: WeaponRuntimeState;
	private sequence = 0;
	private simulationTick = 0;

	constructor(readonly definition: WeaponDefinition) {
		this.state = {
			ammoInMagazine: definition.magazineSize,
			firing: false,
			aiming: false,
			cooldownRemaining: 0,
			reloadState: { type: "idle" },
		};
	}

	advance(dt: number): void {
		this.state.cooldownRemaining = Math.max(
			0,
			this.state.cooldownRemaining - dt,
		);
		this.state.firing = false;
		this.state.aiming = false;
		this.updateReload(dt);
	}

	update(dt: number, intent: WeaponIntent): FireWeaponCommand[] {
		this.simulationTick += 1;
		this.state.aiming = intent.aimHeld;
		this.state.firing = false;
		this.state.cooldownRemaining =
			this.state.cooldownRemaining > 0 ? this.state.cooldownRemaining - dt : 0;
		if (intent.reloadPressed) this.startReload();
		this.updateReload(dt);
		this.startAutomaticReloadIfEmpty();
		const wantsFire =
			this.definition.fireMode === "automatic"
				? intent.primaryFireHeld
				: intent.primaryFirePressed;
		if (!wantsFire || !this.prepareReloadForFire()) return [];

		const commands: FireWeaponCommand[] = [];
		const interval = 60 / this.definition.roundsPerMinute;
		const shotLimit =
			this.definition.fireMode === "automatic" ? Number.POSITIVE_INFINITY : 1;
		while (
			this.state.cooldownRemaining <= 0 &&
			this.state.ammoInMagazine > 0 &&
			commands.length < shotLimit
		) {
			this.state.ammoInMagazine -= 1;
			this.state.cooldownRemaining += interval;
			this.state.firing = true;
			this.sequence += 1;
			for (let pellet = 0; pellet < this.definition.pellets; pellet++)
				commands.push({
					pellet,
					weaponId: this.definition.id,
					sequence: this.sequence,
					simulationTick: this.simulationTick,
					origin: { ...intent.origin },
					direction: applySpread(
						intent.direction,
						intent.aimHeld
							? this.definition.adsSpread
							: this.definition.hipSpread,
					),
					projectile: this.definition.projectile,
				});
		}
		this.startAutomaticReloadIfEmpty();
		return commands;
	}

	startReload(): boolean {
		if (this.state.reloadState.type !== "idle") return false;
		if (this.state.ammoInMagazine >= this.definition.magazineSize) return false;
		this.state.reloadState =
			this.definition.reload.type === "magazine"
				? { type: "magazine", elapsed: 0 }
				: { type: "perRound", phase: "starting", elapsed: 0 };
		return true;
	}

	cancelReloadForWeaponSwitch(): void {
		if (this.definition.reload.cancelOnWeaponSwitch)
			this.state.reloadState = { type: "idle" };
	}

	get reloadProgress(): ReloadProgress {
		return getReloadProgress(this.state.reloadState, this.definition.reload);
	}

	private updateReload(dt: number): void {
		const state = this.state.reloadState;
		const reload = this.definition.reload;
		if (state.type === "idle") return;
		state.elapsed += dt;
		if (state.type === "magazine" && reload.type === "magazine") {
			if (state.elapsed >= reload.duration) {
				this.state.ammoInMagazine = this.definition.magazineSize;
				this.state.reloadState = { type: "idle" };
			}
			return;
		}
		if (state.type !== "perRound" || reload.type !== "perRound") return;

		let duration =
			state.phase === "starting"
				? reload.firstRoundDuration
				: state.phase === "inserting"
					? reload.roundDuration
					: (reload.finishDuration ?? 0);
		while (state.elapsed >= duration) {
			state.elapsed -= duration;
			if (state.phase === "finishing") {
				this.state.reloadState = { type: "idle" };
				return;
			}
			this.state.ammoInMagazine = Math.min(
				this.definition.magazineSize,
				this.state.ammoInMagazine + 1,
			);
			if (this.state.ammoInMagazine >= this.definition.magazineSize) {
				if ((reload.finishDuration ?? 0) > 0) {
					state.phase = "finishing";
					if (state.elapsed >= (reload.finishDuration ?? 0))
						this.state.reloadState = { type: "idle" };
				} else {
					this.state.reloadState = { type: "idle" };
				}
				return;
			}
			state.phase = "inserting";
			duration = reload.roundDuration;
		}
	}

	private prepareReloadForFire(): boolean {
		const state = this.state.reloadState;
		if (state.type === "idle") return true;
		const reload = this.definition.reload;
		if (
			state.type === "perRound" &&
			reload.type === "perRound" &&
			reload.allowFireInterrupt &&
			this.state.ammoInMagazine > 0
		) {
			this.state.reloadState = { type: "idle" };
			return true;
		}
		return false;
	}

	private startAutomaticReloadIfEmpty(): void {
		if (
			this.definition.autoReloadOnEmpty &&
			this.state.ammoInMagazine === 0 &&
			this.state.reloadState.type === "idle"
		) {
			this.startReload();
		}
	}
}
