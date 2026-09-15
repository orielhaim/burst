import type { DebugSnapshot, UiSnapshot } from "@burst/game-client";

type HudProps = {
	ui: UiSnapshot;
	debug: DebugSnapshot | null;
	showDebug: boolean;
};

export function Hud({ ui, debug, showDebug }: HudProps) {
	if (ui.phase !== "playing") return null;

	return (
		<div className="pointer-events-none absolute inset-0 select-none">
			{/* Keep the physical optic sharp while softening peripheral vision in ADS. */}
			<div
				aria-hidden="true"
				className="absolute inset-0 transition-opacity duration-150"
				style={{
					opacity: ui.adsProgress,
					backdropFilter: "blur(2.25px)",
					WebkitBackdropFilter: "blur(2.25px)",
					maskImage:
						"radial-gradient(circle at center, transparent 0 72px, rgba(0,0,0,0.15) 88px, black 118px)",
					WebkitMaskImage:
						"radial-gradient(circle at center, transparent 0 72px, rgba(0,0,0,0.15) 88px, black 118px)",
				}}
			/>
			{/* Crosshair */}
			<div
				className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-100"
				style={{ opacity: 1 - ui.adsProgress }}
			>
				<div className="relative h-6 w-6">
					<div className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-[#1c1814]" />
					<div className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-[#1c1814]" />
					<div className="absolute left-0 top-1/2 h-px w-2 -translate-y-1/2 bg-[#1c1814]" />
					<div className="absolute right-0 top-1/2 h-px w-2 -translate-y-1/2 bg-[#1c1814]" />
					<div className="absolute left-1/2 top-1/2 h-0.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-[#e85d4c]" />
				</div>
			</div>

			<div
				className="absolute right-6 top-1/2 -translate-y-1/2 space-y-1 font-mono text-xs"
				aria-label="Primary weapons"
			>
				{ui.loadout.map((weapon) => (
					<div
						key={weapon.id}
						aria-current={
							ui.selectedWeaponId === weapon.id ? "true" : undefined
						}
						className={`border-r-2 px-3 py-2 text-right ${ui.selectedWeaponId === weapon.id ? "border-[#e85d4c] bg-[#f2ead8]/80 text-[#1c1814]" : "border-transparent text-[#1c1814]/45"}`}
					>
						{weapon.name}
						{ui.selectedWeaponId === weapon.id && (
							<span className="ml-3 tabular-nums">
								{weapon.ammo} / {weapon.capacity}
							</span>
						)}
					</div>
				))}
			</div>
			{/* Bottom-right ammo */}
			<div className="absolute bottom-6 right-6 text-right">
				<div className="font-mono text-xs uppercase tracking-[0.2em] text-[#1c1814]/60">
					{ui.weaponName}
				</div>
				<div className="font-mono text-3xl font-bold tabular-nums text-[#1c1814]">
					{ui.meleeEquipped ? "MELEE" : ui.ammo}
					<span className="text-lg font-normal text-[#1c1814]/50">
						{" "}
						{!ui.meleeEquipped && `/ ${ui.magazineSize}`}
					</span>
				</div>
				{ui.reloading && (
					<div className="font-mono text-xs text-[#e85d4c]">
						RELOADING {Math.round(ui.reloadProgress * 100)}%
					</div>
				)}
			</div>

			{/* Bottom-left health placeholder */}
			<div className="absolute bottom-6 left-6">
				<div className="font-mono text-xs uppercase tracking-[0.2em] text-[#1c1814]/60">
					HP
				</div>
				<div className="font-mono text-2xl font-bold tabular-nums text-[#1c1814]">
					{ui.health}
					<span className="text-sm font-normal text-[#1c1814]/50">
						{" "}
						/ {ui.maxHealth}
					</span>
				</div>
			</div>

			{/* Special ability (Q) */}
			<div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
				<div className="font-mono text-xs uppercase tracking-[0.2em] text-[#1c1814]/60">
					Q · {ui.abilityName}
				</div>
				<div
					className={`mx-auto mt-1 h-1.5 w-28 overflow-hidden rounded-sm border border-[#1c1814]/25 bg-[#1c1814]/10`}
				>
					<div
						className={`h-full origin-left transition-transform duration-75 ${
							ui.abilityPulling
								? "bg-[#e85d4c]"
								: ui.abilityReady
									? "bg-[#1c1814]"
									: "bg-[#1c1814]/40"
						}`}
						style={{
							transform: `scaleX(${
								ui.abilityPulling
									? 1
									: ui.abilityCooldownDuration <= 0
										? 1
										: 1 - ui.abilityCooldown / ui.abilityCooldownDuration
							})`,
						}}
					/>
				</div>
				{ui.abilityPulling && (
					<div className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-[#e85d4c]">
						Pulling · jump or Q to release
					</div>
				)}
			</div>

			{/* Dev FPS / debug */}
			{showDebug && (
				<div className="absolute left-4 top-4 rounded border border-[#1c1814]/20 bg-[#f2ead8]/80 px-2 py-1 font-mono text-[11px] leading-relaxed text-[#1c1814]">
					<div>{ui.fps} fps</div>
					{debug && (
						<>
							<div>
								pos {debug.x.toFixed(1)} {debug.y.toFixed(1)}{" "}
								{debug.z.toFixed(1)}
							</div>
							<div>
								vel {debug.vx.toFixed(1)} {debug.vy.toFixed(1)}{" "}
								{debug.vz.toFixed(1)}
							</div>
							<div>
								{debug.mode} · {debug.horizontalSpeed.toFixed(1)} u/s
								{debug.sprinting ? " · sprint" : ""}
							</div>
							<div>
								desired {debug.desiredSpeed.toFixed(1)} · accel{" "}
								{debug.acceleration.toFixed(1)} u/s²
							</div>
							<div>
								ground {debug.grounded ? "yes" : "no"} · angle{" "}
								{((debug.groundAngle * 180) / Math.PI).toFixed(0)}° · air{" "}
								{debug.timeAirborne.toFixed(2)}s
							</div>
							<div>
								{debug.crouching ? "crouched " : ""}
								{debug.sliding ? "sliding " : ""}
								{debug.wallNormal
									? `wall ${debug.wallNormal.x.toFixed(1)} ${debug.wallNormal.y.toFixed(1)} ${debug.wallNormal.z.toFixed(1)}`
									: "no wall"}
							</div>
							<div>
								weapon retract {debug.weaponRetraction.toFixed(2)} u · lat{" "}
								{debug.weaponLateral.toFixed(2)} u
							</div>
							<svg
								aria-label="Recent horizontal speed"
								className="mt-1 h-8 w-44"
								viewBox="0 0 176 32"
							>
								<polyline
									fill="none"
									stroke="#e85d4c"
									strokeWidth="1.5"
									points={debug.speedHistory
										.map(
											(speed, index) =>
												`${(index / Math.max(1, debug.speedHistory.length - 1)) * 176},${32 - Math.min(31, speed * 2)}`,
										)
										.join(" ")}
								/>
							</svg>
						</>
					)}
				</div>
			)}
		</div>
	);
}
