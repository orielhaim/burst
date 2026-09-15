import { lazy, Suspense, useEffect, useState } from "react";
import { useGameStore, type GameMode } from "@burst/game-client";
import { GameCanvas } from "./GameCanvas";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { Hud } from "./Hud";
import { Overlays } from "./Overlays";

const DevLeva = lazy(() =>
	import("./DevLeva").then((module) => ({ default: module.DevLeva })),
);

/**
 * Canvas host + React UI overlay for the desk / notebook doodle world.
 * Mode (classic / chaos) is chosen before Play; parachute entry always runs.
 */
export function GameShell({ mapId = "desk-battlefield" }: { mapId?: string }) {
	const ui = useGameStore((state) => state.ui);
	const debug = useGameStore((state) => state.debug);
	const runtime = useGameStore((state) => state.runtime);
	const ready = runtime !== null;
	const [mode, setMode] = useState<GameMode>("classic");

	useEffect(() => {
		runtime?.setMode(mode);
	}, [runtime, mode]);

	return (
		<div className="relative h-screen w-screen overflow-hidden bg-[#f6f0e2]">
			<div className="absolute inset-0">
				<GameErrorBoundary>
					<GameCanvas mapId={mapId} mode={mode} />
				</GameErrorBoundary>
			</div>
			<Hud ui={ui} debug={debug} showDebug={import.meta.env.DEV} />
			<Overlays
				phase={ui.phase}
				ready={ready}
				error={null}
				mode={mode}
				onModeChange={setMode}
				onPlay={() => {
					runtime?.setMode(mode);
					runtime?.play();
				}}
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
