import type { ScopeDefinition } from "./ScopeDefinition";

const definitions = new Map<string, ScopeDefinition>();

export const ScopeRegistry = {
	register(definition: ScopeDefinition): ScopeDefinition {
		if (definitions.has(definition.id))
			throw new Error(`Scope already registered: ${definition.id}`);
		if (
			!Number.isFinite(definition.magnification) ||
			definition.magnification < 1
		)
			throw new Error("Scope magnification must be at least 1x");
		const frozen = deepFreeze(definition);
		definitions.set(frozen.id, frozen);
		return frozen;
	},

	require(id: string): ScopeDefinition {
		const definition = definitions.get(id);
		if (!definition) throw new Error(`Unknown scope: ${id}`);
		return definition;
	},

	list(): ScopeDefinition[] {
		return [...definitions.values()];
	},
};

function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}
