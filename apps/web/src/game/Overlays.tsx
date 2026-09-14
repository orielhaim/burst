import type { GamePhase } from "@burst/game-client";

type OverlaysProps = {
	phase: GamePhase;
	ready: boolean;
	error: string | null;
	onPlay: () => void;
	onResume: () => void;
};

export function Overlays({
	phase,
	ready,
	error,
	onPlay,
	onResume,
}: OverlaysProps) {
	if (error) {
		return (
			<div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f2ead8]">
				<div className="max-w-md border-2 border-[#1c1814] bg-[#fffdf6] p-8 text-center shadow-[6px_6px_0_#1c1814]">
					<h1 className="font-mono text-xl font-bold text-[#e85d4c]">
						Failed to start
					</h1>
					<p className="mt-3 font-mono text-sm text-[#1c1814]/80">{error}</p>
				</div>
			</div>
		);
	}

	if (phase === "playing") return null;

	if (!ready && phase === "menu") {
		return (
			<div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f2ead8]">
				<p className="font-mono text-sm uppercase tracking-[0.3em] text-[#1c1814]/60">
					Loading…
				</p>
			</div>
		);
	}

	const isPause = phase === "paused";

	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f2ead8]/85 backdrop-blur-[1px]">
			<div className="w-full max-w-sm border-2 border-[#1c1814] bg-[#fffdf6] p-10 text-center shadow-[8px_8px_0_#1c1814]">
				<div className="mb-2 font-mono text-[11px] uppercase tracking-[0.4em] text-[#1c1814]/50">
					{isPause ? "Paused" : "Vertical slice"}
				</div>
				<h1 className="font-mono text-4xl font-black tracking-tight text-[#1c1814]">
					BURST
				</h1>
				<div className="mx-auto mt-3 h-0.5 w-16 bg-[#e85d4c]" />
				<p className="mt-4 font-mono text-xs leading-relaxed text-[#1c1814]/60">
					WASD move · Shift sprint · Ctrl crouch / slide
					<br />
					Space jump · Mouse look / fire · R reload · Esc pause
				</p>
				<button
					type="button"
					onClick={isPause ? onResume : onPlay}
					disabled={!ready}
					className="mt-8 w-full cursor-pointer border-2 border-[#1c1814] bg-[#e85d4c] px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-[#fffdf6] shadow-[4px_4px_0_#1c1814] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#1c1814] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isPause ? "Resume" : "Play"}
				</button>
			</div>
		</div>
	);
}
