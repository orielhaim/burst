import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import { DoubleSide } from "three";
import { CollisionGroups } from "../../physics/CollisionGroups";
import { COLORS, css } from "../../rendering/palette";
import {
	blankPaperTexture,
	deskWoodTexture,
	linedPaperTexture,
} from "../../rendering/sketch";
import type { PropComponentProps, PropVariant, Vec3Tuple } from "../types";

function scaleVec(variant?: PropVariant): Vec3Tuple {
	const s = variant?.scale;
	if (s == null) return [1, 1, 1];
	if (typeof s === "number") return [s, s, s];
	return s;
}

function mul(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
	return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
}

/**
 * Solid prop shell. No Edges outlines — they float off large flat faces and
 * cause transparent/pop artifacts when scaled.
 */
function Solid({
	position,
	rotation = [0, 0, 0],
	size,
	color,
	children,
}: {
	position: Vec3Tuple;
	rotation?: Vec3Tuple;
	size: Vec3Tuple;
	color: number;
	children?: React.ReactNode;
}) {
	return (
		<RigidBody
			type="fixed"
			position={position}
			rotation={rotation}
			colliders={false}
		>
			<CuboidCollider
				args={[size[0] / 2, size[1] / 2, size[2] / 2]}
				collisionGroups={CollisionGroups.worldStatic}
			/>
			<mesh>
				<boxGeometry args={size} />
				<meshLambertMaterial color={css(color)} flatShading />
			</mesh>
			{children}
		</RigidBody>
	);
}

function Decor({
	position,
	rotation = [0, 0, 0],
	children,
}: {
	position: Vec3Tuple;
	rotation?: Vec3Tuple;
	children: React.ReactNode;
}) {
	return (
		<group position={position} rotation={rotation}>
			{children}
		</group>
	);
}

