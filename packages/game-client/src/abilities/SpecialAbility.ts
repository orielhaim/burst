/**
 * Immutable special-ability definitions + static catalog.
 * Add a new ability by registering one definition and teaching AbilityRuntime
 * how to run its `kind` (or extend the union and the runtime switch).
 */

export type DashAbilityDefinition = {
	id: string;
	name: string;
	kind: "dash";
	/** Seconds before the ability can fire again. */
	cooldown: number;
	/** Horizontal speed applied along the character's facing (m/s). */
	speed: number;
	/** Vertical contribution from look pitch. Positive lifts when looking up. */
	pitchLift: number;
};

export type GrappleAbilityDefinition = {
	id: string;
	name: string;
	kind: "grapple";
	cooldown: number;
	/** Maximum hook reach (m). No anchor within this range means no fire. */
	maxRange: number;
	/** Cable flight speed to the anchor (m/s). Travel time = distance / hookSpeed. */
	hookSpeed: number;
	/** Pull speed toward the anchor once the hook lands (m/s). */
	pullSpeed: number;
	/** Lateral control speed while pulling (m/s). */
	airStrafeSpeed: number;
	/** Distance at which the pull releases (m). */
	releaseDistance: number;
};

export type SpecialAbilityDefinition =
	| DashAbilityDefinition
	| GrappleAbilityDefinition;

export type SpecialAbilityId = SpecialAbilityDefinition["id"];

const definitions = new Map<string, SpecialAbilityDefinition>();

export const AbilityRegistry = {
	register<T extends SpecialAbilityDefinition>(definition: T): T {
		if (definitions.has(definition.id))
			throw new Error(`Ability already registered: ${definition.id}`);
		if (definition.cooldown < 0)
			throw new Error(`Ability has invalid cooldown: ${definition.id}`);
		if (definition.kind === "dash") {
			if (definition.speed <= 0)
				throw new Error(`Dash has invalid speed: ${definition.id}`);
		} else {
			if (
				definition.maxRange <= 0 ||
				definition.hookSpeed <= 0 ||
				definition.pullSpeed <= 0 ||
				definition.airStrafeSpeed < 0 ||
				definition.releaseDistance <= 0
			)
				throw new Error(`Grapple has invalid range/pull values: ${definition.id}`);
		}
		const frozen = Object.freeze({ ...definition }) as T;
		definitions.set(frozen.id, frozen);
		return frozen;
	},

	get(id: string): SpecialAbilityDefinition | undefined {
		return definitions.get(id);
	},

	list(): SpecialAbilityDefinition[] {
		return [...definitions.values()];
	},
};
