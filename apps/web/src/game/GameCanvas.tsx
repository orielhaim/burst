import { lazy, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Vignette } from "@react-three/postprocessing";
import { GameScene, type GameMode } from "@burst/game-client";

const TuningPanel = lazy(() =>
	import("./TuningPanel").then((module) => ({ default: module.TuningPanel })),
);

/**
 * TanStack page owns this: R3F Canvas for the game, DOM for HUD.
 * Soft vignette keeps the paper-world focus without looking like a filter pack.
 */
export function GameCanvas({
	mapId = "desk-battlefield",
	mode = "classic",
}: {
	mapId?: string;
	mode?: GameMode;
}) {
	return (
		<Canvas
			dpr={[1, 2]}
			gl={{ antialias: true, powerPreference: "high-performance" }}
			camera={{ fov: 75, near: 0.05, far: 280 }}
		>
			<GameScene mapId={mapId} mode={mode} debug={import.meta.env.DEV} />
			<EffectComposer multisampling={4}>
				<Vignette eskil={false} offset={0.32} darkness={0.38} />
			</EffectComposer>
			{import.meta.env.DEV ? (
				<Suspense fallback={null}>
					<TuningPanel />
				</Suspense>
			) : null}
		</Canvas>
	);
}
