import { MapFromDefinition } from "./MapFromDefinition";
import { paperIslandDefinition } from "./paperIslandDef";

/** Paper Island — notebook-only skirmish built from the same kit. */
export function PaperIsland() {
	return <MapFromDefinition definition={paperIslandDefinition} />;
}
