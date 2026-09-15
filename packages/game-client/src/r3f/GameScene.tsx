import { Physics } from "@react-three/rapier";
import { Suspense, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { WORLD_ENVIRONMENT } from "../sim/Environment";
import { FIXED_DT } from "../sim/PresentationClock";
import { CharacterView } from "../character/CharacterView";
import { ChaosDrops } from "../chaos/ChaosDrops";
import { ChaosDesk } from "../maps/ChaosDesk";
import { WorldEffects } from "../effects/WorldEffects";
import { DEFAULT_MAP_ID, getMap } from "../maps/registry";
import { LocalPlayer, RemotePlayers } from "../player/LocalPlayer";
import { COLORS, css } from "../rendering/palette";
import { useDebugStore } from "../runtime/debugStore";
import { GameRuntime } from "../runtime/GameRuntime";
import { GameRuntimeContext } from "../runtime/GameRuntimeContext";
import { useGameStore } from "../runtime/gameStore";
import { getLogLines } from "../runtime/log";
import { WeaponViewModel } from "../weapons/WeaponViewModel";
import type { GameMode } from "../core/types";

/**
 * Declarative game scene for the desk / notebook doodle world.
 *
 * <Canvas> (web GameCanvas)
 *   <Physics>              ← Rapier world owner
 *     <RuntimeBootstrap>   ← mutable GameRuntime, map bounds, input
 *       <Map />            ← data-driven kit composition
 *       <ChaosDrops />     ← optional chaos-mode rigid rain
 *       <LocalPlayer />    ← physics, fixed-step, camera, parachute entry
 *       <RemotePlayers />
 *       <WeaponViewModel />
 *       <WorldEffects />
 */
export function GameScene({
	mapId,
	debug = false,
	mode = "classic",
}: {
	mapId: string;
	debug?: boolean;
	mode?: GameMode;
}) {
	const physicsDebug = useDebugStore((state) => state.physicsDebug);
	return (
		<>
			<color attach="background" args={[css(COLORS.background)]} />
			{/* Far fog so the parachute look-down stays readable */}
			<fog attach="fog" args={[css(COLORS.fog), 120, 280]} />
			{/* Warm desk-lamp key + cool room fill */}
			<hemisphereLight args={[0xfff4e0, 0x8a7058, 1.05]} />
			<directionalLight
				position={[22, 40, 16]}
				intensity={1.15}
				color={0xfff0d8}
			/>
			<directionalLight
				position={[-18, 14, -22]}
				intensity={0.32}
				color={0xc8d8f0}
			/>
			<ambientLight intensity={0.22} color={0xf6f0e2} />
			<Suspense fallback={null}>
				<Physics
					gravity={[
						WORLD_ENVIRONMENT.gravity.x,
						WORLD_ENVIRONMENT.gravity.y,
						WORLD_ENVIRONMENT.gravity.z,
					]}
					timeStep={FIXED_DT}
					updatePriority={-50}
					debug={physicsDebug}
				>
					<RuntimeBootstrap mapId={mapId} debug={debug} mode={mode}>
						<MapHost mapId={mapId} mode={mode} />
						<ChaosDrops mode={mode} />
						<LocalPlayer />
						<RemotePlayers />
						<WeaponViewModel />
						<CharacterView actorId="local" local team={0} />
						<CharacterView actorId="preview" team={1} />
						<WorldEffects />
					</RuntimeBootstrap>
				</Physics>
			</Suspense>
		</>
	);
}

function MapHost({
	mapId,
	mode,
}: {
	mapId: string;
	mode: GameMode;
}) {
	// Mode is a React prop so toggling Classic/Chaos is immediate and
	// does not depend on a silent runtime field mutation.
	if (mode === "chaos") {
		return <ChaosDesk />;
	}
	const entry = getMap(mapId) ?? getMap(DEFAULT_MAP_ID);
	const Component = entry?.component;
	if (!Component) return null;
	return <Component />;
}

function RuntimeBootstrap({
	mapId,
	debug,
	mode,
	children,
}: {
	mapId: string;
	debug: boolean;
	mode: GameMode;
	children: React.ReactNode;
}) {
	const gl = useThree((state) => state.gl);
	// Runtime is created once per canvas; mode is applied via setMode so
	// toggling Classic/Chaos never remounts physics.
	const runtime = useMemo(
		() => new GameRuntime(gl.domElement, { mapId, debug, mode }),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[gl, mapId, debug],
	);

	useEffect(() => {
		runtime.setMode(mode);
	}, [runtime, mode]);

	useEffect(() => {
		runtime.attachInput();
		useGameStore.getState().setRuntime(runtime);
		(globalThis as unknown as { __burst?: unknown }).__burst = {
			runtime,
			getLogLines,
			getUi: () => useGameStore.getState().ui,
			getDebug: () => useGameStore.getState().debug,
		};
		return () => {
			runtime.detachInput();
			runtime.detachPhysics();
			if (useGameStore.getState().runtime === runtime) {
				useGameStore.getState().setRuntime(null);
			}
		};
	}, [runtime]);

	return (
		<GameRuntimeContext.Provider value={runtime}>
			{children}
		</GameRuntimeContext.Provider>
	);
}
