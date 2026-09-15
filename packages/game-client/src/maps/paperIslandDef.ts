import type { MapDefinition } from "./types";

/**
 * Paper Island — a small notebook-only skirmish.
 * Proves the kit pipeline: new map = new prop list, no new geometry code.
 * Notebook scale 1.05/1.1 → page top ≈ 0.30, footprint ≈ 19×13.
 */
const NOTEBOOK_TOP = 0.3;

export const paperIslandDefinition: MapDefinition = {
	id: "paper-island",
	name: "Paper Island",
	tagline: "Single open notebook, no desk clutter",
	theme: "notebook",
	bounds: {
		killY: -12,
		warnY: -1.5,
	},
	spawns: [
		{ position: [0, 1.3, 5], yaw: 0 },
		{ position: [0, 1.3, -5], yaw: Math.PI },
		{ position: [4.5, 1.3, 0], yaw: Math.PI / 2 },
		{ position: [-4.5, 1.3, 0], yaw: -Math.PI / 2 },
	],
	props: [
		{
			id: "desk-slab",
			position: [0, -0.8, 0],
			variant: { scale: [0.72, 1, 0.72] },
		},
		{
			id: "desk-leg",
			position: [-14, -5.6, -10],
			variant: { scale: [0.9, 0.9, 0.9] },
		},
		{
			id: "desk-leg",
			position: [14, -5.6, -10],
			variant: { scale: [0.9, 0.9, 0.9] },
		},
		{
			id: "desk-leg",
			position: [-14, -5.6, 10],
			variant: { scale: [0.9, 0.9, 0.9] },
		},
		{
			id: "desk-leg",
			position: [14, -5.6, 10],
			variant: { scale: [0.9, 0.9, 0.9] },
		},
		{
			id: "room-floor",
			position: [0, -13, 0],
			variant: { scale: [0.7, 1, 0.7] },
		},

		{
			id: "notebook-open",
			position: [0, 0.16, 0],
			variant: { scale: [1.05, 1, 1.1] },
		},

		// covers on the page
		{
			id: "eraser",
			position: [-5, NOTEBOOK_TOP + 0.55, -2],
			rotation: [0, 0.4, 0],
		},
		{
			id: "eraser",
			position: [5, NOTEBOOK_TOP + 0.55, 2.5],
			rotation: [0, -0.3, 0],
			variant: { scale: [0.9, 1, 1.1] },
		},
		{
			id: "cover-block",
			position: [0, NOTEBOOK_TOP + 0.55, -5],
			variant: { scale: [1.0, 0.7, 0.7] },
		},
		{
			id: "sticky",
			position: [3, NOTEBOOK_TOP + 0.07, -3.5],
			rotation: [0, 0.2, 0],
			variant: { style: "pink" },
		},
		{
			id: "sticky",
			position: [-3.5, NOTEBOOK_TOP + 0.07, 3.5],
			rotation: [0, -0.4, 0],
			variant: { style: "blue" },
		},

		// stationery outside the page footprint
		{ id: "pen", position: [0, 0.22, 9], rotation: [0, 0.15, 0] },
		{
			id: "pencil",
			position: [-10, 0.22, 5],
			rotation: [0, 0.7, 0],
		},
		{
			id: "paperclip",
			position: [2, 0.08, 8],
			decorative: true,
		},
		{
			id: "paperclip",
			position: [-2, 0.08, -8],
			rotation: [0, 0.5, 0],
			decorative: true,
		},
		{
			id: "ruler",
			position: [0, 0.38, 8.5],
			rotation: [-0.28, 0, 0],
			variant: { scale: [0.65, 1, 1] },
		},
	],
};
