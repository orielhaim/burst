import { createContext, useContext } from "react";
import type { GameRuntime } from "./GameRuntime";

/** React owns composition/lifecycle; the runtime instance flows via context. */
export const GameRuntimeContext = createContext<GameRuntime | null>(null);

export function useGameRuntime(): GameRuntime {
	const runtime = useContext(GameRuntimeContext);
	if (!runtime) throw new Error("useGameRuntime must be used inside GameRuntimeProvider");
	return runtime;
}
