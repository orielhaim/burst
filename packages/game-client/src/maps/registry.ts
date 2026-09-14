import type { ComponentType } from "react";
import type { Vec3 } from "../core/types";
import { TestYard } from "./TestYard";

export type MapSpawn = {
	position: Vec3;
	/** Yaw in radians, 0 faces -Z. */
	yaw: number;
};

export type MapEntry = {
	id: string;
	name: string;
	component: ComponentType;
	spawns: MapSpawn[];
};

/**
 * Component registry so maps plug in without touching route/bootstrap logic.
 * Spawn metadata stays next to the map component, not in routes.
 */
const entries = new Map<string, MapEntry>();

export function registerMap(entry: MapEntry): MapEntry {
	entries.set(entry.id, entry);
	return entry;
}

export function getMap(id: string): MapEntry | undefined {
	return entries.get(id);
}

export function listMaps(): MapEntry[] {
	return [...entries.values()];
}

export const testYardEntry = registerMap({
	id: "test-yard",
	name: "Test Yard",
	component: TestYard,
	spawns: [
		{ position: { x: 0, y: 1.2, z: 12 }, yaw: 0 },
		{ position: { x: 0, y: 1.2, z: -12 }, yaw: Math.PI },
		{ position: { x: 10, y: 1.2, z: 0 }, yaw: Math.PI / 2 },
		{ position: { x: -10, y: 1.2, z: 0 }, yaw: -Math.PI / 2 },
	],
});
