import { useRapier, useAfterPhysicsStep } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RapierBridge } from "../r3f/RapierBridge";
import { useGameRuntime } from "../runtime/GameRuntimeContext";
import { devLog } from "../runtime/log";
import { getMap, testYardEntry } from "../maps/registry";

const FIXED_DT = 1 / 60;

/**
 * LocalPlayer composition:
 * ├── PhysicsAttach  (bridge R3F world → runtime sim, kinematic controller body)
 * ├── SimulationDriver (fixed-step accumulator → runtime.fixedUpdate)
 * ├── PlayerCamera   (R3F camera = gameplay camera, presentation only)
 * └── PlayerPresence (landing spot for future remote-player interpolation)
 *
 * Movement math lives in PlayerController (framework-independent); this file
 * only wires lifecycle. No React state per frame — refs + runtime fields.
 */
export function LocalPlayer() {
	return (
		<>
			<PhysicsAttach />
			<SimulationDriver />
			<PlayerCamera />
		</>
	);
}

/** Remote players consume interpolated snapshots later; slot reserved. */
export function RemotePlayers() {
	return null;
}

function PhysicsAttach() {
	const { world, rapier } = useRapier();
	const runtime = useGameRuntime();
	const bridgeRef = useRef<RapierBridge | null>(null);
	const attachedRef = useRef(false);

	// Attach after the first physics step: declarative map colliders only
	// carry their real transforms once <Physics> has stepped (before that,
	// queries test origin-piled colliders and every spawn looks blocked).
	// <Physics> owns stepping; this never steps manually.
	useAfterPhysicsStep(() => {
		if (attachedRef.current) return;
		attachedRef.current = true;
		devLog("PhysicsAttach: mounting");
		try {
			devLog(
				`PhysicsAttach: world colliders: ${world.colliders.getAll().length}`,
			);
			const bridge = new RapierBridge(world, rapier);
			bridgeRef.current = bridge;
			const map = getMap(runtime.mapId) ?? testYardEntry;
			const spawn = map.spawns[0] ?? {
				position: { x: 0, y: 1.2, z: 0 },
				yaw: 0,
			};
			runtime.physicsInfo = bridge.describe();
			devLog(`PhysicsAttach: bridge: ${runtime.physicsInfo}`);
			runtime.attachPhysics(bridge, { ...spawn.position }, spawn.yaw);
			devLog("PhysicsAttach: attached");
		} catch (error) {
			devLog("PhysicsAttach failed:", error);
			devLog("rapier:", RapierBridge.describeModule(rapier));
			throw error;
		}
	});

	useEffect(() => {
		return () => {
			attachedRef.current = false;
			devLog("PhysicsAttach: disposing");
			runtime.detachPhysics();
			bridgeRef.current?.disposePlayerBodies();
			bridgeRef.current = null;
			devLog("PhysicsAttach: disposed");
		};
		// Attach once per Physics world lifetime. Map switches re-mount GameScene.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [world, rapier]);

	return null;
}

function SimulationDriver() {
	const runtime = useGameRuntime();
	const accumulator = useRef(0);
	const fpsState = useRef({ frames: 0, elapsed: 0, fps: 0 });

	useFrame((_, rawDelta) => {
		const delta = Number.isFinite(rawDelta)
			? Math.max(0, Math.min(rawDelta, 0.25))
			: 0;
		// FPS averaged over 0.5s windows (same cadence as the old GameClock).
		const fps = fpsState.current;
		fps.frames += 1;
		fps.elapsed += delta;
		if (fps.elapsed >= 0.5) {
			fps.fps = fps.frames / Math.max(fps.elapsed, 1e-6);
			fps.frames = 0;
			fps.elapsed = 0;
		}
		if (runtime.phase === "playing") {
			const look = runtime.input.consumeLookDelta();
			runtime.camera.applyLookDelta(look.x, look.y);
		}
		accumulator.current += delta;
		let steps = 0;
		while (accumulator.current >= FIXED_DT && steps < 5) {
			runtime.fixedUpdate(FIXED_DT);
			accumulator.current -= FIXED_DT;
			steps += 1;
		}
		if (steps === 5) accumulator.current = 0;
		runtime.renderAlpha = Math.max(
			0,
			Math.min(1, accumulator.current / FIXED_DT),
		);
		runtime.frameTick(delta, fps.fps);
	});
	return null;
}

function PlayerCamera() {
	const runtime = useGameRuntime();
	const camera = useThree((state) => state.camera);
	const scene = useThree((state) => state.scene);

	useEffect(() => {
		const perspective = camera as THREE.PerspectiveCamera;
		if (perspective.isPerspectiveCamera) {
			perspective.near = 0.05;
			perspective.far = 200;
			perspective.rotation.order = "YXZ";
			// Layer 1 carries the first-person view model.
			perspective.layers.enable(1);
			perspective.layers.enable(2); // Local legs and torso; excluded from the optic camera.
			perspective.updateProjectionMatrix();
		}
		// Children attached to the camera (the weapon view model) only render
		// when the camera itself is part of the scene graph.
		scene.add(camera);
		return () => {
			scene.remove(camera);
		};
	}, [camera, scene]);

	// After SimulationDriver so camera + WorldEffects share one fresh renderAlpha.
	useFrame(() => {
		const perspective = camera as THREE.PerspectiveCamera;
		if (!perspective.isPerspectiveCamera) return;
		const baseFov = runtime.fovOverride ?? 75;
		const fov = baseFov + runtime.fovKick;
		if (Math.abs(perspective.fov - fov) > 0.01) {
			perspective.fov = fov;
			perspective.updateProjectionMatrix();
		}
		// Interpolated presentation: fixed-step sim snapshots blended by the
		// driver's accumulator alpha, so high-refresh displays stay smooth.
		const { x: eyeX, y: eyeY, z: eyeZ } = runtime.getRenderEye();
		perspective.position.set(eyeX, eyeY, eyeZ);
		perspective.rotation.set(
			runtime.camera.getPitch() +
				runtime.camera.getRecoil().pitch +
				runtime.locomotion.aimPitch.value,
			runtime.camera.getYaw() +
				runtime.camera.getRecoil().yaw +
				runtime.locomotion.aimYaw.value,
			runtime.locomotion.cameraRoll.value,
		);
	});

	return null;
}
