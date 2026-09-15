import {
	CuboidCollider,
	CylinderCollider,
	RigidBody,
} from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { CollisionGroups } from "../physics/CollisionGroups";
import { COLORS, css } from "../rendering/palette";
import { useGameRuntime } from "../runtime/GameRuntimeContext";
import type { GameMode } from "../core/types";
import {
	DESK_CHAOS_AREA,
	scheduleChaosDrops,
	type ChaosDropSpec,
} from "./schedule";

/**
 * Chaos Mode rain. Bodies mount only when a parachute entry starts
 * (epoch > 0) — never in the menu. They stay as the map for the match.
 */
export function ChaosDrops({ mode }: { mode: GameMode }) {
	const runtime = useGameRuntime();
	const [drops, setDrops] = useState<ChaosDropSpec[]>([]);
	/** A mounted or restored scene materializes the current entry epoch. */
	const epochRef = useRef(0);

	useFrame(() => {
		const epoch = runtime.entryDrop.epoch;
		if (mode !== "chaos") {
			if (drops.length > 0) setDrops([]);
			epochRef.current = epoch;
			return;
		}
		if (epoch === epochRef.current) return;
		epochRef.current = epoch;
		// Only rain when a real parachute entry started this session.
		if (epoch > 0) {
			setDrops(
				scheduleChaosDrops(
					runtime.chaosSeed + epoch * 13,
					runtime.chaosDropCount,
					DESK_CHAOS_AREA,
				),
			);
		} else {
			setDrops([]);
		}
	});

	if (mode !== "chaos" || drops.length === 0) return null;

	const epoch = epochRef.current ?? 0;
	return (
		<group name="chaos-drops">
			{drops.map((drop) => (
				<ChaosProp key={`${epoch}-${drop.id}`} spec={drop} />
			))}
		</group>
	);
}

/** High damping so the field settles into a stable mess and stays put. */
const LIN_DAMP = 0.28;
const ANG_DAMP = 0.55;
const FRICTION = 0.85;
const RESTITUTION = 0.08;

function ChaosProp({ spec }: { spec: ChaosDropSpec }) {
	const s = spec.scale;
	const color = css(spec.color);
	const position: [number, number, number] = [spec.x, spec.y, spec.z];
	const rotation: [number, number, number] = [spec.rx, spec.ry, spec.rz];

	return (
		<RigidBody
			type="dynamic"
			position={position}
			rotation={rotation}
			colliders={false}
			linearDamping={LIN_DAMP}
			angularDamping={ANG_DAMP}
			ccd
		>
			<ChaosShape spec={spec} s={s} color={color} />
		</RigidBody>
	);
}

