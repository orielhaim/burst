import { MapFromDefinition } from "./MapFromDefinition";
import { chaosDeskDefinition } from "./chaosDeskDef";

/** Bare desk. ChaosDrops rains the playable mess on top. */
export function ChaosDesk() {
	return <MapFromDefinition definition={chaosDeskDefinition} />;
}
