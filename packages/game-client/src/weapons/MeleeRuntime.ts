import type { MeleeDefinition } from "./WeaponDefinition";

/** Attack timing and one-hit-per-swing ownership, independent of rendering/input. */
export class MeleeRuntime {
	elapsed: number | null = null;
	cooldown = 0;
	private hit = false;
	constructor(readonly definition: MeleeDefinition) {}
	get active(): boolean {
		return this.elapsed !== null;
	}
	get duration(): number {
		return (
			this.definition.windup +
			this.definition.hitWindow +
			this.definition.recovery
		);
	}
	get progress(): number {
		return this.elapsed === null ? 0 : this.elapsed / this.duration;
	}
	start(): boolean {
		if (this.active || this.cooldown > 0) return false;
		this.elapsed = 0;
		this.cooldown = this.definition.attackInterval;
		this.hit = false;
		return true;
	}
	update(dt: number): boolean {
		this.cooldown = Math.max(0, this.cooldown - dt);
		if (this.elapsed === null) return false;
		const previous = this.elapsed;
		this.elapsed += dt;
		const canHit =
			!this.hit &&
			this.elapsed >= this.definition.windup &&
			previous < this.definition.windup + this.definition.hitWindow;
		if (this.elapsed >= this.duration) this.elapsed = null;
		return canHit;
	}
	confirmHit(): void {
		this.hit = true;
	}
	cancel(): void {
		this.elapsed = null;
	}
}
