import { COLORS } from "../rendering/palette";
import type { MapDefinition, PropInstance } from "./types";

/**
 * Desk Battlefield — first real map.
 * Props sit on distinct desk "islands" around the notebook so nothing
 * intersects. Fall off the desk edge = death.
 *
 * Scale notes (desk top y≈0):
 * - notebook footprint ≈ 21×14 centered, page top ≈ 0.30
 * - desk slab ≈ 72×54
 */
const DESK_Y = -0.8;
const NOTEBOOK_Y = 0.16;
const NOTEBOOK_TOP = 0.3;
const KILL_Y = -14;

function sticky(
	x: number,
	z: number,
	style: string,
	ry = 0,
): PropInstance {
	return {
		id: "sticky",
		position: [x, NOTEBOOK_TOP + 0.07, z],
		rotation: [0, ry, 0],
		variant: { style },
	};
}

function paperclip(x: number, z: number, ry = 0): PropInstance {
	return {
		id: "paperclip",
		position: [x, 0.08, z],
		rotation: [0.12, ry, 0],
		decorative: true,
	};
}

function onDeskY(halfHeight: number): number {
	return halfHeight + 0.01;
}

export const deskBattlefieldDefinition: MapDefinition = {
	id: "desk-battlefield",
	name: "Desk Battlefield",
	tagline: "Notebook firefight on a messy desk",
	theme: "desk",
	bounds: {
		killY: KILL_Y,
		warnY: -2,
	},
	spawns: [
		{ position: [0, 1.4, 5], yaw: 0 },
		{ position: [0, 1.4, -5], yaw: Math.PI },
		{ position: [5, 1.4, 0], yaw: Math.PI / 2 },
		{ position: [-5, 1.4, 0], yaw: -Math.PI / 2 },
		{ position: [-3, 1.4, 3.5], yaw: Math.PI * 0.25 },
		{ position: [3, 1.4, -3.5], yaw: Math.PI * 1.25 },
	],
	props: [
		// —— world shell ——
		{ id: "desk-slab", position: [0, DESK_Y, 0] },
		{ id: "desk-leg", position: [-30, DESK_Y - 4.8, -20] },
		{ id: "desk-leg", position: [30, DESK_Y - 4.8, -20] },
		{ id: "desk-leg", position: [-30, DESK_Y - 4.8, 20] },
		{ id: "desk-leg", position: [30, DESK_Y - 4.8, 20] },
		{ id: "room-floor", position: [0, KILL_Y - 1.5, 0] },

		// —— notebook heart (primary play surface) ——
		{
			id: "notebook-open",
			position: [0, NOTEBOOK_Y, 0],
			variant: { scale: [1.15, 1, 1.2] },
		},

		// —— NORTH: computer station (clear of notebook z≈-7.2) ——
		{
			id: "monitor",
			position: [2, 0, -18],
			rotation: [0, Math.PI, 0],
			variant: { scale: [1.05, 1, 1] },
		},
		{
			id: "cover-block",
			position: [0, onDeskY(0.96), -11.5],
			variant: { scale: [1.2, 1.2, 0.8], color: COLORS.paperAged },
		},
		{
			id: "phone",
			position: [14, onDeskY(0.14), -12],
			rotation: [0, 0.4, 0],
		},
		{
			id: "paper-slip",
			position: [-4, onDeskY(0.04), -10],
			rotation: [0, 0.2, 0],
			variant: { color: COLORS.paperWarm },
		},

		// —— WEST: books / closed notebook (notebook x≈-10.4) ——
		{
			id: "notebook-closed",
			position: [-18, onDeskY(0.45), 2],
			rotation: [0, 0.25, 0],
			variant: { color: COLORS.bookRed },
		},
		{
			id: "laptop",
			position: [-22, 0, -8],
			rotation: [0, 0.55, 0],
			variant: { style: "half", scale: [0.9, 1, 0.9] },
		},
		{
			id: "paper-stack",
			position: [-24, onDeskY(0.7), 10],
			rotation: [0, 0.15, 0],
		},
		{
			id: "mug",
			position: [-20, 0, 16],
			rotation: [0, 0.2, 0],
			variant: { style: "red" },
		},
		{
			id: "book",
			position: [-16, onDeskY(0.68), -14],
			rotation: [0, 0.7, 0],
			variant: { style: "green", scale: [1.05, 1, 1] },
		},
		{
			id: "pen",
			position: [-14, 0.22, 8],
			rotation: [0, -0.4, 0],
			variant: { color: COLORS.characterShirtAlt },
		},
		{
			id: "eraser",
			position: [-12, onDeskY(0.55), -4],
			rotation: [0, 0.3, 0],
		},

		// —— EAST: platforms / clutter (notebook x≈10.4) ——
		{
			id: "book-stack",
			position: [17, 0, 6],
			rotation: [0, -0.2, 0],
		},
		{
			id: "book",
			position: [14, onDeskY(0.57), -8],
			rotation: [0, -0.35, 0],
			variant: { style: "blue", scale: [0.9, 0.85, 0.95] },
		},
		{
			id: "pencil",
			position: [13, 0.2, -3],
			rotation: [0, 0.2, 0],
		},
		{
			id: "pen",
			position: [12, 0.22, 12],
			rotation: [0, 0.9, 0],
		},
		{
			id: "mug",
			position: [22, 0, -6],
			rotation: [0, -0.4, 0],
		},
		{
			id: "paper-stack",
			position: [20, onDeskY(0.7), 14],
			rotation: [0, -0.25, 0],
			variant: { scale: [1.1, 1, 1.05] },
		},
		{
			id: "cover-block",
			position: [15, onDeskY(0.88), -15],
			variant: { scale: [0.9, 1.1, 1.2], color: COLORS.eraser },
		},
		{
			id: "tape-roll",
			position: [19, onDeskY(0.4), 2],
			rotation: [0, 0.8, 0],
		},

		// —— SOUTH ramps into notebook (high end toward -z / notebook) ——
		{
			id: "ruler",
			position: [2, 0.38, 11],
			rotation: [-0.26, 0, 0],
			variant: { scale: [0.7, 1, 1] },
		},
		{
			id: "book",
			position: [-8, 0.72, 12.5],
			rotation: [-0.3, 0.15, 0],
			variant: { style: "mustard", scale: [0.95, 0.9, 0.85] },
		},
		{
			id: "pencil",
			position: [-5, 0.22, 16],
			rotation: [0, -1.1, 0],
		},
		{
			id: "sticky",
			position: [8, onDeskY(0.06), 16],
			rotation: [0, 0.3, 0],
			variant: { style: "blue" },
		},
		{
			id: "paper-slip",
			position: [10, onDeskY(0.04), 18],
			rotation: [0, 0.35, 0],
		},
		{
			id: "cover-block",
			position: [-14, onDeskY(1.12), 15],
			variant: { scale: [1.0, 1.4, 1.1], color: COLORS.stickyPink },
		},

		// —— ON NOTEBOOK pages (cover, not intersecting neighbors) ——
		{
			id: "eraser",
			position: [-4, NOTEBOOK_TOP + 0.55, -3.2],
			rotation: [0, 0.3, 0],
		},
		{
			id: "eraser",
			position: [4.2, NOTEBOOK_TOP + 0.55, 3.8],
			rotation: [0, -0.5, 0],
			variant: { scale: [1.05, 1, 1] },
		},
		{
			id: "cover-block",
			position: [0, NOTEBOOK_TOP + 0.55, -5.5],
			rotation: [0, 0.1, 0],
			variant: { scale: [1.0, 0.7, 0.7], color: COLORS.paperAged },
		},
		sticky(-3.5, 3.5, "yellow", 0.2),
		sticky(3.8, -3, "pink", -0.3),

		// decorative clips on desk (outside notebook)
		paperclip(-3, 14, 0.4),
		paperclip(8, -10, 1.2),
		paperclip(-22, 4, -0.6),
		paperclip(16, 10, 0.2),
		paperclip(0, -16, 0.9),
		{
			id: "pencil",
			position: [24, 0.22, 4],
			rotation: [0, 0.6, 0],
			variant: { style: "no-collider" },
			decorative: true,
		},
	],
};
