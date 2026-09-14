import { create } from "zustand";

type DebugStore = {
	/** Rapier collider visualization. */
	physicsDebug: boolean;
	setPhysicsDebug: (value: boolean) => void;
};

/**
 * Dev-only toggles. Written by the Leva panel (web), read by R3F components
 * via getState() per frame — never subscribed, so no re-renders.
 */
export const useDebugStore = create<DebugStore>((set) => ({
	physicsDebug: false,
	setPhysicsDebug: (physicsDebug) => set({ physicsDebug }),
}));
