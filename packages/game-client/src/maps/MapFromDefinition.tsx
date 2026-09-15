import { Fragment } from "react";
import { resolveProp } from "./kit/propCatalog";
import type { MapDefinition, PropInstance } from "./types";

/**
 * Data-driven map renderer. Definitions are pure content:
 * props + spawns + kill bounds. Spawns are data only — no markers.
 */
export function MapFromDefinition({
	definition,
}: {
	definition: MapDefinition;
}) {
	return (
		<group name={`map:${definition.id}`}>
			{definition.props.map((prop, index) => (
				<PropNode key={`${prop.id}-${index}`} prop={prop} />
			))}
		</group>
	);
}

function PropNode({ prop }: { prop: PropInstance }) {
	const Component = resolveProp(prop.id);
	if (!Component) return null;
	return (
		<Fragment>
			<Component
				position={prop.position}
				rotation={prop.rotation}
				variant={prop.variant}
				decorative={prop.decorative}
			/>
		</Fragment>
	);
}
