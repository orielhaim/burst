import type { ComponentType } from "react";

export type Vec3Tuple = [number, number, number];

/** Reusable prop kit ids. New maps combine these — they never invent one-off geometry. */
export type PropId =
	| "desk-slab"
	| "desk-leg"
	| "notebook-open"
	| "notebook-closed"
	| "book"
	| "book-stack"
	| "pen"
	| "pencil"
	| "eraser"
	| "ruler"
	| "sticky"
	| "paper-stack"
	| "paper-slip"
	| "laptop"
	| "monitor"
	| "mug"
	| "paperclip"
	| "tape-roll"
	| "phone"
	| "cover-block"
	| "room-floor"
	| "spawn-pad";

export type PropVariant = {
	/** Uniform or per-axis scale multiplier. */
	scale?: number | Vec3Tuple;
	/** Palette override (hex number). */
	color?: number;
	/** Kit-specific flavor: book color, sticky color, laptop open amount, … */
	style?: string;
};

export type PropInstance = {
	id: PropId;
	position: Vec3Tuple;
	rotation?: Vec3Tuple;
	variant?: PropVariant;
	/** Visual only — no collider. */
	decorative?: boolean;
};

export type MapSpawn = {
	position: Vec3Tuple;
	/** Yaw in radians, 0 faces -Z. */
	yaw: number;
};

/** Runtime spawn after registry normalizes to a point object. */
export type RuntimeSpawn = {
	position: { x: number; y: number; z: number };
	yaw: number;
};

export type MapBounds = {
	/** Falling below this world Y is lethal (off the desk). */
	killY: number;
	/** Soft floor for camera/ambience cues. */
	warnY?: number;
};

export type MapDefinition = {
	id: string;
	name: string;
	/** Short identity string shown in UI. */
	tagline: string;
	theme: "desk" | "notebook" | "room";
	bounds: MapBounds;
	spawns: MapSpawn[];
	props: PropInstance[];
};

export type PropComponentProps = {
	position: Vec3Tuple;
	rotation?: Vec3Tuple;
	variant?: PropVariant;
	decorative?: boolean;
};

export type PropComponent = ComponentType<PropComponentProps>;
