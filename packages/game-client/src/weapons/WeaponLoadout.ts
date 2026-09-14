import type { InputFrame } from "../core/types";
import type {
	AnyWeaponDefinition,
	MeleeDefinition,
	WeaponDefinition,
} from "./WeaponDefinition";
import { WeaponRuntime } from "./WeaponRuntime";
import { MeleeRuntime } from "./MeleeRuntime";

type SwitchState = {
	phase: "lower" | "raise";
	elapsed: number;
	duration: number;
	target: number | "melee";
};
export class WeaponLoadout {
	readonly primaries: WeaponRuntime[];
	readonly melee: MeleeRuntime;
	selected = 0;
	knifeEquipped = false;
	quickMelee = false;
	aimRequiresRelease = false;
	private switchState: SwitchState | null = null;
	private heldTime = 0;
	private holdIntent = false;
	private pendingAttack = false;
	constructor(
		definitions: readonly WeaponDefinition[],
		melee: MeleeDefinition,
	) {
		if (!definitions.length) throw new Error("Primary loadout cannot be empty");
		this.primaries = definitions.map((def) => new WeaponRuntime(def));
		this.melee = new MeleeRuntime(melee);
	}
	get firearm(): WeaponRuntime {
		return this.primaries[this.selected]!;
	}
	get definition(): AnyWeaponDefinition {
		return this.knifeEquipped ? this.melee.definition : this.firearm.definition;
	}
	get switching(): boolean {
		return this.switchState !== null;
	}
	get lowered(): number {
		const state = this.switchState;
		if (!state) return 0;
		const progress = Math.min(1, state.elapsed / state.duration);
		return state.phase === "lower" ? progress : 1 - progress;
	}
	get canAim(): boolean {
		return !this.switching && !this.knifeEquipped && !this.aimRequiresRelease;
	}
	private switchTo(target: number | "melee"): void {
		this.firearm.cancelReloadForWeaponSwitch();
		this.firearm.state.aiming = false;
		this.aimRequiresRelease = true;
		this.melee.cancel();
		this.switchState = {
			phase: "lower",
			elapsed: this.lowered * this.definition.equip.lowerDuration,
			duration: this.definition.equip.lowerDuration,
			target,
		};
	}
	/** Returns true during an unconsumed melee hit window. */
	update(dt: number, input: InputFrame): boolean {
		if (!input.aimHeld) this.aimRequiresRelease = false;
		if (input.weaponCycle !== 0) {
			const base =
				typeof this.switchState?.target === "number"
					? this.switchState.target
					: this.selected;
			const target = this.knifeEquipped
				? this.selected
				: (base + input.weaponCycle + this.primaries.length) %
					this.primaries.length;
			this.quickMelee = false;
			this.holdIntent = false;
			this.pendingAttack = false;
			this.switchTo(target);
		}
		if (input.meleePressed && !this.knifeEquipped && !this.quickMelee) {
			this.quickMelee = true;
			this.holdIntent = true;
			this.heldTime = 0;
			this.pendingAttack = true;
			this.switchTo("melee");
		}
		if (this.holdIntent) {
			if (input.meleeHeld) {
				this.heldTime += dt;
				if (this.heldTime >= this.melee.definition.holdThreshold) {
					this.quickMelee = false;
					this.holdIntent = false;
				}
			} else this.holdIntent = false;
		}
		const transition = this.switchState;
		if (transition) {
			transition.elapsed += dt;
			if (transition.elapsed >= transition.duration) {
				if (transition.phase === "lower") {
					this.knifeEquipped = transition.target === "melee";
					if (typeof transition.target === "number")
						this.selected = transition.target;
					this.switchState = {
						...transition,
						phase: "raise",
						elapsed: 0,
						duration: this.definition.equip.raiseDuration,
					};
				} else this.switchState = null;
			}
		}
		if (
			this.knifeEquipped &&
			!this.switching &&
			(this.pendingAttack || input.primaryFireHeld || input.meleePressed)
		) {
			if (this.melee.start()) this.pendingAttack = false;
		}
		const hitWindow = this.melee.update(dt);
		if (
			this.quickMelee &&
			this.knifeEquipped &&
			!this.switching &&
			!this.pendingAttack &&
			!this.melee.active
		) {
			this.quickMelee = false;
			this.switchTo(this.selected);
		}
		return hitWindow;
	}
}
