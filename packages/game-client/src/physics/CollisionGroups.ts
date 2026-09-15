export const CollisionLayer = {
	WORLD_STATIC: 1 << 0,
	WORLD_DYNAMIC: 1 << 1,
	PLAYER: 1 << 2,
	WEAPON_QUERY: 1 << 3,
	PROJECTILE: 1 << 4,
	TRIGGER: 1 << 5,
} as const;

export const SOLID_LAYERS =
	CollisionLayer.WORLD_STATIC |
	CollisionLayer.WORLD_DYNAMIC |
	CollisionLayer.PLAYER;

export function interactionGroups(membership: number, filter: number): number {
	return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

export function groupsInteract(a: number, b: number): boolean {
	const aMembership = (a >>> 16) & 0xffff;
	const aFilter = a & 0xffff;
	const bMembership = (b >>> 16) & 0xffff;
	const bFilter = b & 0xffff;
	return (aMembership & bFilter) !== 0 && (bMembership & aFilter) !== 0;
}

export const CollisionGroups = {
	worldStatic: interactionGroups(
		CollisionLayer.WORLD_STATIC,
		CollisionLayer.WORLD_DYNAMIC |
			CollisionLayer.PLAYER |
			CollisionLayer.WEAPON_QUERY |
			CollisionLayer.PROJECTILE,
	),
	worldDynamic: interactionGroups(
		CollisionLayer.WORLD_DYNAMIC,
		CollisionLayer.PLAYER |
			CollisionLayer.WEAPON_QUERY |
			CollisionLayer.PROJECTILE |
			CollisionLayer.WORLD_STATIC |
			CollisionLayer.WORLD_DYNAMIC,
	),
	player: interactionGroups(
		CollisionLayer.PLAYER,
		CollisionLayer.WORLD_STATIC |
			CollisionLayer.WORLD_DYNAMIC |
			CollisionLayer.PLAYER,
	),
	weaponQuery: interactionGroups(CollisionLayer.WEAPON_QUERY, SOLID_LAYERS),
	projectile: interactionGroups(CollisionLayer.PROJECTILE, SOLID_LAYERS),
	trigger: interactionGroups(CollisionLayer.TRIGGER, CollisionLayer.PLAYER),
} as const;
