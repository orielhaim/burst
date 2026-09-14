/**
 * Warm paper-like palette — the game's raw visual identity.
 * Framework-independent (plain hex numbers); R3F materials live in
 * `rendering/Sketch.tsx`. Do not turn this into realistic PBR defaults.
 */
export const COLORS = {
	background: 0xf2ead8,
	ground: 0xe8dcc4,
	wall: 0xd9cbb0,
	platform: 0xc9b896,
	accent: 0xc4a574,
	pillar: 0xb8956a,
	ink: 0x1c1814,
	impact: 0xe85d4c,
	weaponBody: 0x3a342c,
	weaponAccent: 0xe85d4c,
	weaponGrip: 0x5c4030,
	fog: 0xf2ead8,
} as const;

export type PaletteColor = keyof typeof COLORS;
