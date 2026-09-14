import { lazy, Suspense } from "react";
import { useGameStore } from "@burst/game-client";
import { GameCanvas } from "./GameCanvas";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { Hud } from "./Hud";
import { Overlays } from "./Overlays";

const DevLeva = lazy(() =>
	import("./DevLeva").then((module) => ({ default: module.DevLeva })),
);

/**
 * Canvas host + React UI overlay.
 * R3F owns renderer/scene/camera/loop inside GameCanvas; React reads
 * low-frequency snapshots from the game store for HUD/menus.
 */
export function GameShell({ mapId = "test-yard" }: { mapId?: string }) {
	const ui = useGameStore((state) => state.ui);
	const debug = useGameStore((state) => state.debug);
	const runtime = useGameStore((state) => state.runtime);
	const ready = runtime !== null;

	return (
		<div className="relative h-screen w-screen overflow-hidden bg-[#f2ead8]">
			<div className="absolute inset-0">
				<GameErrorBoundary>
					<GameCanvas mapId={mapId} />
				</GameErrorBoundary>
			</div>
			<Hud ui={ui} debug={debug} showDebug={import.meta.env.DEV} />
			<Overlays
				phase={ui.phase}
				ready={ready}
				error={null}
				onPlay={() => runtime?.play()}
				onResume={() => runtime?.resume()}
			/>
			{import.meta.env.DEV ? (
				<Suspense fallback={null}>
					<DevLeva />
				</Suspense>
			) : null}
		</div>
	);
}
