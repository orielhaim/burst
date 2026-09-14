import { lazy, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Vignette } from "@react-three/postprocessing";
import { GameScene } from "@burst/game-client";

const TuningPanel = lazy(() =>
	import("./TuningPanel").then((module) => ({ default: module.TuningPanel })),
);

/**
 * TanStack page owns this: R3F Canvas for the game, DOM for HUD.
 * Post-processing stays minimal (vignette only) — the architecture is ready
 * for outlines/bloom/sketch passes without replacement.
 */
export function GameCanvas({ mapId = "test-yard" }: { mapId?: string }) {
	return (
		<Canvas
			dpr={[1, 2]}
			gl={{ antialias: true, powerPreference: "high-performance" }}
			camera={{ fov: 75, near: 0.05, far: 200 }}
		>
			<GameScene mapId={mapId} debug={import.meta.env.DEV} />
			<EffectComposer multisampling={4}>
				<Vignette eskil={false} offset={0.25} darkness={0.55} />
			</EffectComposer>
			{import.meta.env.DEV ? (
				<Suspense fallback={null}>
					<TuningPanel />
				</Suspense>
			) : null}
		</Canvas>
	);
}
