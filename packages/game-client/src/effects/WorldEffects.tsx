import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "../rendering/palette";
import { useGameRuntime } from "../runtime/GameRuntimeContext";

const POOL = 32;
const IMPACT_LIFE = 0.12;
const TRACER_LIFE = 0.11;

type Active = {
	alive: boolean;
	startX: number;
	startY: number;
	startZ: number;
	endX: number;
	endY: number;
	endZ: number;
	nx: number;
	ny: number;
	nz: number;
	age: number;
	seed: number;
};

/**
 * Shot feedback: thin ink tracers + small impact marks. Fixed pools, no
 * React state — meshes are declarative (R3F owns lifecycle) and updated via
 * refs in useFrame. Behavior matches the old ImpactEffects (cap 32, FIFO,
 * same lifetimes/scales).
 */
export function WorldEffects() {
	const runtime = useGameRuntime();
	const impacts = useRef<Array<THREE.Mesh | null>>([]);
	const tracers = useRef<Array<THREE.Mesh | null>>([]);
	const grappleLine = useRef<THREE.Mesh | null>(null);
	const activeImpacts = useMemo<Active[]>(
		() =>
			Array.from({ length: POOL }, () => ({
				alive: false,
				startX: 0, startY: 0, startZ: 0,
				endX: 0, endY: 0, endZ: 0,
				nx: 0, ny: 1, nz: 0,
				age: 0,
				seed: 0,
			})),
		[],
	);
	const activeTracers = useMemo<Active[]>(
		() =>
			Array.from({ length: POOL }, () => ({
				alive: false,
				startX: 0, startY: 0, startZ: 0,
				endX: 0, endY: 0, endZ: 0,
				nx: 0, ny: 1, nz: 0,
				age: 0,
				seed: 0,
			})),
		[],
	);
	const cursor = useMemo(() => ({ impact: 0, tracer: 0 }), []);
	const scratch = useMemo(() => new THREE.Vector3(), []);
	const scratchDir = useMemo(() => new THREE.Vector3(), []);
	const FORWARD_Z = useMemo(() => new THREE.Vector3(0, 0, 1), []);

	useFrame((_, rawDelta) => {
		const dt = Number.isFinite(rawDelta) ? Math.max(0, rawDelta) : 0;

		// Cable: interpolated torso attach → render-blended hook tip/anchor.
		// Occlusion in AbilityRuntime severs the line before it can draw through
		// geometry. Tip uses renderAlpha so flight does not step at 60 Hz.
		const anchor = runtime.ability.getTip(runtime.renderAlpha);
		const hookMesh = grappleLine.current;
		if (hookMesh) {
			if (!anchor) {
				hookMesh.visible = false;
			} else {
				const start = runtime.getAbilityAttach();
				let dx = anchor.x - start.x;
				let dy = anchor.y - start.y;
				let dz = anchor.z - start.z;
				let length = Math.hypot(dx, dy, dz);
				if (length < 0.05) {
					hookMesh.visible = false;
				} else {
					const inv = 1 / length;
					dx *= inv;
					dy *= inv;
					dz *= inv;
					// Embed slightly into the surface so the cable meets geometry.
					const pad = 0.06;
					const endX = anchor.x + dx * pad;
					const endY = anchor.y + dy * pad;
					const endZ = anchor.z + dz * pad;
					length += pad;
					hookMesh.visible = true;
					hookMesh.position.set(
						(start.x + endX) / 2,
						(start.y + endY) / 2,
						(start.z + endZ) / 2,
					);
					scratchDir.set(dx, dy, dz);
					hookMesh.quaternion.setFromUnitVectors(FORWARD_Z, scratchDir);
					hookMesh.scale.set(1, 1, length);
				}
			}
		}

		// Drain new shots (FIFO into the pools).
		if (runtime.shots.length > 0) {
			for (const shot of runtime.shots.splice(0)) {
				const dx = shot.point.x - shot.origin.x;
				const dy = shot.point.y - shot.origin.y;
				const dz = shot.point.z - shot.origin.z;
				if (Math.hypot(dx, dy, dz) >= 0.05) {
					const slot = activeTracers[cursor.tracer]!;
					cursor.tracer = (cursor.tracer + 1) % POOL;
					slot.alive = true;
					slot.age = 0;
					slot.startX = shot.origin.x;
					slot.startY = shot.origin.y;
					slot.startZ = shot.origin.z;
					slot.endX = shot.point.x;
					slot.endY = shot.point.y;
					slot.endZ = shot.point.z;
				}
				if (shot.hit) {
					const slot = activeImpacts[cursor.impact]!;
					cursor.impact = (cursor.impact + 1) % POOL;
					const n = shot.normal ?? { x: 0, y: 1, z: 0 };
					slot.alive = true;
					slot.age = 0;
					slot.seed = Math.random();
					slot.endX = shot.point.x + n.x * 0.018;
					slot.endY = shot.point.y + n.y * 0.018;
					slot.endZ = shot.point.z + n.z * 0.018;
					slot.nx = n.x;
					slot.ny = n.y;
					slot.nz = n.z;
				}
			}
		}

		for (let i = 0; i < POOL; i += 1) {
			const impact = activeImpacts[i]!;
			const mesh = impacts.current[i];
			if (mesh) {
				if (!impact.alive) {
					mesh.visible = false;
				} else {
					impact.age += dt;
					const t = impact.age / IMPACT_LIFE;
					if (t >= 1) {
						impact.alive = false;
						mesh.visible = false;
					} else {
						mesh.visible = true;
						mesh.position.set(impact.endX, impact.endY, impact.endZ);
						scratch.set(
							impact.endX + impact.nx,
							impact.endY + impact.ny,
							impact.endZ + impact.nz,
						);
						mesh.lookAt(scratch);
						const size = 0.028 + impact.seed * 0.012;
						const grow = 1 + t * 0.55;
						mesh.scale.set(size * grow, size * grow, size * 0.4 * grow);
					}
				}
			}
			const tracer = activeTracers[i]!;
			const line = tracers.current[i];
			if (line) {
				if (!tracer.alive) {
					line.visible = false;
				} else {
					tracer.age += dt;
					const t = tracer.age / TRACER_LIFE;
					if (t >= 1) {
						tracer.alive = false;
						line.visible = false;
					} else {
						line.visible = true;
						line.position.set(
							(tracer.startX + tracer.endX) / 2,
							(tracer.startY + tracer.endY) / 2,
							(tracer.startZ + tracer.endZ) / 2,
						);
						scratch.set(tracer.endX, tracer.endY, tracer.endZ);
						line.lookAt(scratch);
						const len = Math.hypot(
							tracer.endX - tracer.startX,
							tracer.endY - tracer.startY,
							tracer.endZ - tracer.startZ,
						);
						line.scale.set(1, 1, Math.max(0.001, len * (1 - t * 0.9)));
					}
				}
			}
		}
	});

	return (
		<group name="world-effects">
			{/* Grapple hook cable while an anchor pull is active. */}
			<mesh ref={grappleLine} visible={false}>
				<boxGeometry args={[0.03, 0.03, 1]} />
				<meshBasicMaterial
					color={`#${COLORS.ink.toString(16).padStart(6, "0")}`}
					transparent
					opacity={0.92}
					depthWrite={false}
					toneMapped={false}
				/>
			</mesh>
			{Array.from({ length: POOL }, (_, i) => (
				<mesh
					key={`impact-${i}`}
					ref={(mesh) => {
						impacts.current[i] = mesh;
					}}
					visible={false}
				>
					<boxGeometry args={[1, 1, 1]} />
					<meshBasicMaterial
						color={`#${COLORS.impact.toString(16).padStart(6, "0")}`}
						transparent
						opacity={0.95}
						depthWrite={false}
						toneMapped={false}
					/>
				</mesh>
			))}
			{Array.from({ length: POOL }, (_, i) => (
				<mesh
					key={`tracer-${i}`}
					ref={(mesh) => {
						tracers.current[i] = mesh;
					}}
					visible={false}
				>
					<boxGeometry args={[0.018, 0.018, 1]} />
					<meshBasicMaterial
						color={`#${COLORS.ink.toString(16).padStart(6, "0")}`}
						transparent
						opacity={0.85}
						depthWrite={false}
						toneMapped={false}
					/>
				</mesh>
			))}
		</group>
	);
}
