import { Component, type ReactNode } from "react";
import { getLogLines } from "@burst/game-client";

type State = { error: Error | null };

/** Dev-visible crash card: surfaces the full stack so physics/R3F failures are actionable. */
export class GameErrorBoundary extends Component<{ children: ReactNode }, State> {
	override state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	override componentDidCatch(error: Error, info: { componentStack?: string }): void {
		console.error("[burst] game crashed:", error, info.componentStack);
	}

	override render(): ReactNode {
		if (!this.state.error) return this.props.children;
		const error = this.state.error;
		return (
			<div className="absolute inset-0 z-30 overflow-auto bg-[#f2ead8] p-6">
				<div className="mx-auto max-w-2xl border-2 border-[#1c1814] bg-[#fffdf6] p-6 shadow-[6px_6px_0_#1c1814]">
					<h1 className="font-mono text-lg font-bold text-[#e85d4c]">
						Game crashed: {error.name}
					</h1>
					<p className="mt-2 font-mono text-sm text-[#1c1814]">{error.message}</p>
					{error.stack ? (
						<pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#1c1814]/80">
							{error.stack}
						</pre>
					) : null}
					<h2 className="mt-4 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#1c1814]/60">
						Lifecycle log
					</h2>
					<pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#1c1814]/80">
						{getLogLines().join("\n") || "(empty)"}
					</pre>
					<p className="mt-4 font-mono text-xs text-[#1c1814]/60">
						Paste this stack into the thread. Restart the dev server fully and
						hard-refresh before retrying.
					</p>
				</div>
			</div>
		);
	}
}
