/**
 * Desk / notebook doodle palette.
 * Flat paper + ink + stationery colors. Framework-independent hex numbers.
 * Never upgrade this into realistic PBR materials.
 */
export const COLORS = {
	// Room air / page void
	background: 0xf6f0e2,
	fog: 0xf6f0e2,
	roomFloor: 0x6e5a46,
	roomWall: 0xe8dfc8,

	// Desk furniture
	deskTop: 0xc9a66b,
	deskEdge: 0xa88858,
	deskLeg: 0x5c4030,
	deskGrain: 0xb8925a,

	// Paper / notebook
	paper: 0xfffef8,
	paperWarm: 0xf7f0e0,
	paperAged: 0xf0e6d0,
	paperRule: 0x6f94c4,
	paperMargin: 0xd96458,
	paperEdge: 0xe8dcc0,
	notebookCover: 0x3d5a80,
	notebookSpine: 0x2a4060,

	// Books
	bookRed: 0xc45c48,
	bookBlue: 0x3d6b8c,
	bookGreen: 0x5a7a52,
	bookMustard: 0xc4a04a,
	bookPages: 0xf5efe0,
	bookSpine: 0x2a2420,

	// Stationery
	penBody: 0x1a3a6b,
	penCap: 0x1c1814,
	penTip: 0xb8b0a0,
	pencilBody: 0xe8c84a,
	pencilWood: 0xd4b48a,
	pencilTip: 0x3a342c,
	pencilBand: 0xc0a060,
	eraser: 0xf0e4d8,
	eraserBand: 0xc45c48,
	ruler: 0xb8d8e8,
	rulerMark: 0x3a5a70,
	stickyYellow: 0xffe566,
	stickyPink: 0xff9eb5,
	stickyBlue: 0x9ed4f0,
	tape: 0xf0e8c8,
	paperclip: 0xa8b0b8,

	// Computer
	laptopBase: 0x3a3a40,
	laptopDeck: 0x4a4a52,
	laptopKey: 0x2a2a30,
	laptopScreen: 0x1a2430,
	laptopGlow: 0x5a9fd4,
	monitorStand: 0x2e2e34,
	monitorBezel: 0x1c1c22,
	monitorScreen: 0x152030,
	monitorGlow: 0x4a8fc4,

	// Mug / clutter
	mugBody: 0xf0efe8,
	mugRim: 0xd0c8b8,
	coffee: 0x4a2e18,
	mugAccent: 0xe85d4c,
	phoneBody: 0x2a2a30,
	phoneScreen: 0x1a2838,

	// Doodle fighters
	characterPaper: 0xfff6e0,
	characterInk: 0x1c1814,
	characterShirt: 0xe85d4c,
	characterShirtAlt: 0x3d8ec4,
	characterShoe: 0x3a342c,

	// Ink / FX
	ink: 0x1c1814,
	impact: 0xe85d4c,
	void: 0x2a2018,

	// Weapons (stationery-ink language)
	weaponBody: 0x3a342c,
	weaponAccent: 0xe85d4c,
	weaponGrip: 0x5c4030,
	weaponPaper: 0xf0e8d0,
} as const;

export type PaletteColor = keyof typeof COLORS;

export function css(color: number): string {
	return `#${color.toString(16).padStart(6, "0")}`;
}
