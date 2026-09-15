import type { DebugSnapshot, UiSnapshot } from "@burst/game-client";

type HudProps = {
	ui: UiSnapshot;
	debug: DebugSnapshot | null;
	showDebug: boolean;
};

/**
 * Paper-stationery HUD: ink type, sticky accents, pencil crosshair.
 */
export function Hud({ ui, debug, showDebug }: HudProps) {
	// Parachute: light progress only — combat HUD waits until touchdown.
	if (ui.phase === "dropping") {
		return (
			<div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center">
				<div className="w-56">
					<div className="mb-1 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#1c1814]/55">
						Descent · {Math.round(ui.dropProgress * 100)}%
					</div>
					<div className="h-2 overflow-hidden border-2 border-[#1c1814] bg-[#fffef8]">
						<div
							className="h-full origin-left bg-[#3d8ec4]"
							style={{
								width: `${Math.round(ui.dropProgress * 100)}%`,
							}}
						/>
					</div>
				</div>
			</div>
		);
	}

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
			{/* Pencil-mark crosshair */}
			<div
				className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-100"
				style={{ opacity: 1 - ui.adsProgress }}
			>
				<div className="relative h-7 w-7">
					<div className="absolute left-1/2 top-0 h-2.5 w-[2px] -translate-x-1/2 rotate-[2deg] bg-[#1c1814]" />
					<div className="absolute bottom-0 left-1/2 h-2.5 w-[2px] -translate-x-1/2 -rotate-[1deg] bg-[#1c1814]" />
					<div className="absolute left-0 top-1/2 h-[2px] w-2.5 -translate-y-1/2 rotate-[-2deg] bg-[#1c1814]" />
					<div className="absolute right-0 top-1/2 h-[2px] w-2.5 -translate-y-1/2 rotate-[1deg] bg-[#1c1814]" />
					<div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rotate-12 bg-[#e85d4c]" />
				</div>
			</div>

			{/* Weapon loadout sticky strip */}
			<div
				className="absolute right-5 top-1/2 -translate-y-1/2 space-y-1 font-mono text-xs"
				aria-label="Primary weapons"
			>
				{ui.loadout.map((weapon, index) => {
					const active = ui.selectedWeaponId === weapon.id;
					return (
						<div
							key={weapon.id}
							aria-current={active ? "true" : undefined}
							className={`border-2 px-3 py-2 text-right ${
								active
									? "border-[#1c1814] bg-[#ffe566] text-[#1c1814] shadow-[3px_3px_0_#1c1814]"
									: "border-[#1c1814]/20 bg-[#fffef8]/70 text-[#1c1814]/45"
							}`}
							style={{ transform: `rotate(${active ? -1 : (index - 1) * 0.6}deg)` }}
						>
							{weapon.name}
							{active && (
								<span className="ml-3 tabular-nums">
									{weapon.ammo} / {weapon.capacity}
								</span>
							)}
						</div>
					);
				})}
			</div>

			{/* Bottom-right ammo */}
			<div className="absolute bottom-6 right-6 text-right">
				<div className="font-mono text-xs uppercase tracking-[0.18em] text-[#1c1814]/55">
					{ui.weaponName}
				</div>
				<div className="font-mono text-4xl font-black tabular-nums text-[#1c1814]">
					{ui.meleeEquipped ? "STAB" : ui.ammo}
					<span className="text-lg font-normal text-[#1c1814]/45">
						{" "}
						{!ui.meleeEquipped && `/ ${ui.magazineSize}`}
					</span>
				</div>
				{ui.reloading && (
					<div className="mt-1 inline-block rotate-[-2deg] bg-[#ff9eb5] px-2 py-0.5 font-mono text-xs text-[#1c1814]">
						reloading {Math.round(ui.reloadProgress * 100)}%
					</div>
				)}
			</div>

			{/* Bottom-left health */}
			<div className="absolute bottom-6 left-6">
				<div className="font-mono text-xs uppercase tracking-[0.18em] text-[#1c1814]/55">
					HP
				</div>
				<div className="flex items-end gap-1">
					<div className="font-mono text-3xl font-black tabular-nums text-[#1c1814]">
						{ui.health}
					</div>
					<div className="mb-1 font-mono text-sm text-[#1c1814]/45">
						/ {ui.maxHealth}
					</div>
				</div>
				<div className="mt-1 h-2 w-28 border border-[#1c1814]/40 bg-[#fffef8]">
					<div
						className="h-full origin-left bg-[#e85d4c]"
						style={{ width: `${(ui.health / Math.max(1, ui.maxHealth)) * 100}%` }}
					/>
				</div>
			</div>

			{/* Special ability (Q) */}
			<div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
				<div className="font-mono text-xs uppercase tracking-[0.18em] text-[#1c1814]/55">
					Q · {ui.abilityName}
				</div>
				<div className="mx-auto mt-1 h-2 w-32 overflow-hidden border-2 border-[#1c1814] bg-[#fffef8]">
					<div
						className={`h-full origin-left ${
							ui.abilityPulling
								? "bg-[#e85d4c]"
								: ui.abilityReady
									? "bg-[#3d8ec4]"
									: "bg-[#1c1814]/25"
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
					<div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#e85d4c]">
						Pulling · jump or Q to release
					</div>
				)}
			</div>

			{/* Dev FPS / debug */}
			{showDebug && (
				<div className="absolute left-4 top-4 rotate-[-1deg] border-2 border-[#1c1814]/30 bg-[#fffef8]/90 px-2 py-1 font-mono text-[11px] leading-relaxed text-[#1c1814]">
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
