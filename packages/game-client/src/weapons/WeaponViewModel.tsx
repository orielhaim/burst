import { Edges, useFBO } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "../rendering/palette";
import {
	lensAngularFovDegrees,
	magnifiedFovDegrees,
	scopeTargetSize,
} from "../sim/scopeMath";
import { useGameStore } from "../runtime/gameStore";
import { useGameRuntime } from "../runtime/GameRuntimeContext";
import { ScopeRegistry } from "./optics/ScopeRegistry";
import type {
	ReticleDefinition,
	ScopeDefinition,
} from "./optics/ScopeDefinition";
import type { WeaponPartDefinition } from "./WeaponDefinition";

function css(color: number): string {
	return `#${color.toString(16).padStart(6, "0")}`;
}

const PART_MATERIALS = {
	body: COLORS.weaponBody,
	accent: COLORS.weaponAccent,
	grip: COLORS.weaponGrip,
} as const;

type Vec3Tuple = [number, number, number];

function smoothstep(value: number): number {
	return value * value * (3 - 2 * value);
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function smoothRange(value: number, start: number, end: number): number {
	return smoothstep(clamp01((value - start) / (end - start)));
}

function lerp(a: number, b: number, alpha: number): number {
	return a + (b - a) * alpha;
}

/**
 * First-person weapon as a clean transform hierarchy:
 *
 * root (camera space) → pose(hip/ads) → reload → obstruction → recoil → model
 *
 * Simulation (WeaponRuntime) is read, never written, here. All pose math is
 * the preserved view-model behavior, applied via refs in useFrame — no React
 * state per frame.
 */
export function WeaponViewModel() {
	const selected = useGameStore((state) => state.ui.selectedWeaponId);
	return <EquippedWeaponView key={selected} />;
}

function EquippedWeaponView() {
	const runtime = useGameRuntime();
	const camera = useThree((state) => state.camera);
	const definition = runtime.equipment.definition;
	const scope = useMemo(
		() =>
			definition.category === "firearm"
				? ScopeRegistry.require(definition.opticId)
				: null,
		[definition],
	);

	const root = useRef<THREE.Group | null>(null);
	const pose = useRef<THREE.Group | null>(null);
	const reload = useRef<THREE.Group | null>(null);
	const obstruction = useRef<THREE.Group | null>(null);
	const recoil = useRef<THREE.Group | null>(null);
	const model = useRef<THREE.Group | null>(null);
	const magazine = useRef<THREE.Group | null>(null);
	const muzzle = useRef<THREE.Object3D | null>(null);
	const reticle = useRef<THREE.Group | null>(null);
	const lensMesh = useRef<THREE.Mesh | null>(null);
	const lensMaterial = useRef<THREE.MeshBasicMaterial | null>(null);

	const scratch = useMemo(
		() => ({
			probe: new THREE.Vector3(),
			muzzle: new THREE.Vector3(),
			eye: new THREE.Vector3(),
			right: new THREE.Vector3(),
			up: new THREE.Vector3(),
			back: new THREE.Vector3(),
		}),
		[],
	);

	// Attach the view-model root to the gameplay camera (camera space).
	useEffect(() => {
		const group = root.current;
		if (!group) return;
		camera.add(group);
		group.traverse((object) => object.layers.set(1));
		runtime.weaponNodes = {
			root,
			pose,
			reload,
			obstruction,
			recoil,
			model,
			magazine,
			muzzle,
			reticle,
		};
		return () => {
			camera.remove(group);
			if (runtime.weaponNodes?.root === root) runtime.weaponNodes = null;
		};
	}, [camera, runtime]);

	useFrame((_, dt) => {
		if (
			!root.current ||
			!pose.current ||
			!reload.current ||
			!obstruction.current ||
			!recoil.current ||
			!model.current ||
			!magazine.current ||
			!muzzle.current
		) {
			return;
		}
		const def = definition.viewModel;
		const ads = runtime.adsProgress;
		const blend = smoothstep(ads);
		const scopeActive = ads >= 0.04;

		pose.current.position.set(
			lerp(def.hipPose.position[0], def.adsPose.position[0], blend),
			lerp(def.hipPose.position[1], def.adsPose.position[1], blend),
			lerp(def.hipPose.position[2], def.adsPose.position[2], blend),
		);
		pose.current.rotation.set(
			lerp(def.hipPose.rotation[0], def.adsPose.rotation[0], blend),
			lerp(def.hipPose.rotation[1], def.adsPose.rotation[1], blend),
			lerp(def.hipPose.rotation[2], def.adsPose.rotation[2], blend),
		);

		const motion = runtime.locomotion;
		const response =
			1 - Math.exp(-definition.motion.response * Math.min(dt, 0.05));
		root.current.position.lerp(
			scratch.probe.set(
				motion.x.value * definition.motion.inertia,
				motion.y.value * definition.motion.inertia,
				motion.z.value * definition.motion.inertia,
			),
			response,
		);
		root.current.rotation.set(
			lerp(
				root.current.rotation.x,
				motion.pitch.value * definition.motion.inertia,
				response,
			),
			lerp(
				root.current.rotation.y,
				motion.yaw.value * definition.motion.inertia,
				response,
			),
			lerp(
				root.current.rotation.z,
				motion.roll.value * definition.motion.inertia,
				response,
			),
		);

		const kick = runtime.viewRecoil;
		recoil.current.position.set(
			0,
			kick * 0.01,
			kick * definition.motion.recoilDistance,
		);
		recoil.current.rotation.set(kick * definition.motion.recoilAngle, 0, 0);

		const lowered = smoothstep(runtime.equipment.lowered);
		pose.current.position.y -= lowered * definition.motion.switchDrop;
		pose.current.rotation.x += lowered * 0.45;
		const swing =
			definition.category === "melee" && runtime.equipment.melee.active
				? Math.sin(runtime.equipment.melee.progress * Math.PI)
				: 0;
		if (definition.category === "melee") {
			pose.current.position.z -= swing * definition.swingDistance;
			pose.current.rotation.y -= swing * definition.swingAngle;
		}
		const reloadProgress = runtime.weapon.reloadProgress;
		if (
			definition.category === "firearm" &&
			reloadProgress.active &&
			reloadProgress.phase === "magazine"
		) {
			const progress = smoothstep(reloadProgress.progress);
			const presentation = Math.sin(progress * Math.PI);
			reload.current.position.set(
				0.035 * presentation,
				-0.035 * presentation,
				0.025 * presentation,
			);
			reload.current.rotation.set(
				0.18 * presentation,
				-0.08 * presentation,
				definition.motion.reloadTilt * presentation,
			);
			const remove = smoothRange(progress, 0.08, 0.34);
			const insert = smoothRange(progress, 0.56, 0.9);
			const outAmount = remove * (1 - insert);
			magazine.current.position.set(
				0.055 * outAmount,
				-0.28 * outAmount,
				0.045 * outAmount,
			);
			magazine.current.rotation.set(0.22 * outAmount, 0, -0.18 * outAmount);
		} else if (definition.category === "firearm" && reloadProgress.active) {
			const insertion = Math.sin(reloadProgress.progress * Math.PI);
			reload.current.position.set(
				0,
				-definition.motion.insertDistance * insertion,
				0,
			);
			reload.current.rotation.set(
				0,
				0,
				definition.motion.reloadTilt * insertion,
			);
			magazine.current.position.set(0, 0, 0);
			magazine.current.rotation.set(0, 0, 0);
		} else {
			reload.current.position.set(0, 0, 0);
			reload.current.rotation.set(0, 0, 0);
			magazine.current.position.set(0, 0, 0);
			magazine.current.rotation.set(0, 0, 0);
		}

		// Probe the intended pose with the collision correction removed. Feeding the
		// corrected muzzle back into the solver makes it alternately clear and collide.
		obstruction.current.position.set(0, 0, 0);
		obstruction.current.rotation.set(0, 0, 0);
		root.current.updateWorldMatrix(true, true);
		const probes = def.obstruction.probes.map((probe) => {
			scratch.probe.fromArray(probe.position);
			model.current!.localToWorld(scratch.probe);
			return {
				position: {
					x: scratch.probe.x,
					y: scratch.probe.y,
					z: scratch.probe.z,
				},
				radius: probe.radius,
			};
		});
		camera.getWorldPosition(scratch.eye);
		const collisionDt = Math.max(0, Math.min(dt, 0.05));
		scratch.right.setFromMatrixColumn(camera.matrixWorld, 0);
		scratch.up.setFromMatrixColumn(camera.matrixWorld, 1);
		scratch.back.setFromMatrixColumn(camera.matrixWorld, 2);
		const result = runtime.obstruction?.resolve(
			scratch.eye,
			probes,
			collisionDt,
			{ right: scratch.right, up: scratch.up, back: scratch.back },
			def.obstruction,
		);
		runtime.obstructionRetraction = result?.retraction ?? 0;
		runtime.obstructionNormal = result?.normal ?? null;
		runtime.obstructionLateral = result?.lateral ?? 0;
		const retraction = runtime.obstructionRetraction;
		const ratio = clamp01(retraction / def.obstruction.fullTiltRetraction);
		const lateral = runtime.obstructionLateral;
		obstruction.current.position.set(
			lateral,
			(result?.vertical ?? 0) + 0.035 * ratio,
			retraction,
		);
		obstruction.current.rotation.set(
			-0.14 * ratio,
			0,
			0.08 * ratio + lateral * 1.2,
		);
		if (reticle.current) reticle.current.visible = scopeActive;

		// Fire uses the corrected muzzle, while obstruction always sees the intended pose.
		root.current.updateWorldMatrix(true, true);
		muzzle.current.getWorldPosition(scratch.muzzle);
		runtime.muzzleWorld = {
			x: scratch.muzzle.x,
			y: scratch.muzzle.y,
			z: scratch.muzzle.z,
		};
	});

	const viewModel = definition.viewModel;
	const magazinePart = viewModel.parts.find(
		(part) => part.animationSlot === "magazine",
	);
	const bodyParts = viewModel.parts.filter(
		(part) => part.animationSlot !== "magazine",
	);

	return (
		<group ref={root}>
			<group ref={pose}>
				<group ref={reload}>
					<group ref={obstruction}>
						<group ref={recoil}>
							<group ref={model}>
								{bodyParts.map((part, index) => (
									<WeaponPartMesh key={index} part={part} />
								))}
								<group ref={magazine}>
									{magazinePart ? <WeaponPartMesh part={magazinePart} /> : null}
								</group>
								<object3D
									ref={muzzle}
									position={viewModel.muzzlePosition as Vec3Tuple}
								/>
								<group
									position={viewModel.opticMount.position as Vec3Tuple}
									rotation={viewModel.opticMount.rotation as Vec3Tuple}
								>
									{scope && (
										<Optic
											scope={scope}
											reticleRef={reticle}
											lensMeshRef={lensMesh}
											lensMaterialRef={lensMaterial}
										/>
									)}
								</group>
							</group>
						</group>
					</group>
				</group>
			</group>
		</group>
	);
}

function WeaponPartMesh({ part }: { part: WeaponPartDefinition }) {
	const color = PART_MATERIALS[part.material];
	const position = part.position as Vec3Tuple;
	const rotation = (part.rotation ?? [0, 0, 0]) as Vec3Tuple;
	return (
		<mesh position={position} rotation={rotation}>
			{part.type === "box" ? (
				<boxGeometry args={part.size as Vec3Tuple} />
			) : (
				<cylinderGeometry args={[part.radius, part.radius, part.length, 16]} />
			)}
			<meshLambertMaterial color={css(color)} flatShading />
			<Edges color={css(COLORS.ink)} />
		</mesh>
	);
}

function Optic({
	scope,
	reticleRef,
	lensMeshRef,
	lensMaterialRef,
}: {
	scope: ScopeDefinition;
	reticleRef: React.Ref<THREE.Group>;
	lensMeshRef: React.RefObject<THREE.Mesh | null>;
	lensMaterialRef: React.RefObject<THREE.MeshBasicMaterial | null>;
}) {
	return (
		<group>
			<mesh rotation={[Math.PI / 2, 0, 0]}>
				<cylinderGeometry
					args={[
						scope.housing.radius,
						scope.housing.radius,
						scope.housing.length,
						24,
						1,
						true,
					]}
				/>
				<meshLambertMaterial
					color={css(COLORS.weaponBody)}
					flatShading
					side={THREE.DoubleSide}
				/>
				<Edges color={css(COLORS.ink)} />
			</mesh>
			<mesh position={[0, 0, scope.housing.length / 2 + 0.0005]}>
				<ringGeometry
					args={[scope.lens.radius, scope.housing.radius * 1.08, 32]}
				/>
				<meshLambertMaterial
					color={css(COLORS.weaponBody)}
					flatShading
					side={THREE.DoubleSide}
				/>
			</mesh>
			<mesh
				ref={lensMeshRef}
				position={[0, 0, scope.housing.length / 2 + 0.001]}
			>
				<circleGeometry args={[scope.lens.radius, 32]} />
				<meshBasicMaterial
					ref={lensMaterialRef}
					color={css(0x33454a)}
					toneMapped={false}
				/>
			</mesh>
			<mesh
				rotation={[0, Math.PI, 0]}
				position={[0, 0, -scope.housing.length / 2 - 0.001]}
			>
				<circleGeometry args={[scope.lens.radius, 32]} />
				<meshBasicMaterial
					color={css(0x7b9ba2)}
					transparent
					opacity={0.45}
					toneMapped={false}
				/>
			</mesh>
			<group
				ref={reticleRef}
				position={[0, 0, scope.housing.length / 2 + 0.003]}
			>
				<Reticle definition={scope.reticle} radius={scope.lens.radius} />
			</group>
			<ScopeLens
				scope={scope}
				lensMeshRef={lensMeshRef}
				lensMaterialRef={lensMaterialRef}
			/>
		</group>
	);
}

function Reticle({
	definition,
	radius,
}: {
	definition: ReticleDefinition;
	radius: number;
}) {
	const reach = radius * 0.68;
	const gap = definition.gap;
	const w = definition.lineWidth;
	const arm = reach - gap;
	const offset = (reach + gap) / 2;
	const material = useMemo(
		() =>
			new THREE.MeshBasicMaterial({
				color: definition.color,
				depthTest: false,
				depthWrite: false,
				toneMapped: false,
			}),
		[definition.color],
	);
	useEffect(() => () => material.dispose(), [material]);
	// renderOrder pins the reticle above the scope lens texture: both are
	// opaque, and without an explicit order the lens can win the draw and
	// swallow the cross in ADS.
	return (
		<group>
			<mesh position={[offset, 0, 0]} material={material} renderOrder={999}>
				<planeGeometry args={[arm, w]} />
			</mesh>
			<mesh position={[-offset, 0, 0]} material={material} renderOrder={999}>
				<planeGeometry args={[arm, w]} />
			</mesh>
			<mesh position={[0, offset, 0]} material={material} renderOrder={999}>
				<planeGeometry args={[w, arm]} />
			</mesh>
			<mesh position={[0, -offset, 0]} material={material} renderOrder={999}>
				<planeGeometry args={[w, arm]} />
			</mesh>
			<mesh position={[0, 0, 0]} material={material} renderOrder={999}>
				<planeGeometry args={[w * 1.5, w * 1.5]} />
			</mesh>
		</group>
	);
}

/**
 * Real picture-in-picture scope: a secondary camera sharing the main
 * camera's optical center renders the world (layer 0 only — the view model
 * on layer 1 never recurses) into a target shown on the lens. Only the lens
 * is magnified; the outside world keeps its normal FOV.
 */
function ScopeLens({
	scope,
	lensMeshRef,
	lensMaterialRef,
}: {
	scope: ScopeDefinition;
	lensMeshRef: React.RefObject<THREE.Mesh | null>;
	lensMaterialRef: React.RefObject<THREE.MeshBasicMaterial | null>;
}) {
	const runtime = useGameRuntime();
	const target = useFBO(256, 256);
	const scopeCamera = useMemo(() => {
		const camera = new THREE.PerspectiveCamera(10, 1, 0.05, 200);
		camera.layers.set(0);
		return camera;
	}, []);
	const state = useMemo(
		() => ({
			targetSize: 0,
			active: false as boolean | null,
			camPos: new THREE.Vector3(),
			lensPos: new THREE.Vector3(),
			lensScale: new THREE.Vector3(),
			aimQuat: new THREE.Quaternion(),
			bufferSize: new THREE.Vector2(),
		}),
		[],
	);

	useEffect(() => () => target.dispose(), [target]);

	useFrame(({ gl, scene, camera }) => {
		const material = lensMaterialRef.current;
		const lens = lensMeshRef.current;
		if (!material || !lens) return;
		const active = runtime.adsProgress >= 0.04;
		if (active !== state.active) {
			state.active = active;
			material.map = active ? target.texture : null;
			material.color.setHex(active ? 0xffffff : 0x33454a);
			material.needsUpdate = true;
		}
		if (!active) return;
		const main = camera as THREE.PerspectiveCamera;
		if (!main.isPerspectiveCamera) return;

		gl.getDrawingBufferSize(state.bufferSize);
		const scale =
			runtime.scopeResolutionScale ?? scope.lens.renderResolutionScale;
		const nextSize = scopeTargetSize(
			Math.min(state.bufferSize.x, state.bufferSize.y),
			scale,
		);
		if (nextSize !== state.targetSize) {
			state.targetSize = nextSize;
			target.setSize(nextSize, nextSize);
		}

		lens.getWorldPosition(state.lensPos);
		lens.getWorldScale(state.lensScale);
		main.getWorldPosition(state.camPos);
		const eyeRelief = state.camPos.distanceTo(state.lensPos);
		const lensFov = lensAngularFovDegrees(
			scope.lens.radius * Math.max(state.lensScale.x, state.lensScale.y),
			eyeRelief,
		);
		// Shared optical center: same position/quaternion as the main camera.
		main.getWorldPosition(scopeCamera.position);
		main.getWorldQuaternion(state.aimQuat);
		scopeCamera.quaternion.copy(state.aimQuat);
		scopeCamera.near = main.near;
		scopeCamera.far = main.far;
		scopeCamera.fov = magnifiedFovDegrees(lensFov, scope.magnification);
		scopeCamera.updateProjectionMatrix();

		const previousTarget = gl.getRenderTarget();
		gl.setRenderTarget(target);
		gl.render(scene, scopeCamera);
		gl.setRenderTarget(previousTarget);
	});

	return null;
}
