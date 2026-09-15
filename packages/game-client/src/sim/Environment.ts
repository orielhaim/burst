/** Shared SI environment. The stronger gravity preserves the existing traversal tuning. */
export const WORLD_ENVIRONMENT = {
	gravity: { x: 0, y: -28, z: 0 },
	airDensity: 1.225,
	wind: { x: 0, y: 0, z: 0 },
	projectileLifetime: 8,
	sightRange: 200,
	ballisticStep: 1 / 240,
};
export type BallisticEnvironment = typeof WORLD_ENVIRONMENT;
