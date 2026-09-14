import type { Vec3 } from "../core/types";

export type CameraStateConfig = {
	fov: number;
	near: number;
	far: number;
	/** Radians per pixel of mouse movement. */
	sensitivity: number;
	minPitch: number;
	maxPitch: number;
	heightSmoothing: number;
};

export const DEFAULT_CAMERA_STATE_CONFIG: CameraStateConfig = {
	fov: 75,
	near: 0.05,
	far: 200,
	sensitivity: 0.0022,
	minPitch: -Math.PI / 2 + 0.05,
	maxPitch: Math.PI / 2 - 0.05,
	heightSmoothing: 16,
};

/**
 * Framework-independent first-person look + recoil state.
 * No Three.js: the R3F `PlayerCamera` component applies this to the real
 * R3F camera every frame. Pure math so server re-simulation can reuse it.
 */
export class CameraState {
	private yaw = 0;
	private pitch = 0;
	private visualEyeHeight: number | null = null;

	private recoilPitch = 0;
	private recoilYaw = 0;
	private recoilPitchVel = 0;
	private recoilYawVel = 0;

	constructor(
		private readonly config: CameraStateConfig = DEFAULT_CAMERA_STATE_CONFIG,
	) {}

	getYaw(): number {
		return this.yaw;
	}

	getPitch(): number {
		return this.pitch;
	}

	getRecoil(): { pitch: number; yaw: number } {
		return { pitch: this.recoilPitch, yaw: this.recoilYaw };
	}

	getVisualEyeHeight(): number | null {
		return this.visualEyeHeight;
	}

	setYawPitch(yaw: number, pitch: number): void {
		this.yaw = yaw;
		this.pitch = clamp(pitch, this.config.minPitch, this.config.maxPitch);
	}

	applyLookDelta(dx: number, dy: number): void {
		this.yaw -= dx * this.config.sensitivity;
		this.pitch -= dy * this.config.sensitivity;
		this.pitch = clamp(this.pitch, this.config.minPitch, this.config.maxPitch);
		if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
		if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
	}

	addRecoil(pitch: number, yaw: number): void {
		this.recoilPitchVel += pitch;
		this.recoilYawVel += yaw;
	}

	forward(pitchOffset = 0, yawOffset = 0): Vec3 {
		const cosPitch = Math.cos(this.pitch + this.recoilPitch + pitchOffset);
		return {
			x: -Math.sin(this.yaw + this.recoilYaw + yawOffset) * cosPitch,
			y: Math.sin(this.pitch + this.recoilPitch + pitchOffset),
			z: -Math.cos(this.yaw + this.recoilYaw + yawOffset) * cosPitch,
		};
	}

	/**
	 * Critically-damped-ish recoil spring. Matches the old PlayerCamera feel:
	 * stiffness 90, damping 14 with exponential decay.
	 */
	updateRecoil(dt: number): void {
		const stiffness = 90;
		const damping = 14;
		this.recoilPitchVel += -this.recoilPitch * stiffness * dt;
		this.recoilYawVel += -this.recoilYaw * stiffness * dt;
		const decay = Math.exp(-damping * dt);
		this.recoilPitchVel *= decay;
		this.recoilYawVel *= decay;
		this.recoilPitch += this.recoilPitchVel * dt;
		this.recoilYaw += this.recoilYawVel * dt;
	}

	/** Smooth eye-height transitions (stand/crouch/slide). Returns active height. */
	smoothEyeHeight(target: number, dt: number): number {
		if (this.visualEyeHeight === null) this.visualEyeHeight = target;
		const blend = 1 - Math.exp(-this.config.heightSmoothing * dt);
		this.visualEyeHeight += (target - this.visualEyeHeight) * blend;
		return this.visualEyeHeight;
	}

	resetPresentation(): void {
		this.visualEyeHeight = null;
		this.recoilPitch = 0;
		this.recoilYaw = 0;
		this.recoilPitchVel = 0;
		this.recoilYawVel = 0;
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
