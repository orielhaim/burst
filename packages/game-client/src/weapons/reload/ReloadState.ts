import type { ReloadDefinition } from "../WeaponDefinition";

export type ReloadState =
	| { type: "idle" }
	| { type: "magazine"; elapsed: number }
	| {
			type: "perRound";
			phase: "starting" | "inserting" | "finishing";
			elapsed: number;
	  };

export type ReloadProgress = {
	active: boolean;
	phase: "idle" | "magazine" | "starting" | "inserting" | "finishing";
	progress: number;
};

export function getReloadProgress(
	state: ReloadState,
	definition: ReloadDefinition,
): ReloadProgress {
	if (state.type === "idle")
		return { active: false, phase: "idle", progress: 0 };
	if (state.type === "magazine" && definition.type === "magazine") {
		return {
			active: true,
			phase: "magazine",
			progress: clamp01(state.elapsed / definition.duration),
		};
	}
	if (state.type === "perRound" && definition.type === "perRound") {
		const duration =
			state.phase === "starting"
				? definition.firstRoundDuration
				: state.phase === "inserting"
					? definition.roundDuration
					: (definition.finishDuration ?? 0);
		return {
			active: true,
			phase: state.phase,
			progress: duration <= 0 ? 1 : clamp01(state.elapsed / duration),
		};
	}
	return { active: false, phase: "idle", progress: 0 };
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}
