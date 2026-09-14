/**
 * Renderer-independent gameplay primitives.
 * Must stay free of Three.js, React, DOM, and Colyseus so it can run on
 * both the browser and the authoritative game server.
 */

export type Vec3 = {
	x: number;
	y: number;
	z: number;
};

export function vec3(x = 0, y = 0, z = 0): Vec3 {
	return { x, y, z };
}
