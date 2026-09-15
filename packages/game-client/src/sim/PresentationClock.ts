export const FIXED_DT = 1 / 60;
/** Mirrors Rapier's frame remainder; only Rapier callbacks advance gameplay. */
export class PresentationClock {
	private remainder = 0;
	beginFrame(rawDelta: number): number {
		const dt = Number.isFinite(rawDelta) ? Math.max(0, Math.min(rawDelta, 0.5)) : 0;
		this.remainder += dt;
		return dt;
	}
	physicsStep(): void { this.remainder -= FIXED_DT; }
	get alpha(): number { return Math.max(0, Math.min(1, this.remainder / FIXED_DT)); }
}
