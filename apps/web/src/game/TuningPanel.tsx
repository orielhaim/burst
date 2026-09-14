import { useEffect } from "react";
import { useControls } from "leva";
import { useDebugStore, useGameStore } from "@burst/game-client";

/**
 * Development-only tuning (Leva). Production truth stays in code
 * (MovementConfig, weapon/recoil definitions); these overrides mutate the
 * live runtime and never persist.
 */
export function TuningPanel() {
	const runtime = useGameStore((state) => state.runtime);
	const setPhysicsDebug = useDebugStore((state) => state.setPhysicsDebug);

	const values = useControls("game", {
		physicsDebug: false,
		fov: { value: 75, min: 50, max: 110, step: 1 },
		fovKick: { value: 1, min: 0, max: 2.5, step: 0.05 },
		walkSpeed: { value: 6.2, min: 1, max: 14, step: 0.1 },
		sprintSpeed: { value: 9.1, min: 1, max: 16, step: 0.1 },
		jumpVelocity: { value: 9.2, min: 1, max: 16, step: 0.1 },
		slideFriction: { value: 7.5, min: 0, max: 12, step: 0.1 },
		adsSpeed: { value: 1, min: 0.2, max: 3, step: 0.05 },
		recoilScale: { value: 1, min: 0, max: 3, step: 0.05 },
		scopeResolution: { value: 0, min: 0, max: 1, step: 0.05 },
	});

	useEffect(() => {
		if (!runtime) return;
		setPhysicsDebug(values.physicsDebug);
		runtime.fovOverride = values.fov;
		runtime.fovKickScale = values.fovKick;
		runtime.movementConfig.walkSpeed = values.walkSpeed;
		runtime.movementConfig.sprintSpeed = values.sprintSpeed;
		runtime.movementConfig.jumpVelocity = values.jumpVelocity;
		runtime.movementConfig.slideFriction = values.slideFriction;
		runtime.adsSpeedScale = values.adsSpeed;
		runtime.recoilScale = values.recoilScale;
		runtime.scopeResolutionScale = values.scopeResolution || null;
	}, [values, runtime, setPhysicsDebug]);

	return null;
}
