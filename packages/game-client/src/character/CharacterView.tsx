import { characterRenderPose } from "./CharacterPresentation";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameRuntime } from "../runtime/GameRuntimeContext";
import { useGameStore } from "../runtime/gameStore";
import type { Vec3 } from "../core/types";
import type { WeaponPartDefinition } from "../weapons/WeaponDefinition";

/**
 * World body. Firearms keep first-person arms on the view-model (no world IK).
 * One-handed melee reconnects the body: shoulder → elbow → knife grip, so the
 * hand is welded to the blade and still driven by the torso.
 */
export function CharacterView({
	actorId,
	local = false,
}: {
	actorId: string;
	local?: boolean;
}) {
	const runtime = useGameRuntime();
	useGameStore((state) => state.ui.selectedWeaponId);
	const root = useRef<THREE.Group>(null);
	const head = useRef<THREE.Mesh>(null);
	const hips = useRef<THREE.Mesh>(null);
	const bones = useRef<Array<THREE.Mesh | null>>([]);
	const feet = useRef<Array<THREE.Mesh | null>>([]);
	const hands = useRef<Array<THREE.Mesh | null>>([]);
	const weapon = useRef<THREE.Group>(null);
	const definition =
		runtime.characters.actors.get(actorId)?.weapon ??
		runtime.equipment.definition;
	const oneHandMelee =
		definition.category === "melee" && definition.handed === "one";
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
			head.current?.layers.set(3);
			weapon.current?.traverse((node) => node.layers.set(3));
			// Grip hand lives on the view-model; world hand meshes would z-fight it.
			for (const hand of hands.current) hand?.layers.set(3);
			if (oneHandMelee) {
				// Right + left arms and clavicle: connect knife grip to the torso.
				for (const i of [3, 4, 7, 8, 9]) bones.current[i]?.layers.set(2);
			} else {
				for (const i of [3, 4, 7, 8, 9]) bones.current[i]?.layers.set(3);
			}
		}
	}, [local, definition, oneHandMelee]);
	useFrame(() => {
		const actor = runtime.characters.actors.get(actorId);
		if (!root.current) return;
		root.current.visible = Boolean(actor && actor.health > 0);
		if (!actor || !head.current || !hips.current) return;
		const pose = characterRenderPose(
			actor.previousPose ?? actor.rig.pose,
			actor.rig.pose,
			runtime.renderAlpha,
			// Knife only: IK arms from body shoulders to the live grip targets.
			local && oneHandMelee ? actor.renderHands : undefined,
			local,
		);
		head.current.position.copy(pose.head);
		head.current.rotation.set(pose.aimPitch * 0.5, pose.aimYaw, 0, "YXZ");
		hips.current.position.copy(pose.hips);
		hips.current.rotation.y = pose.bodyYaw;
		const segment = (index: number, a: Vec3, b: Vec3, width: number) => {
			const mesh = bones.current[index];
			if (!mesh) return;
			mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
			scratch.delta.set(b.x - a.x, b.y - a.y, b.z - a.z);
			mesh.scale.set(width, scratch.delta.length(), width);
			mesh.quaternion.setFromUnitVectors(scratch.up, scratch.delta.normalize());
		};
		segment(0, pose.hips, pose.chest, 0.36);
		if (bones.current[0]) {
			bones.current[0].scale.z = 0.18;
			scratch.yaw.setFromAxisAngle(scratch.up, pose.aimYaw);
			bones.current[0].quaternion.multiply(scratch.yaw);
		}
		segment(9, pose.shoulders[0], pose.shoulders[1], 0.13);
		for (let i = 0; i < 2; i++) {
			segment(1 + i * 4, pose.hipJoints[i]!, pose.knees[i]!, 0.115);
			segment(2 + i * 4, pose.knees[i]!, pose.feet[i]!.position, 0.09);
			segment(3 + i * 4, pose.shoulders[i]!, pose.elbows[i]!, 0.08);
			segment(4 + i * 4, pose.elbows[i]!, pose.hands[i]!, 0.065);
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
			// Interpolate sim-rate weapon pose so remote/preview guns do not step
			// at 60Hz while the body pose is render-blended.
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
		<group ref={root}>
			<mesh ref={head}>
				<boxGeometry args={[0.25, 0.29, 0.25]} />
				<meshLambertMaterial color="#d4ba96" />
			</mesh>
			<mesh ref={hips}>
				<boxGeometry args={[0.30, 0.16, 0.18]} />
				<meshLambertMaterial color="#454e50" />
			</mesh>
			{Array.from({ length: 10 }, (_, i) => (
				<mesh
					key={i}
					ref={(node) => {
						bones.current[i] = node;
					}}
				>
					<boxGeometry args={[1, 1, 1]} />
					<meshLambertMaterial color={i === 0 ? "#687b78" : "#586361"} />
				</mesh>
			))}
			{[0, 1].map((i) => (
				<group key={i}>
					<mesh
						ref={(node) => {
							feet.current[i] = node;
						}}
					>
						<boxGeometry args={[0.12, 0.08, 0.24]} />
						<meshLambertMaterial color="#302e2b" />
					</mesh>
					<mesh
						ref={(node) => {
							hands.current[i] = node;
						}}
					>
						<boxGeometry args={[0.075, 0.08, 0.09]} />
						<meshLambertMaterial color="#bca384" />
					</mesh>
				</group>
			))}
			<group ref={weapon}>
				{definition.viewModel.parts.map((part, i) => (
					<CharacterWeaponPart key={i} part={part} />
				))}
			</group>
		</group>
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
				<cylinderGeometry args={[part.radius, part.radius, part.length, 8]} />
			)}
			<meshLambertMaterial
				color={part.material === "accent" ? "#9e8b65" : "#302e2b"}
			/>
		</mesh>
	);
}
