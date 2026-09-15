import { deskBattlefieldDefinition } from "./deskBattlefieldDef";
import { paperIslandDefinition } from "./paperIslandDef";
import type { MapDefinition, MapSpawn, RuntimeSpawn } from "./types";

/**
 * Pure map content registry (no React / R3F).
 * Simulation and tooling import this; `registry.ts` still binds components.
 */
export const MAP_DEFINITIONS: readonly MapDefinition[] = [
	deskBattlefieldDefinition,
	paperIslandDefinition,
];

export const DEFAULT_MAP_ID = "desk-battlefield";

export function getMapDefinition(id: string): MapDefinition | undefined {
	return MAP_DEFINITIONS.find((map) => map.id === id);
}

export function getMapBounds(id: string): MapDefinition["bounds"] {
	return (
		getMapDefinition(id)?.bounds ?? { killY: -20, warnY: -4 }
	);
}

export function getMapSpawns(id: string): RuntimeSpawn[] {
	const spawns: MapSpawn[] =
		getMapDefinition(id)?.spawns ?? [];
	const list: MapSpawn[] =
		spawns.length > 0 ? spawns : [{ position: [0, 1.5, 0], yaw: 0 }];
	return list.map((spawn) => {
		const [x, y, z] = spawn.position;
		return { position: { x, y, z }, yaw: spawn.yaw };
	});
}