/** Giant desk slab. Top surface is the playable plane (y = position[1] + size[1]/2). */
export function DeskSlab({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([72, 1.6, 54], s);
	const map = useMemo(() => {
		const t = deskWoodTexture().clone();
		t.needsUpdate = true;
		t.repeat.set(3, 2);
		return t;
	}, []);
	const color = variant?.color ?? COLORS.deskTop;
	return (
		<RigidBody
			type="fixed"
			position={position}
			rotation={rotation}
			colliders={false}
		>
			<CuboidCollider
				args={[size[0] / 2, size[1] / 2, size[2] / 2]}
				collisionGroups={CollisionGroups.worldStatic}
			/>
			<mesh>
				<boxGeometry args={size} />
				<meshLambertMaterial color={css(color)} flatShading />
			</mesh>
			<mesh
				position={[0, size[1] / 2 + 0.02, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
			>
				<planeGeometry args={[size[0] - 0.4, size[2] - 0.4]} />
				<meshLambertMaterial map={map} color={css(color)} />
			</mesh>
		</RigidBody>
	);
}

export function DeskLeg({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([2.2, 8, 2.2], s);
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={variant?.color ?? COLORS.deskLeg}
		/>
	);
}

/** Open notebook — the level's paper heart. Spawns live on these pages. */
export function NotebookOpen({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const pageW = 9 * s[0];
	const pageD = 12 * s[2];
	const pageH = 0.28 * s[1];
	const gap = 0.18;
	const totalW = pageW * 2 + gap;
	const lined = useMemo(() => {
		const t = linedPaperTexture().clone();
		t.needsUpdate = true;
		t.repeat.set(1, 1.2);
		return t;
	}, []);
	const cover = variant?.color ?? COLORS.notebookCover;
	return (
		<group position={position} rotation={rotation}>
			{/* Backing cover — one slab under both pages */}
			<RigidBody type="fixed" colliders={false}>
				<CuboidCollider
					args={[totalW / 2 + 0.25, 0.1, pageD / 2 + 0.25]}
					position={[0, -0.1, 0]}
					collisionGroups={CollisionGroups.worldStatic}
				/>
				<mesh position={[0, -0.1, 0]}>
					<boxGeometry args={[totalW + 0.5, 0.18, pageD + 0.5]} />
					<meshLambertMaterial color={css(cover)} flatShading />
				</mesh>
			</RigidBody>
			{/* Left page */}
			<RigidBody
				type="fixed"
				position={[-(pageW / 2 + gap / 2), 0.02, 0]}
				colliders={false}
			>
				<CuboidCollider
					args={[pageW / 2, pageH / 2, pageD / 2]}
					collisionGroups={CollisionGroups.worldStatic}
				/>
				<mesh>
					<boxGeometry args={[pageW, pageH, pageD]} />
					<meshLambertMaterial color={css(COLORS.paper)} flatShading />
				</mesh>
				<mesh
					position={[0, pageH / 2 + 0.02, 0]}
					rotation={[-Math.PI / 2, 0, 0]}
				>
					<planeGeometry args={[pageW - 0.1, pageD - 0.1]} />
					<meshLambertMaterial map={lined} color={css(COLORS.paper)} />
				</mesh>
			</RigidBody>
			{/* Right page */}
			<RigidBody
				type="fixed"
				position={[pageW / 2 + gap / 2, 0.02, 0]}
				colliders={false}
			>
				<CuboidCollider
					args={[pageW / 2, pageH / 2, pageD / 2]}
					collisionGroups={CollisionGroups.worldStatic}
				/>
				<mesh>
					<boxGeometry args={[pageW, pageH, pageD]} />
					<meshLambertMaterial color={css(COLORS.paper)} flatShading />
				</mesh>
				<mesh
					position={[0, pageH / 2 + 0.02, 0]}
					rotation={[-Math.PI / 2, 0, 0]}
				>
					<planeGeometry args={[pageW - 0.1, pageD - 0.1]} />
					<meshLambertMaterial map={lined} color={css(COLORS.paper)} />
				</mesh>
			</RigidBody>
			{/* Spine */}
			<RigidBody type="fixed" position={[0, 0.06, 0]} colliders={false}>
				<CuboidCollider
					args={[0.2, 0.22, pageD / 2 + 0.08]}
					collisionGroups={CollisionGroups.worldStatic}
				/>
				<mesh>
					<boxGeometry args={[0.32, 0.4, pageD + 0.16]} />
					<meshLambertMaterial
						color={css(COLORS.notebookSpine)}
						flatShading
					/>
				</mesh>
			</RigidBody>
			{/* Coil rings */}
			{Array.from({ length: 11 }, (_, i) => {
				const z = -pageD / 2 + 1.2 + i * ((pageD - 2.4) / 10);
				return (
					<mesh
						key={i}
						position={[0, 0.22, z]}
						rotation={[0, 0, Math.PI / 2]}
					>
						<torusGeometry args={[0.22, 0.05, 6, 10]} />
						<meshLambertMaterial
							color={css(COLORS.paperclip)}
							flatShading
						/>
					</mesh>
				);
			})}
			{/* Doodle scribble on right page (opaque ink strips, no transparency) */}
			<group position={[pageW / 2 + gap / 2, pageH / 2 + 0.03, 0]}>
				{(
					[
						[-1.5, -2.2, 2.4, 0.08],
						[0.8, 0.4, 1.8, -0.15],
						[-0.4, 3.1, 3.2, 0.1],
					] as Array<[number, number, number, number]>
				).map(([x, z, len, rot], i) => (
					<mesh
						key={i}
						position={[x, 0, z]}
						rotation={[-Math.PI / 2, 0, rot]}
					>
						<planeGeometry args={[len, 0.14]} />
						<meshLambertMaterial color={css(COLORS.ink)} />
					</mesh>
				))}
			</group>
		</group>
	);
}

export function NotebookClosed({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([7, 0.9, 9.5], s);
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={variant?.color ?? COLORS.notebookCover}
		>
			<mesh
				position={[0, size[1] / 2 + 0.02, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
			>
				<planeGeometry args={[size[0] - 0.4, size[2] - 0.4]} />
				<meshLambertMaterial color={css(COLORS.paperWarm)} />
			</mesh>
		</Solid>
	);
}

const BOOK_STYLES: Record<string, number> = {
	red: COLORS.bookRed,
	blue: COLORS.bookBlue,
	green: COLORS.bookGreen,
	mustard: COLORS.bookMustard,
	default: COLORS.bookRed,
};

export function Book({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([6.5, 1.35, 4.8], s);
	const color =
		variant?.color ??
		BOOK_STYLES[variant?.style ?? "default"] ??
		BOOK_STYLES.red!;
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={color}
		>
			{/* spine strip, pulled inside the cover so faces never coplanar-fight */}
			<mesh position={[-size[0] / 2 + 0.22, 0, 0]}>
				<boxGeometry
					args={[0.28, size[1] * 0.92, size[2] * 0.92]}
				/>
				<meshLambertMaterial
					color={css(COLORS.bookSpine)}
					flatShading
				/>
			</mesh>
			{/* page edges on the fore-edge (open side), recessed */}
			<mesh position={[size[0] / 2 - 0.08, 0, 0]}>
				<boxGeometry
					args={[0.1, size[1] * 0.68, size[2] * 0.88]}
				/>
				<meshLambertMaterial
					color={css(COLORS.bookPages)}
					flatShading
				/>
			</mesh>
		</Solid>
	);
}

export function BookStack({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	// Height 1.35; place centers so consecutive books never interpenetrate.
	const bookH = 1.35 * s[1];
	const books = [
		{ y: bookH / 2, style: "blue", w: 6.8, d: 5.0, ry: 0.08 },
		{ y: bookH * 1.5 + 0.04, style: "red", w: 6.2, d: 4.6, ry: -0.12 },
		{ y: bookH * 2.5 + 0.08, style: "mustard", w: 5.6, d: 4.2, ry: 0.18 },
	];
	return (
		<group position={position} rotation={rotation}>
			{books.map((b, i) => (
				<Book
					key={i}
					position={[0, b.y, 0]}
					rotation={[0, b.ry, 0]}
					variant={{
						style: b.style,
						scale: [
							(b.w / 6.5) * s[0],
							s[1],
							(b.d / 4.8) * s[2],
						],
					}}
				/>
			))}
		</group>
	);
}

export function Pen({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const len = 9 * (typeof variant?.scale === "number" ? variant.scale : s[0]);
	const r = 0.22;
	const color = variant?.color ?? COLORS.penBody;
	const body = (
		<>
			<mesh rotation={[0, 0, Math.PI / 2]}>
				<cylinderGeometry args={[r, r, len, 8]} />
				<meshLambertMaterial color={css(color)} flatShading />
			</mesh>
			<mesh
				position={[-len / 2 + 0.35, 0, 0]}
				rotation={[0, 0, Math.PI / 2]}
			>
				<cylinderGeometry args={[r * 1.15, r * 1.15, 1.2, 8]} />
				<meshLambertMaterial
					color={css(COLORS.penCap)}
					flatShading
				/>
			</mesh>
			<mesh
				position={[len / 2 - 0.2, 0, 0]}
				rotation={[0, 0, -Math.PI / 2]}
			>
				<coneGeometry args={[r * 0.85, 0.7, 6]} />
				<meshLambertMaterial
					color={css(COLORS.penTip)}
					flatShading
				/>
			</mesh>
		</>
	);
	if (variant?.style === "no-collider") {
		return (
			<Decor position={position} rotation={rotation}>
				{body}
			</Decor>
		);
	}
	return (
		<RigidBody
			type="fixed"
			position={position}
			rotation={rotation}
			colliders={false}
		>
			<CuboidCollider
				args={[len / 2, r, r]}
				collisionGroups={CollisionGroups.worldStatic}
			/>
			{body}
		</RigidBody>
	);
}

export function Pencil({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const len = 7.5 * s[0];
	const r = 0.2;
	const color = variant?.color ?? COLORS.pencilBody;
	const body = (
		<>
			<mesh rotation={[0, 0, Math.PI / 2]}>
				<cylinderGeometry args={[r, r, len, 6]} />
				<meshLambertMaterial color={css(color)} flatShading />
			</mesh>
			<mesh
				position={[-len / 2 + 0.25, 0, 0]}
				rotation={[0, 0, Math.PI / 2]}
			>
				<cylinderGeometry args={[r * 1.1, r, 0.7, 6]} />
				<meshLambertMaterial
					color={css(COLORS.pencilBand)}
					flatShading
				/>
			</mesh>
			<mesh
				position={[-len / 2 + 0.55, 0, 0]}
				rotation={[0, 0, Math.PI / 2]}
			>
				<boxGeometry args={[0.35, r * 1.6, r * 1.6]} />
				<meshLambertMaterial
					color={css(COLORS.eraserBand)}
					flatShading
				/>
			</mesh>
			<mesh
				position={[len / 2 - 0.15, 0, 0]}
				rotation={[0, 0, -Math.PI / 2]}
			>
				<coneGeometry args={[r, 0.85, 6]} />
				<meshLambertMaterial
					color={css(COLORS.pencilWood)}
					flatShading
				/>
			</mesh>
			<mesh
				position={[len / 2 + 0.15, 0, 0]}
				rotation={[0, 0, -Math.PI / 2]}
			>
				<coneGeometry args={[r * 0.35, 0.25, 5]} />
				<meshLambertMaterial
					color={css(COLORS.pencilTip)}
					flatShading
				/>
			</mesh>
		</>
	);
	if (variant?.style === "no-collider") {
		return (
			<Decor position={position} rotation={rotation}>
				{body}
			</Decor>
		);
	}
	return (
		<RigidBody
			type="fixed"
			position={position}
			rotation={rotation}
			colliders={false}
		>
			<CuboidCollider
				args={[len / 2, r, r]}
				collisionGroups={CollisionGroups.worldStatic}
			/>
			{body}
		</RigidBody>
	);
}

export function Eraser({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([3.2, 1.1, 2.1], s);
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={variant?.color ?? COLORS.eraser}
		>
			<mesh position={[size[0] * 0.22, 0, 0]}>
				<boxGeometry
					args={[size[0] * 0.28, size[1] * 1.02, size[2] * 1.02]}
				/>
				<meshLambertMaterial
					color={css(COLORS.eraserBand)}
					flatShading
				/>
			</mesh>
		</Solid>
	);
}

/**
 * Plastic ruler ramp. Opaque; ticks sit flush on the top face and span
 * the real length so none float off the ends.
 */
export function Ruler({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([11, 0.35, 1.25], s);
	const color = variant?.color ?? COLORS.ruler;
	const tickCount = 12;
	const span = size[0] * 0.82;
	const tickX = (i: number) => -span / 2 + (span / (tickCount - 1)) * i;
	return (
		<RigidBody
			type="fixed"
			position={position}
			rotation={rotation}
			colliders={false}
		>
			<CuboidCollider
				args={[size[0] / 2, size[1] / 2, size[2] / 2]}
				collisionGroups={CollisionGroups.worldStatic}
			/>
			<mesh>
				<boxGeometry args={size} />
				<meshLambertMaterial color={css(color)} flatShading />
			</mesh>
			{/* edge stripe */}
			<mesh position={[0, size[1] / 2 + 0.01, size[2] / 2 - 0.08]}>
				<boxGeometry args={[size[0] - 0.1, 0.02, 0.08]} />
				<meshLambertMaterial color={css(COLORS.rulerMark)} />
			</mesh>
			{Array.from({ length: tickCount }, (_, i) => (
				<mesh
					key={i}
					position={[
						tickX(i),
						size[1] / 2 + 0.015,
						-size[2] * 0.22,
					]}
				>
					<boxGeometry args={[0.07, 0.02, size[2] * 0.28]} />
					<meshLambertMaterial color={css(COLORS.rulerMark)} />
				</mesh>
			))}
		</RigidBody>
	);
}

const STICKY: Record<string, number> = {
	yellow: COLORS.stickyYellow,
	pink: COLORS.stickyPink,
	blue: COLORS.stickyBlue,
	default: COLORS.stickyYellow,
};

export function Sticky({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([2.4, 0.12, 2.4], s);
	const color =
		variant?.color ?? STICKY[variant?.style ?? "default"] ?? STICKY.yellow!;
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={color}
		>
			<mesh
				position={[0, 0.02, size[2] * 0.35]}
				rotation={[0.18, 0, 0]}
			>
				<boxGeometry args={[size[0] * 0.98, 0.03, size[2] * 0.3]} />
				<meshLambertMaterial color={css(color)} flatShading />
			</mesh>
		</Solid>
	);
}

export function PaperStack({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([4.5, 1.4, 3.2], s);
	const paper = useMemo(() => blankPaperTexture(COLORS.paperWarm), []);
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={COLORS.paperWarm}
		>
			<mesh
				position={[0, size[1] / 2 + 0.02, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
			>
				<planeGeometry args={[size[0] - 0.15, size[2] - 0.15]} />
				<meshLambertMaterial map={paper} color={css(COLORS.paper)} />
			</mesh>
			{[0.35, 0.7, 1.05].map((y, i) => (
				<mesh
					key={i}
					position={[0.08 * (i % 2 ? 1 : -1), -size[1] / 2 + y, 0]}
				>
					<boxGeometry
						args={[size[0] + 0.06, 0.03, size[2] + 0.04]}
					/>
					<meshLambertMaterial
						color={css(COLORS.paperEdge)}
						flatShading
					/>
				</mesh>
			))}
		</Solid>
	);
}

export function PaperSlip({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([3.5, 0.08, 4.5], s);
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={variant?.color ?? COLORS.paper}
		/>
	);
}

export function Laptop({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const open =
		variant?.style === "closed" ? 0 : variant?.style === "half" ? 0.7 : 1;
	const baseW = 12 * s[0];
	const baseD = 8.5 * s[2];
	const baseH = 0.45 * s[1];
	const screenW = baseW * 0.96;
	const screenH = 7.5 * s[1];
	const angle = -0.25 - open * 0.95;
	return (
		<group position={position} rotation={rotation}>
			<RigidBody
				type="fixed"
				position={[0, baseH / 2, 0]}
				colliders={false}
			>
				<CuboidCollider
					args={[baseW / 2, baseH / 2, baseD / 2]}
					collisionGroups={CollisionGroups.worldStatic}
				/>
				<mesh>
					<boxGeometry args={[baseW, baseH, baseD]} />
					<meshLambertMaterial
						color={css(variant?.color ?? COLORS.laptopBase)}
						flatShading
					/>
				</mesh>
				<mesh position={[0, baseH / 2 + 0.04, 0.6]}>
					<boxGeometry
						args={[baseW * 0.86, 0.06, baseD * 0.55]}
					/>
					<meshLambertMaterial
						color={css(COLORS.laptopDeck)}
						flatShading
					/>
				</mesh>
				<mesh position={[0, baseH / 2 + 0.04, -2.2 * s[2]]}>
					<boxGeometry args={[2.4 * s[0], 0.04, 1.6 * s[2]]} />
					<meshLambertMaterial
						color={css(COLORS.laptopKey)}
						flatShading
					/>
				</mesh>
			</RigidBody>
			<group
				position={[0, baseH + 0.05, -baseD / 2 + 0.15]}
				rotation={[angle, 0, 0]}
			>
				<RigidBody
					type="fixed"
					position={[0, screenH / 2, 0]}
					colliders={false}
				>
					<CuboidCollider
						args={[screenW / 2, screenH / 2, 0.12]}
						collisionGroups={CollisionGroups.worldStatic}
					/>
					<mesh>
						<boxGeometry args={[screenW, screenH, 0.22]} />
						<meshLambertMaterial
							color={css(COLORS.laptopBase)}
							flatShading
						/>
					</mesh>
					{/* single opaque screen face — no transparent overlay (z-fight) */}
					<mesh position={[0, 0.15, 0.12]}>
						<planeGeometry
							args={[screenW * 0.9, screenH * 0.86]}
						/>
						<meshLambertMaterial
							color={css(
								open > 0.2
									? COLORS.laptopGlow
									: COLORS.laptopScreen,
							)}
						/>
					</mesh>
				</RigidBody>
			</group>
		</group>
	);
}

export function Monitor({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const standH = 2.4 * s[1];
	const screenW = 18 * s[0];
	const screenH = 11 * s[2];
	const bezel = 0.7;
	return (
		<group position={position} rotation={rotation}>
			<RigidBody
				type="fixed"
				position={[0, standH / 2, 0]}
				colliders={false}
			>
				<CuboidCollider
					args={[1.4 * s[0], standH / 2, 1.2 * s[2]]}
					collisionGroups={CollisionGroups.worldStatic}
				/>
				<mesh>
					<boxGeometry args={[1.6 * s[0], standH, 1.4 * s[2]]} />
					<meshLambertMaterial
						color={css(COLORS.monitorStand)}
						flatShading
					/>
				</mesh>
			</RigidBody>
			<RigidBody type="fixed" position={[0, 0.18, 0]} colliders={false}>
				<CuboidCollider
					args={[2.8 * s[0], 0.18, 2.0 * s[2]]}
					collisionGroups={CollisionGroups.worldStatic}
				/>
				<mesh>
					<boxGeometry args={[3.2 * s[0], 0.36, 2.4 * s[2]]} />
					<meshLambertMaterial
						color={css(COLORS.monitorStand)}
						flatShading
					/>
				</mesh>
			</RigidBody>
			<RigidBody
				type="fixed"
				position={[0, standH + screenH / 2 - 0.4, 0]}
				colliders={false}
			>
				<CuboidCollider
					args={[screenW / 2, screenH / 2, 0.35]}
					collisionGroups={CollisionGroups.worldStatic}
				/>
				<mesh>
					<boxGeometry
						args={[screenW + bezel, screenH + bezel, 0.55]}
					/>
					<meshLambertMaterial
						color={css(COLORS.monitorBezel)}
						flatShading
					/>
				</mesh>
				{/* one opaque lit screen — transparent glow caused flicker */}
				<mesh position={[0, 0, 0.29]}>
					<planeGeometry
						args={[screenW * 0.94, screenH * 0.9]}
					/>
					<meshLambertMaterial
						color={css(COLORS.monitorGlow)}
					/>
				</mesh>
				{/* simple desk-reflection band, fully opaque */}
				<mesh position={[0, -screenH * 0.15, 0.3]}>
					<planeGeometry
						args={[screenW * 0.88, screenH * 0.12]}
					/>
					<meshLambertMaterial
						color={css(COLORS.laptopScreen)}
					/>
				</mesh>
			</RigidBody>
		</group>
	);
}

/**
 * Hollow mug: open outer wall, inner floor, flat rim ring, side handle.
 * No over-the-top arch (that was an unrotated rim torus).
 */
export function Mug({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const r = 1.5 * s[0];
	const h = 2.2 * s[1];
	const wall = 0.18;
	const rInner = r - wall;
	const color = variant?.color ?? COLORS.mugBody;
	const accent =
		variant?.style === "red" ? COLORS.mugAccent : COLORS.paperEdge;
	const handleR = r * 0.48;

	return (
		<group position={position} rotation={rotation}>
			<RigidBody
				type="fixed"
				position={[0, h / 2, 0]}
				colliders={false}
			>
				<CuboidCollider
					args={[r * 0.82, h / 2, r * 0.82]}
					collisionGroups={CollisionGroups.worldStatic}
				/>
				{/* outer wall */}
				<mesh>
					<cylinderGeometry args={[r, r, h, 16, 1, true]} />
					<meshLambertMaterial
						color={css(color)}
						side={DoubleSide}
						flatShading
					/>
				</mesh>
				{/* inner wall (slightly shorter, inside) */}
				<mesh position={[0, 0.02, 0]}>
					<cylinderGeometry
						args={[rInner, rInner, h - 0.2, 16, 1, true]}
					/>
					<meshLambertMaterial
						color={css(color)}
						side={DoubleSide}
						flatShading
					/>
				</mesh>
				{/* solid base */}
				<mesh position={[0, -h / 2 + 0.1, 0]}>
					<cylinderGeometry args={[r, r, 0.2, 16]} />
					<meshLambertMaterial color={css(color)} flatShading />
				</mesh>
				{/* flat rim ring (XZ plane) */}
				<mesh position={[0, h / 2 - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
					<ringGeometry args={[rInner, r, 16]} />
					<meshLambertMaterial
						color={css(color)}
						side={DoubleSide}
						flatShading
					/>
				</mesh>
				{/* coffee inside the hollow */}
				<mesh position={[0, -h / 2 + 0.32, 0]}>
					<cylinderGeometry
						args={[rInner - 0.03, rInner - 0.03, 0.06, 16]}
					/>
					<meshLambertMaterial color={css(COLORS.coffee)} />
				</mesh>
				{/* side handle on +X — half-torus bulging outward */}
				<mesh
					position={[r + handleR * 0.05, 0, 0]}
					rotation={[0, 0, -Math.PI / 2]}
				>
					<torusGeometry
						args={[handleR, r * 0.08, 6, 14, Math.PI]}
					/>
					<meshLambertMaterial color={css(color)} flatShading />
				</mesh>
			</RigidBody>
			{/* accent band */}
			<mesh position={[0, h * 0.32, 0]}>
				<cylinderGeometry args={[r + 0.02, r + 0.02, 0.3, 16]} />
				<meshLambertMaterial color={css(accent)} flatShading />
			</mesh>
		</group>
	);
}

export function Paperclip({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant)[0];
	const color = css(variant?.color ?? COLORS.paperclip);
	const bar = (args: [number, number, number], pos: [number, number, number]) => (
		<mesh position={pos}>
			<boxGeometry args={args} />
			<meshLambertMaterial color={color} flatShading />
		</mesh>
	);
	return (
		<Decor position={position} rotation={rotation}>
			{/* outer loop */}
			{bar([1.1 * s, 0.05 * s, 0.05 * s], [0, 0.03 * s, 0.28 * s])}
			{bar([1.1 * s, 0.05 * s, 0.05 * s], [0, 0.03 * s, -0.28 * s])}
			{bar([0.05 * s, 0.05 * s, 0.56 * s], [0.55 * s, 0.03 * s, 0])}
			{/* inner return loop */}
			{bar([0.85 * s, 0.05 * s, 0.05 * s], [-0.05 * s, 0.03 * s, 0.16 * s])}
			{bar([0.85 * s, 0.05 * s, 0.05 * s], [-0.05 * s, 0.03 * s, -0.16 * s])}
			{bar([0.05 * s, 0.05 * s, 0.32 * s], [-0.45 * s, 0.03 * s, 0])}
		</Decor>
	);
}

export function TapeRoll({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant)[0];
	return (
		<RigidBody
			type="fixed"
			position={position}
			rotation={rotation}
			colliders={false}
		>
			<CuboidCollider
				args={[1.1 * s, 0.4 * s, 1.1 * s]}
				collisionGroups={CollisionGroups.worldStatic}
			/>
			<mesh rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[1.0 * s, 0.35 * s, 8, 16]} />
				<meshLambertMaterial
					color={css(variant?.color ?? COLORS.tape)}
					flatShading
				/>
			</mesh>
		</RigidBody>
	);
}

export function Phone({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([2.2, 0.28, 4.2], s);
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={variant?.color ?? COLORS.phoneBody}
		>
			<mesh
				position={[0, size[1] / 2 + 0.02, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
			>
				<planeGeometry args={[size[0] - 0.25, size[2] - 0.35]} />
				<meshLambertMaterial color={css(COLORS.phoneScreen)} />
			</mesh>
		</Solid>
	);
}

/** Generic solid cover — eraser-sized obstacle ready for reuse. */
export function CoverBlock({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([2.8, 1.6, 2.2], s);
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={variant?.color ?? COLORS.paperAged}
		/>
	);
}

/** Far-below carpet plane — makes the desk drop feel lethal. */
export function RoomFloor({
	position,
	rotation = [0, 0, 0],
	variant,
}: PropComponentProps) {
	const s = scaleVec(variant);
	const size: Vec3Tuple = mul([200, 1, 160], s);
	return (
		<Solid
			position={position}
			rotation={rotation}
			size={size}
			color={variant?.color ?? COLORS.roomFloor}
		/>
	);
}

/**
 * Spawn markers are data-only in gameplay. Kept in the catalog for future
 * debug overlays — currently renders nothing so no red rings litter the desk.
 */
export function SpawnPad({ position, rotation }: PropComponentProps) {
	void position;
	void rotation;
	return null;
}
