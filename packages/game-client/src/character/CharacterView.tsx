import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { characterRenderPose } from "./CharacterPresentation";
import { createParachuteModel } from "./ParachuteModel";
import { DoodleHead } from "./DoodleHead";
import { useGameRuntime } from "../runtime/GameRuntimeContext";
import { useGameStore } from "../runtime/gameStore";
import { COLORS, css } from "../rendering/palette";
import type { Vec3 } from "../core/types";
import type { WeaponPartDefinition } from "../weapons/WeaponDefinition";

/**
 * Doodle fighter body: circular head, stick limbs, paper fill, ink lines.
 * Pose math is unchanged; presentation is hand-drawn stationery language.
 */
export function CharacterView({
	actorId,
	local = false,
	team = 0,
}: {
	actorId: string;
	local?: boolean;
	team?: 0 | 1;
}) {
	const runtime = useGameRuntime();
	const camera = useThree((state) => state.camera);
	const parachute = useMemo(
		() => (local ? createParachuteModel() : null),
		[local],
	);
	useEffect(() => {
		if (!parachute) return;
		camera.add(parachute.controls);
		return () => {
			camera.remove(parachute.controls);
			parachute.dispose();
		};
	}, [camera, parachute]);
	useGameStore((state) => state.ui.selectedWeaponId);
	const root = useRef<THREE.Group>(null);
	const head = useRef<THREE.Group>(null);
	const hips = useRef<THREE.Mesh>(null);
	const torso = useRef<THREE.Group>(null);
	const bones = useRef<Array<THREE.Mesh | null>>([]);
	const feet = useRef<Array<THREE.Mesh | null>>([]);
	const hands = useRef<Array<THREE.Mesh | null>>([]);
	const weapon = useRef<THREE.Group>(null);
	const definition =
		runtime.characters.actors.get(actorId)?.weapon ??
		runtime.equipment.definition;
	const oneHandMelee =
		definition.category === "melee" && definition.handed === "one";
	const shirt = team === 1 ? COLORS.characterShirtAlt : COLORS.characterShirt;
	const ink = css(COLORS.characterInk);
	const paper = css(COLORS.characterPaper);
	const scratch = useMemo(
		() => ({
			delta: new THREE.Vector3(),
			up: new THREE.Vector3(0, 1, 0),
			normal: new THREE.Vector3(),
			yaw: new THREE.Quaternion(),
		}),
		[],
	);

	useEffect(() => {
		root.current?.traverse((node) => node.layers.set(local ? 2 : 0));
		if (local) {
			head.current?.traverse((node) => node.layers.set(3));
			weapon.current?.traverse((node) => node.layers.set(3));
			for (const hand of hands.current) hand?.layers.set(3);
			if (oneHandMelee) {
				for (const i of [3, 4, 7, 8, 9]) bones.current[i]?.layers.set(2);
			} else {
				for (const i of [3, 4, 7, 8, 9]) bones.current[i]?.layers.set(3);
			}
		}
	}, [local, definition, oneHandMelee]);

	useFrame(() => {
		const actor = runtime.characters.actors.get(actorId);
		if (!root.current) return;
		const flight = local && runtime.entryDrop.active;
		const alive = Boolean(actor && actor.health > 0);
		root.current.visible = alive && !flight;
		if (!actor || !head.current || !hips.current) {
			parachute?.update({ x: 0, y: 0, z: 0 }, 0, false);
			return;
		}
		const pose = characterRenderPose(
			actor.previousPose ?? actor.rig.pose,
			actor.rig.pose,
			runtime.renderAlpha,
			local && oneHandMelee && !flight ? actor.renderHands : undefined,
			local,
		);
		parachute?.update(pose.chest, pose.aimYaw, flight && alive);
		if (flight) return;
		head.current.position.copy(pose.head);
		head.current.rotation.set(pose.aimPitch * 0.5, pose.aimYaw, 0, "YXZ");
		hips.current.position.copy(pose.hips);
		hips.current.rotation.y = pose.bodyYaw;
		if (torso.current) {
			torso.current.position.copy(pose.chest);
			torso.current.rotation.y = pose.aimYaw;
		}
		const segment = (index: number, a: Vec3, b: Vec3, radius: number) => {
			const mesh = bones.current[index];
			if (!mesh) return;
			mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
			scratch.delta.set(b.x - a.x, b.y - a.y, b.z - a.z);
			const length = Math.max(scratch.delta.length(), 0.001);
			mesh.scale.set(radius, length, radius);
			mesh.quaternion.setFromUnitVectors(scratch.up, scratch.delta.normalize());
		};
		// torso stick
		segment(0, pose.hips, pose.chest, 0.1);
		segment(9, pose.shoulders[0], pose.shoulders[1], 0.055);
		for (let i = 0; i < 2; i++) {
			segment(1 + i * 4, pose.hipJoints[i]!, pose.knees[i]!, 0.05);
			segment(2 + i * 4, pose.knees[i]!, pose.feet[i]!.position, 0.042);
			segment(3 + i * 4, pose.shoulders[i]!, pose.elbows[i]!, 0.038);
			segment(4 + i * 4, pose.elbows[i]!, pose.hands[i]!, 0.032);
			const foot = feet.current[i];
			if (foot) {
				foot.position.copy(pose.feet[i]!.position);
				scratch.normal.copy(pose.feet[i]!.normal).normalize();
				foot.quaternion.setFromUnitVectors(scratch.up, scratch.normal);
				scratch.yaw.setFromAxisAngle(scratch.up, pose.bodyYaw);
				foot.quaternion.multiply(scratch.yaw);
			}
			hands.current[i]?.position.copy(pose.hands[i]!);
		}
		if (weapon.current) {
			const alpha = runtime.renderAlpha;
			const previous = actor.previousWeaponPose ?? actor.weaponPose;
			const current = actor.weaponPose;
			const lerpAngle = (a: number, b: number) =>
				a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * alpha;
			weapon.current.position.set(
				previous.position.x +
					(current.position.x - previous.position.x) * alpha,
				previous.position.y +
					(current.position.y - previous.position.y) * alpha,
				previous.position.z +
					(current.position.z - previous.position.z) * alpha,
			);
			weapon.current.rotation.set(
				lerpAngle(previous.pitch, current.pitch),
				lerpAngle(previous.yaw, current.yaw),
				0,
				"YXZ",
			);
		}
	}, 1);

	return (
		<>
			{parachute && <primitive object={parachute.canopy} dispose={null} />}
			<group ref={root}>
				{/* head (circular doodle face) */}
				<group ref={head}>
					<DoodleHead teamColor={shirt} />
				</group>
				{/* pelvis blob */}
				<mesh ref={hips}>
					<sphereGeometry args={[0.12, 8, 6]} />
					<meshLambertMaterial color={ink} flatShading />
				</mesh>
				{/* chest paper card + shirt scribble */}
				<group ref={torso}>
					<mesh>
						<boxGeometry args={[0.28, 0.34, 0.1]} />
						<meshLambertMaterial color={paper} flatShading />
					</mesh>
					<mesh position={[0, 0.02, 0.06]}>
						<boxGeometry args={[0.22, 0.16, 0.02]} />
						<meshLambertMaterial color={css(shirt)} flatShading />
					</mesh>
				</group>
				{/* stick bones — unit cylinders scaled per frame */}
				{Array.from({ length: 10 }, (_, i) => (
					<mesh
						key={i}
						ref={(node) => {
							bones.current[i] = node;
						}}
					>
						<cylinderGeometry args={[1, 1, 1, 6]} />
						<meshLambertMaterial color={ink} flatShading />
					</mesh>
				))}
				{[0, 1].map((i) => (
					<group key={i}>
						{/* oval shoe scribble */}
						<mesh
							ref={(node) => {
								feet.current[i] = node;
							}}
							scale={[1, 0.45, 1.6]}
						>
							<sphereGeometry args={[0.07, 6, 5]} />
							<meshLambertMaterial
								color={css(COLORS.characterShoe)}
								flatShading
							/>
						</mesh>
						{/* hand ball */}
						<mesh
							ref={(node) => {
								hands.current[i] = node;
							}}
						>
							<sphereGeometry args={[0.045, 6, 5]} />
							<meshLambertMaterial color={paper} flatShading />
						</mesh>
					</group>
				))}
				<group ref={weapon}>
					{definition.viewModel.parts.map((part, i) => (
						<CharacterWeaponPart key={i} part={part} />
					))}
				</group>
			</group>
		</>
	);
}

function CharacterWeaponPart({ part }: { part: WeaponPartDefinition }) {
	return (
		<mesh
			position={[...part.position]}
			rotation={part.rotation ? [...part.rotation] : undefined}
		>
			{part.type === "box" ? (
				<boxGeometry args={[...part.size]} />
			) : (
				<cylinderGeometry args={[part.radius, part.radius, part.length, 6]} />
			)}
			<meshLambertMaterial
				color={
					part.material === "accent"
						? css(COLORS.weaponAccent)
						: css(COLORS.weaponBody)
				}
				flatShading
			/>
		</mesh>
	);
}
