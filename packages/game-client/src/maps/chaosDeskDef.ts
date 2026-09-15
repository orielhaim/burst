import type { MapDefinition } from "./types";

/**
 * Chaos shell: bare desk + fixed electronics (monitor / laptop / phone).
 * Loose stationery rain (ChaosDrops) builds the rest of the playable mess
 * and stays as full rigid bodies.
 */
export const chaosDeskDefinition: MapDefinition = {
	id: "chaos-desk",
	name: "Chaos Desk",
	tagline: "Electronics down. The rest rains in.",
	theme: "desk",
	bounds: {
		killY: -14,
		warnY: -2,
	},
	spawns: [
		{ position: [0, 1.3, 6], yaw: 0 },
		{ position: [0, 1.3, -6], yaw: Math.PI },
		{ position: [7, 1.3, 0], yaw: Math.PI / 2 },
		{ position: [-7, 1.3, 0], yaw: -Math.PI / 2 },
		{ position: [-4, 1.3, 4], yaw: Math.PI * 0.25 },
		{ position: [4, 1.3, -4], yaw: Math.PI * 1.25 },
	],
	props: [
		// —— world shell ——
		{ id: "desk-slab", position: [0, -0.8, 0] },
		{ id: "desk-leg", position: [-30, -5.6, -20] },
		{ id: "desk-leg", position: [30, -5.6, -20] },
		{ id: "desk-leg", position: [-30, -5.6, 20] },
		{ id: "desk-leg", position: [30, -5.6, 20] },
		{ id: "room-floor", position: [0, -15.5, 0] },

		// —— fixed electronics (not part of the rain) ——
		{
			id: "monitor",
			position: [2, 0, -18],
			rotation: [0, Math.PI, 0],
			variant: { scale: [1.05, 1, 1] },
		},
		{
			id: "laptop",
			position: [-20, 0, -10],
			rotation: [0, 0.55, 0],
			variant: { style: "half", scale: [0.9, 1, 0.9] },
		},
		{
			id: "phone",
			position: [14, 0.14, -12],
			rotation: [0, 0.4, 0],
		},
	],
};
