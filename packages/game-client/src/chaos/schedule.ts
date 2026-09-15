import { COLORS } from "../rendering/palette";

export const DEFAULT_CHAOS_DROP_COUNT = 40;

/**
 * Loose stationery that rains in Chaos Mode and **stays** as the map.
 * No computers/desk pieces — those only exist in Classic pre-placement.
 */
export type ChaosDropKind =
	| "mug"
	| "eraser"
	| "book"
	| "book-flat"
	| "notebook-slab"
	| "pen"
	| "pencil"
	| "sticky"
	| "paper-stack"
	| "tape"
	| "phone"
	| "cover-block";

export type ChaosDropSpec = {
	id: number;
	kind: ChaosDropKind;
	x: number;
	z: number;
	/** Start height — staggered so the rain continues through the long chute. */
	y: number;
	rx: number;
	ry: number;
	rz: number;
	scale: number;
	color: number;
	style: string;
};

export type ChaosArea = {
	halfX: number;
	halfZ: number;
	clearRadius: number;
};

export const DESK_CHAOS_AREA: ChaosArea = {
	halfX: 31,
	halfZ: 23,
	clearRadius: 3.2,
};

/** Weighted bag: platforms + cover + clutter so the desk becomes playable. */
const KIND_BAG: ChaosDropKind[] = [
	// platforms
	"book-flat",
	"book-flat",
	"book-flat",
	"notebook-slab",
	"notebook-slab",
	"book",
	"book",
	// cover / pillars
	"mug",
	"mug",
	"mug",
	"eraser",
	"eraser",
	"eraser",
	"paper-stack",
	"paper-stack",
	"cover-block",
	"cover-block",
	// rails / clutter
	"pen",
	"pen",
	"pencil",
	"pencil",
	"sticky",
	"sticky",
	"tape",
	"phone",
];

const BOOK_COLORS = [
	COLORS.bookRed,
	COLORS.bookBlue,
	COLORS.bookGreen,
	COLORS.bookMustard,
];
const STICKY_COLORS = [
	COLORS.stickyYellow,
	COLORS.stickyPink,
	COLORS.stickyBlue,
];

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function colorFor(kind: ChaosDropKind, rand: () => number): number {
	switch (kind) {
		case "book":
		case "book-flat":
			return BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)]!;
		case "notebook-slab":
			return rand() > 0.5 ? COLORS.notebookCover : COLORS.bookBlue;
		case "sticky":
			return STICKY_COLORS[Math.floor(rand() * STICKY_COLORS.length)]!;
		case "mug":
			return rand() > 0.55 ? COLORS.mugAccent : COLORS.mugBody;
		case "pen":
			return rand() > 0.5 ? COLORS.penBody : COLORS.characterShirtAlt;
		case "pencil":
			return COLORS.pencilBody;
		case "eraser":
			return COLORS.eraser;
		case "tape":
			return COLORS.tape;
		case "phone":
			return COLORS.phoneBody;
		case "paper-stack":
			return COLORS.paperWarm;
		case "cover-block":
			return rand() > 0.5 ? COLORS.paperAged : COLORS.stickyPink;
		default:
			return COLORS.paper;
	}
}

/**
 * Massive random field. Heights span a wide band so the desk is still
 * building while the player parachutes, then everything settles and stays.
 */
export function scheduleChaosDrops(
	seed: number,
	count: number,
	area: ChaosArea = DESK_CHAOS_AREA,
): ChaosDropSpec[] {
	const rand = mulberry32(seed || 1);
	const drops: ChaosDropSpec[] = [];
	for (let i = 0; i < count; i++) {
		const kind = KIND_BAG[Math.floor(rand() * KIND_BAG.length)]!;
		let x = 0;
		let z = 0;
		for (let attempt = 0; attempt < 28; attempt++) {
			x = (rand() * 2 - 1) * area.halfX;
			z = (rand() * 2 - 1) * area.halfZ;
			if (Math.hypot(x, z) >= area.clearRadius) break;
		}
		// Wide height band: late pieces still rain mid-descent, all land
		// well before the ~6.5s parachute ends (g=28 → ~2.4s from y=80).
		const y = 14 + rand() * 52;
		const flat = kind === "book-flat" || kind === "notebook-slab";
		drops.push({
			id: i,
			kind,
			x,
			z,
			y,
			// Platforms land flatter so they become walkable slabs.
			rx: flat ? (rand() - 0.5) * 0.18 : (rand() - 0.5) * 1.1,
			ry: rand() * Math.PI * 2,
			rz: flat ? (rand() - 0.5) * 0.18 : (rand() - 0.5) * 1.1,
			scale:
				kind === "book-flat" || kind === "notebook-slab"
					? 0.95 + rand() * 0.5
					: 0.8 + rand() * 0.55,
			color: colorFor(kind, rand),
			style: kind === "mug" && rand() > 0.5 ? "red" : "default",
		});
	}
	return drops;
}
