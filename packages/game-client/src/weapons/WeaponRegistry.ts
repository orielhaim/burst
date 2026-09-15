import type { WeaponDefinition, AnyWeaponDefinition } from "./WeaponDefinition";

const definitions = new Map<string, AnyWeaponDefinition>();

/** Static weapon catalog. Add new weapons by registering one immutable definition. */
export const WeaponRegistry = {
	register<T extends AnyWeaponDefinition>(definition: T): T {
		if (definitions.has(definition.id))
			throw new Error(`Weapon already registered: ${definition.id}`);
		if (
			definition.category === "firearm" &&
			(!Number.isFinite(definition.roundsPerMinute) ||
				definition.roundsPerMinute <= 0 ||
				!Number.isInteger(definition.magazineSize) ||
				definition.magazineSize <= 0 ||
				!Number.isInteger(definition.pellets) ||
				definition.pellets < 1)
		) {
			throw new Error(
				`Weapon has invalid timing or magazine values: ${definition.id}`,
			);
		}
		if (
			definition.equip.lowerDuration <= 0 ||
			definition.equip.raiseDuration <= 0
		)
			throw new Error(`Invalid equip timing: ${definition.id}`);
		if (definition.category === "firearm") {
			validateReload(definition);
			for (const value of Object.values(definition.projectile))
				if (!Number.isFinite(value) || value <= 0)
					throw new Error(`Invalid projectile profile: ${definition.id}`);
		} else if (
			definition.range <= 0 ||
			definition.hitWindow <= 0 ||
			definition.attackInterval <= 0 ||
			definition.holdThreshold <= 0
		)
			throw new Error(`Invalid melee timing: ${definition.id}`);
		const frozen = deepFreeze(definition);
		definitions.set(frozen.id, frozen);
		return frozen;
	},

	get(id: string): AnyWeaponDefinition | undefined {
		return definitions.get(id);
	},

	list(): AnyWeaponDefinition[] {
		return [...definitions.values()];
	},
};

function validateReload(definition: WeaponDefinition): void {
	const reload = definition.reload;
	const valid =
		reload.type === "magazine"
			? reload.duration > 0
			: reload.firstRoundDuration > 0 && reload.roundDuration > 0;
	if (!valid)
		throw new Error(`Weapon has invalid reload timing: ${definition.id}`);
}

function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}
