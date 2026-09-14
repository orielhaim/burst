import { Edges } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import type { ReactNode } from "react";
import { CollisionGroups } from "../physics/CollisionGroups";
import { COLORS } from "../rendering/palette";

export type Vec3Tuple = [number, number, number];

function css(color: number): string {
	return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Reusable map primitives. Each solid defines rendering + physics together —
 * never duplicate geometry and collider coordinates in different files.
 * Fixed bodies use the static collision group; visuals are flat Lambert with
 * ink outlines to keep the raw sketch identity.
 */
export function SolidBox({
	position,
	size,
	rotation = [0, 0, 0],
	color = COLORS.wall,
	outline = true,
	children,
}: {
	position: Vec3Tuple;
	size: Vec3Tuple;
	rotation?: Vec3Tuple;
	color?: number;
	outline?: boolean;
	children?: ReactNode;
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
			<mesh castShadow={false} receiveShadow={false}>
				<boxGeometry args={size} />
				<meshLambertMaterial color={css(color)} flatShading />
				{outline ? <Edges color={css(COLORS.ink)} /> : null}
			</mesh>
			{children}
		</RigidBody>
	);
}

export function Floor({
	position,
	size,
	color = COLORS.ground,
}: {
	position: Vec3Tuple;
	size: Vec3Tuple;
	color?: number;
}) {
	return <SolidBox position={position} size={size} color={color} />;
}

export function Wall({
	from,
	to,
	height,
	thickness = 0.35,
	yBase = 0,
	color = COLORS.wall,
}: {
	from: Vec3Tuple;
	to: Vec3Tuple;
	height: number;
	thickness?: number;
	yBase?: number;
	color?: number;
}) {
	const dx = to[0] - from[0];
	const dz = to[2] - from[2];
	const length = Math.hypot(dx, dz);
	const yaw = Math.atan2(dx, dz);
	const center: Vec3Tuple = [
		(from[0] + to[0]) / 2,
		yBase + height / 2,
		(from[2] + to[2]) / 2,
	];
	return (
		<SolidBox
			position={center}
			size={[thickness, height, length]}
			rotation={[0, yaw, 0]}
			color={color}
		/>
	);
}

export function Platform({
	position,
	size,
	color = COLORS.platform,
}: {
	position: Vec3Tuple;
	size: Vec3Tuple;
	color?: number;
}) {
	return <SolidBox position={position} size={size} color={color} />;
}

export function Ramp({
	position,
	size,
	pitch,
	color = COLORS.accent,
}: {
	position: Vec3Tuple;
	size: Vec3Tuple;
	/** Pitch around X in radians. */
	pitch: number;
	color?: number;
}) {
	return (
		<SolidBox
			position={position}
			size={size}
			rotation={[pitch, 0, 0]}
			color={color}
		/>
	);
}

export function Pillar({
	position,
	height,
	width = 1.1,
	color = COLORS.pillar,
}: {
	position: Vec3Tuple;
	height: number;
	width?: number;
	color?: number;
}) {
	return (
		<SolidBox
			position={[position[0], position[1] + height / 2, position[2]]}
			size={[width, height, width]}
			color={color}
		/>
	);
}

/** Dynamic world prop — proves the R3F + Rapier composition pattern. */
export function Crate({
	position,
	size = 0.9,
	color = COLORS.accent,
}: {
	position: Vec3Tuple;
	size?: number;
	color?: number;
}) {
	const half = size / 2;
	return (
		<RigidBody
			type="dynamic"
			position={position}
			colliders={false}
		>
			<CuboidCollider
				args={[half, half, half]}
				friction={0.7}
				collisionGroups={CollisionGroups.worldDynamic}
			/>
			<mesh castShadow={false} receiveShadow={false}>
				<boxGeometry args={[size, size, size]} />
				<meshLambertMaterial color={css(color)} flatShading />
				<Edges color={css(COLORS.ink)} />
			</mesh>
		</RigidBody>
	);
}

/** Non-colliding spawn marker (orientation tick faces spawn yaw). */
export function SpawnPoint({
	position,
	yaw,
}: {
	position: Vec3Tuple;
	yaw: number;
}) {
	return (
		<group position={position} rotation={[0, yaw, 0]}>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]}>
				<ringGeometry args={[0.3, 0.42, 24]} />
				<meshBasicMaterial
					color={css(COLORS.accent)}
					transparent
					opacity={0.8}
					depthWrite={false}
				/>
			</mesh>
		</group>
	);
}
