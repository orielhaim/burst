import type { ComponentType } from "react";
import { DeskBattlefield } from "./DeskBattlefield";
import { deskBattlefieldDefinition } from "./deskBattlefieldDef";
import { PaperIsland } from "./PaperIsland";
import { paperIslandDefinition } from "./paperIslandDef";
import type {
	MapBounds,
	MapDefinition,
	MapSpawn,
	RuntimeSpawn,
	Vec3Tuple,
} from "./types";

export type {
	MapBounds,
	MapDefinition,
	MapSpawn,
	RuntimeSpawn,
	Vec3Tuple,
};
export { DEFAULT_MAP_ID } from "./definitions";
export {
	getMapBounds,
	getMapDefinition,
	getMapSpawns,
	MAP_DEFINITIONS,
} from "./definitions";

export type MapEntry = {
	id: string;
	name: string;
	tagline: string;
	component: ComponentType;
	spawns: MapSpawn[];
	bounds: MapBounds;
	definition?: MapDefinition;
};

/**
 * R3F map registry. Add a map by writing a MapDefinition + thin component,
 * then registerMap — no route or bootstrap edits required.
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

export const deskBattlefieldEntry = registerMap({
	id: deskBattlefieldDefinition.id,
	name: deskBattlefieldDefinition.name,
	tagline: deskBattlefieldDefinition.tagline,
	component: DeskBattlefield,
	spawns: deskBattlefieldDefinition.spawns,
	bounds: deskBattlefieldDefinition.bounds,
	definition: deskBattlefieldDefinition,
});

export const paperIslandEntry = registerMap({
	id: paperIslandDefinition.id,
	name: paperIslandDefinition.name,
	tagline: paperIslandDefinition.tagline,
	component: PaperIsland,
	spawns: paperIslandDefinition.spawns,
	bounds: paperIslandDefinition.bounds,
	definition: paperIslandDefinition,
});
