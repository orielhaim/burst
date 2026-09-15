import type { GameMode, GamePhase } from "@burst/game-client";

type OverlaysProps = {
	phase: GamePhase;
	ready: boolean;
	error: string | null;
	mode: GameMode;
	onModeChange: (mode: GameMode) => void;
	onPlay: () => void;
	onResume: () => void;
};

/** Notebook-cover menu: paper card, mode toggle, parachute CTA. */
export function Overlays({
	phase,
	ready,
	error,
	mode,
	onModeChange,
	onResume,
	onPlay,
}: OverlaysProps) {
	if (error) {
		return (
			<div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f6f0e2]">
				<div className="max-w-md rotate-[-1deg] border-2 border-[#1c1814] bg-[#fffef8] p-8 text-center shadow-[6px_6px_0_#1c1814]">
					<h1 className="font-mono text-xl font-bold text-[#e85d4c]">
						Failed to start
					</h1>
					<p className="mt-3 font-mono text-sm text-[#1c1814]/80">{error}</p>
				</div>
			</div>
		);
	}

	// Parachute: keep the world visible; only a sticky banner.
	if (phase === "dropping") {
		return (
			<div className="pointer-events-none absolute inset-x-0 top-6 z-20 flex flex-col items-center gap-2">
				<div className="rotate-[-1deg] border-2 border-[#1c1814] bg-[#ffe566] px-5 py-2 font-mono text-sm font-bold uppercase tracking-[0.18em] shadow-[4px_4px_0_#1c1814]">
					Pick your landing spot
				</div>
				<div className="bg-[#fffef8]/90 px-3 py-1 font-mono text-xs">WASD to steer · Mouse to look · Hold Shift to dive</div>
				{mode === "chaos" && (
					<div className="rotate-[1deg] border-2 border-[#1c1814] bg-[#ff9eb5] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] shadow-[3px_3px_0_#1c1814]">
						Building the desk · chaos rain
					</div>
				)}
			</div>
		);
	}

	if (phase === "playing") return null;

	if (!ready && phase === "menu") {
		return (
			<div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f6f0e2]">
				<p className="font-mono text-sm uppercase tracking-[0.3em] text-[#1c1814]/60">
					Sharpening pencils…
				</p>
			</div>
		);
	}

	const isPause = phase === "paused";

	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f6f0e2]/85 backdrop-blur-[2px]">
			<div
				className="relative w-full max-w-md border-2 border-[#1c1814] bg-[#fffef8] px-10 py-12 shadow-[10px_10px_0_#1c1814]"
				style={{
					backgroundImage: `repeating-linear-gradient(
						transparent,
						transparent 27px,
						rgba(111,148,196,0.35) 28px
					)`,
					backgroundPosition: "0 48px",
				}}
			>
				<div className="absolute inset-y-0 left-8 w-px bg-[#d96458]/50" />
				<div className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-[#1c1814]/45">
					{isPause ? "Pencil down" : "Desk · Notebook · Drop-in"}
				</div>
				<h1 className="font-mono text-5xl font-black tracking-tight text-[#1c1814]">
					BURST
				</h1>
				<p className="mt-2 font-mono text-sm text-[#1c1814]/70">
					{isPause
						? "Paused mid-doodle."
						: "Skydive onto the desk. Land anywhere. Start fighting."}
				</p>
				<div className="mx-auto mt-4 h-1 w-20 rotate-[-1deg] bg-[#e85d4c]" />

				{!isPause && (
					<div className="mt-6">
						<div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#1c1814]/50">
							Mode
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => onModeChange("classic")}
								className={`flex-1 cursor-pointer border-2 border-[#1c1814] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] shadow-[3px_3px_0_#1c1814] transition-transform ${
									mode === "classic"
										? "bg-[#9ed4f0] text-[#1c1814]"
										: "bg-[#fffef8] text-[#1c1814]/50"
								}`}
							>
								Classic
							</button>
							<button
								type="button"
								onClick={() => onModeChange("chaos")}
								className={`flex-1 cursor-pointer border-2 border-[#1c1814] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] shadow-[3px_3px_0_#1c1814] transition-transform ${
									mode === "chaos"
										? "bg-[#ff9eb5] text-[#1c1814]"
										: "bg-[#fffef8] text-[#1c1814]/50"
								}`}
							>
								Chaos Mode
							</button>
						</div>
						<p className="mt-2 font-mono text-[11px] leading-snug text-[#1c1814]/50">
							{mode === "chaos"
								? "A light rain of books, mugs & stationery builds cover, leaving room to move."
								: "Explore the desk. Choose your landing."}
						</p>
					</div>
				)}

				<p className="mt-5 font-mono text-xs leading-relaxed text-[#1c1814]/55">
					WASD move · Shift sprint · Ctrl crouch / slide
					<br />
					Space jump · Mouse look / fire · R reload · Q ability · Esc pause
				</p>
				<button
					type="button"
					onClick={isPause ? onResume : onPlay}
					disabled={!ready}
					className="mt-8 w-full cursor-pointer border-2 border-[#1c1814] bg-[#ffe566] px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.18em] text-[#1c1814] shadow-[4px_4px_0_#1c1814] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#1c1814] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isPause ? "Resume scribbling" : "Drop in"}
				</button>
			</div>
		</div>
	);
}
