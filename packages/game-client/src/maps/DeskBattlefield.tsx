import { MapFromDefinition } from "./MapFromDefinition";
import { deskBattlefieldDefinition } from "./deskBattlefieldDef";

/** Desk Battlefield map component — pure composition of the shared prop kit. */
export function DeskBattlefield() {
	return <MapFromDefinition definition={deskBattlefieldDefinition} />;
}