function ChaosShape({
	spec,
	s,
	color,
}: {
	spec: ChaosDropSpec;
	s: number;
	color: string;
}) {
	switch (spec.kind) {
		case "mug": {
			const r = 1.2 * s;
			const h = 1.8 * s;
			return (
				<>
					<CylinderCollider
						args={[h / 2, r * 0.88]}
						friction={FRICTION}
						restitution={RESTITUTION}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh>
						<cylinderGeometry args={[r, r * 0.92, h, 10]} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
					<mesh position={[r * 0.95, 0, 0]}>
						<torusGeometry args={[r * 0.38, 0.1 * s, 5, 10, Math.PI]} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
				</>
			);
		}
		case "eraser": {
			const size: [number, number, number] = [2.6 * s, 0.95 * s, 1.6 * s];
			return (
				<>
					<CuboidCollider
						args={[size[0] / 2, size[1] / 2, size[2] / 2]}
						friction={FRICTION}
						restitution={RESTITUTION}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh>
						<boxGeometry args={size} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
					<mesh position={[size[0] * 0.22, 0, 0]}>
						<boxGeometry
							args={[size[0] * 0.26, size[1] * 1.02, size[2] * 1.02]}
						/>
						<meshLambertMaterial
							color={css(COLORS.eraserBand)}
							flatShading
						/>
					</mesh>
				</>
			);
		}
		case "book":
		case "book-flat": {
			// Flat books are wider platforms; upright books are cover walls.
			const flat = spec.kind === "book-flat";
			const size: [number, number, number] = flat
				? [7.2 * s, 1.15 * s, 5.2 * s]
				: [5.5 * s, 1.2 * s, 4.0 * s];
			return (
				<>
					<CuboidCollider
						args={[size[0] / 2, size[1] / 2, size[2] / 2]}
						friction={FRICTION}
						restitution={RESTITUTION}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh>
						<boxGeometry args={size} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
					<mesh position={[size[0] / 2 - 0.08, 0, 0]}>
						<boxGeometry
							args={[0.12, size[1] * 0.7, size[2] * 0.88]}
						/>
						<meshLambertMaterial
							color={css(COLORS.bookPages)}
							flatShading
						/>
					</mesh>
					<mesh position={[-size[0] / 2 + 0.18, 0, 0]}>
						<boxGeometry
							args={[0.22, size[1] * 0.92, size[2] * 0.92]}
						/>
						<meshLambertMaterial
							color={css(COLORS.bookSpine)}
							flatShading
						/>
					</mesh>
				</>
			);
		}
		case "notebook-slab": {
			// Large closed notebook — primary walkable platform.
			const size: [number, number, number] = [8.5 * s, 0.85 * s, 11 * s];
			return (
				<>
					<CuboidCollider
						args={[size[0] / 2, size[1] / 2, size[2] / 2]}
						friction={FRICTION}
						restitution={0.04}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh>
						<boxGeometry args={size} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
					<mesh
						position={[0, size[1] / 2 + 0.02, 0]}
						rotation={[-Math.PI / 2, 0, 0]}
					>
						<planeGeometry args={[size[0] - 0.5, size[2] - 0.5]} />
						<meshLambertMaterial color={css(COLORS.paperWarm)} />
					</mesh>
				</>
			);
		}
		case "pen":
		case "pencil": {
			const len = (spec.kind === "pen" ? 7.5 : 6.2) * s;
			const r = 0.2 * s;
			return (
				<>
					<CuboidCollider
						args={[len / 2, r, r]}
						friction={FRICTION}
						restitution={RESTITUTION}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[r, r, len, 6]} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
					<mesh
						position={[len / 2 - 0.15, 0, 0]}
						rotation={[0, 0, -Math.PI / 2]}
					>
						<coneGeometry args={[r * 0.8, 0.6, 5]} />
						<meshLambertMaterial
							color={css(
								spec.kind === "pencil"
									? COLORS.pencilWood
									: COLORS.penTip,
							)}
							flatShading
						/>
					</mesh>
				</>
			);
		}
		case "sticky": {
			const size: [number, number, number] = [2.2 * s, 0.14 * s, 2.2 * s];
			return (
				<>
					<CuboidCollider
						args={[size[0] / 2, size[1] / 2, size[2] / 2]}
						friction={FRICTION}
						restitution={RESTITUTION}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh>
						<boxGeometry args={size} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
				</>
			);
		}
		case "paper-stack": {
			const size: [number, number, number] = [4.0 * s, 1.5 * s, 3.0 * s];
			return (
				<>
					<CuboidCollider
						args={[size[0] / 2, size[1] / 2, size[2] / 2]}
						friction={FRICTION}
						restitution={0.04}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh>
						<boxGeometry args={size} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
					{[0.35, 0.7, 1.05].map((ty, i) => (
						<mesh
							key={i}
							position={[
								0.06 * (i % 2 ? 1 : -1),
								-size[1] / 2 + ty * s,
								0,
							]}
						>
							<boxGeometry
								args={[size[0] + 0.05, 0.03, size[2] + 0.03]}
							/>
							<meshLambertMaterial
								color={css(COLORS.paperEdge)}
								flatShading
							/>
						</mesh>
					))}
				</>
			);
		}
		case "tape": {
			const r = 1.05 * s;
			return (
				<>
					<CuboidCollider
						args={[r, 0.35 * s, r]}
						friction={FRICTION}
						restitution={RESTITUTION}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh rotation={[Math.PI / 2, 0, 0]}>
						<torusGeometry args={[r * 0.85, 0.3 * s, 6, 12]} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
				</>
			);
		}
		case "phone": {
			const size: [number, number, number] = [1.9 * s, 0.24 * s, 3.6 * s];
			return (
				<>
					<CuboidCollider
						args={[size[0] / 2, size[1] / 2, size[2] / 2]}
						friction={FRICTION}
						restitution={RESTITUTION}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh>
						<boxGeometry args={size} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
					<mesh
						position={[0, size[1] / 2 + 0.01, 0]}
						rotation={[-Math.PI / 2, 0, 0]}
					>
						<planeGeometry args={[size[0] - 0.2, size[2] - 0.3]} />
						<meshLambertMaterial color={css(COLORS.phoneScreen)} />
					</mesh>
				</>
			);
		}
		case "cover-block":
		default: {
			// Chunky cover crate from paper/card stock.
			const size: [number, number, number] = [3.2 * s, 2.0 * s, 2.6 * s];
			return (
				<>
					<CuboidCollider
						args={[size[0] / 2, size[1] / 2, size[2] / 2]}
						friction={FRICTION}
						restitution={RESTITUTION}
						collisionGroups={CollisionGroups.worldDynamic}
					/>
					<mesh>
						<boxGeometry args={size} />
						<meshLambertMaterial color={color} flatShading />
					</mesh>
				</>
			);
		}
	}
}
