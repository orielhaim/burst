import { WORLD_ENVIRONMENT } from "../sim/Environment";
import { CharacterView } from "../character/CharacterView";
import { Physics } from "@react-three/rapier";
import { Suspense, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { WorldEffects } from "../effects/WorldEffects";
import { getMap, testYardEntry } from "../maps/registry";
import { LocalPlayer, RemotePlayers } from "../player/LocalPlayer";
import { COLORS } from "../rendering/palette";
import { useDebugStore } from "../runtime/debugStore";
import { GameRuntime } from "../runtime/GameRuntime";
import { GameRuntimeContext } from "../runtime/GameRuntimeContext";
import { useGameStore } from "../runtime/gameStore";
import { getLogLines } from "../runtime/log";
import { WeaponViewModel } from "../weapons/WeaponViewModel";

function css(color: number): string {
	return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Declarative game scene:
 *
 * <Canvas> (web GameCanvas)
 *   <Physics>              ← Rapier world owner (steps itself, single world)
 *     <RuntimeBootstrap>   ← mutable GameRuntime, input attach
 *       <Map />            ← mesh + collider together per primitive
 *       <LocalPlayer />    ← physics attach, fixed-step driver, camera rig
 *       <RemotePlayers />  ← interpolation slot (multiplayer-ready)
 *       <WeaponViewModel />← camera-space pose hierarchy + PiP scope
 *       <WorldEffects />   ← pooled tracers/impacts
 *
 * React owns composition/mounting; simulation owns per-frame state.
 */
export function GameScene({
	mapId,
	debug = false,
}: {
	mapId: string;
	debug?: boolean;
}) {
	const physicsDebug = useDebugStore((state) => state.physicsDebug);
	return (
		<>
			<color attach="background" args={[css(COLORS.background)]} />
			<fog attach="fog" args={[css(COLORS.fog), 40, 90]} />
			<hemisphereLight args={[0xfff6e8, 0xc4b49a, 1.15]} />
			<directionalLight
				position={[18, 32, 12]}
				intensity={1.05}
				color={0xfff2dd}
			/>
			<directionalLight
				position={[-12, 10, -8]}
				intensity={0.35}
				color={0xd4e4ff}
			/>
			<Suspense fallback={null}>
				<Physics
					gravity={[
						WORLD_ENVIRONMENT.gravity.x,
						WORLD_ENVIRONMENT.gravity.y,
						WORLD_ENVIRONMENT.gravity.z,
					]}
					timeStep={1 / 60}
					debug={physicsDebug}
				>
					<RuntimeBootstrap mapId={mapId} debug={debug}>
						<MapHost mapId={mapId} />
						<LocalPlayer />
						<RemotePlayers />
						<WeaponViewModel />
						<CharacterView actorId="local" local />
						<CharacterView actorId="preview" />
						<WorldEffects />
					</RuntimeBootstrap>
				</Physics>
			</Suspense>
		</>
	);
}

function MapHost({ mapId }: { mapId: string }) {
	const entry = getMap(mapId) ?? testYardEntry;
	const Component = entry.component;
	return <Component />;
}

/**
 * Creates the mutable runtime from the R3F canvas element (pointer lock +
 * centralized input attach) and publishes it via context + store. Cleanup on
 * unmount detaches input so HMR/route changes never duplicate listeners.
 */
function RuntimeBootstrap({
	mapId,
	debug,
	children,
}: {
	mapId: string;
	debug: boolean;
	children: React.ReactNode;
}) {
	const gl = useThree((state) => state.gl);
	const runtime = useMemo(
		() => new GameRuntime(gl.domElement, { mapId, debug }),
		[gl, mapId, debug],
	);

	useEffect(() => {
		runtime.attachInput();
		useGameStore.getState().setRuntime(runtime);
		// Dev inspection handle (never used by the game itself).
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
