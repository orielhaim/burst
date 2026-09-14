import type { Vec3 } from "../core/types";
import type { MovementRuntimeState } from "../player/MovementState";

/** Exact critically damped response, stable across fixed-step rates. */
export class ResponseSpring {
	value = 0;
	velocity = 0;
	step(target: number, frequency: number, dt: number): number {
		const offset = this.value - target;
		const impulse = this.velocity + frequency * offset;
		const decay = Math.exp(-frequency * dt);
		this.value = target + (offset + impulse * dt) * decay;
		this.velocity = (this.velocity - frequency * impulse * dt) * decay;
		return this.value;
	}
}

/** Motion is driven by velocity changes and distance travelled, with no jump timeline. */
export class LocomotionResponse {
	readonly x = new ResponseSpring();
	readonly y = new ResponseSpring();
	readonly z = new ResponseSpring();
	readonly pitch = new ResponseSpring();
	readonly yaw = new ResponseSpring();
	readonly roll = new ResponseSpring();
	readonly aimPitch = new ResponseSpring();
	readonly aimYaw = new ResponseSpring();
	readonly fov = new ResponseSpring();
	readonly cameraRoll = new ResponseSpring();
	private previous: Vec3 = { x: 0, y: 0, z: 0 };
	private previousYaw: number | null = null;
	private previousPitch = 0;
	private stride = 0;
	private support = 0;
	private acceleration: Vec3 = { x: 0, y: 0, z: 0 };

	update(dt: number, motion: MovementRuntimeState, yaw: number, pitch: number, ads: number): void {
		if (dt <= 0) return;
		const velocity = motion.velocity;
		const blend = 1 - Math.exp(-10 * dt);
		for (const axis of ["x", "y", "z"] as const) {
			const force = clamp((velocity[axis] - this.previous[axis]) / dt, -100, 100);
			this.acceleration[axis] += (force - this.acceleration[axis]) * blend;
		}
		this.previous = { ...velocity };
		const right = velocity.x * Math.cos(yaw) - velocity.z * Math.sin(yaw);
		const forward = -velocity.x * Math.sin(yaw) - velocity.z * Math.cos(yaw);
		const lateralForce = this.acceleration.x * Math.cos(yaw) - this.acceleration.z * Math.sin(yaw);
		const forwardForce = -this.acceleration.x * Math.sin(yaw) - this.acceleration.z * Math.cos(yaw);
		const yawRate = this.previousYaw === null ? 0 : clamp(Math.atan2(Math.sin(yaw - this.previousYaw), Math.cos(yaw - this.previousYaw)) / dt, -6, 6);
		const pitchRate = this.previousYaw === null ? 0 : clamp((pitch - this.previousPitch) / dt, -6, 6);
		this.previousYaw = yaw;
		this.previousPitch = pitch;
		this.support += ((motion.grounded && !motion.sliding ? 1 : 0) - this.support) * (1 - Math.exp(-20 * dt));
		// Distance sets footfall cadence. Strafe, speed and uneven support alter each step.
		const cadence = Math.min(13.5, motion.horizontalSpeed * 1.5);
		if (motion.grounded && !motion.sliding) this.stride += cadence * dt;
		const load = this.support * Math.min(1.5, motion.horizontalSpeed / 6.2);
		const step = Math.sin(this.stride);
		const foot = Math.sin(this.stride * 2 + 0.16 * Math.sin(this.stride * 0.73));
		const grip = 1 - ads * 0.82;
		const run = clamp((Math.abs(forward) - 6.2) / 2.9, 0, 1);
		const slide = motion.sliding ? Math.min(1, motion.horizontalSpeed / 9.1) : 0;
		this.x.step((-right * 0.002 - lateralForce * 0.00045 - yawRate * 0.009 + step * load * 0.004) * grip, 15, dt);
		this.y.step((-this.acceleration.y * 0.00065 + foot * load * 0.0035 - slide * 0.055) * grip, 14, dt);
		this.z.step((forwardForce * 0.0007 + Math.abs(forward) * 0.0015) * grip, 15, dt);
		this.pitch.step((forwardForce * 0.0009 - this.acceleration.y * 0.0007 - velocity.y * 0.0015 - pitchRate * 0.014 + foot * load * 0.004) * grip, 14, dt);
		this.yaw.step((-lateralForce * 0.00065 - yawRate * 0.018) * grip, 14, dt);
		this.roll.step((right * 0.005 + lateralForce * 0.001 + step * load * 0.007 + slide * 0.13) * grip, 13, dt);
		// These offsets also feed shot direction, so the optic and actual aim agree.
		const steadiness = 1 - ads * 0.55;
		this.aimPitch.step(clamp((forwardForce * 0.00025 - run * 0.009 - slide * 0.008 - this.acceleration.y * 0.00016 + foot * load * 0.00065) * steadiness, -0.022, 0.022), 23, dt);
		this.aimYaw.step(clamp((-lateralForce * 0.00012 + step * load * 0.0005) * steadiness, -0.008, 0.008), 23, dt);
		this.cameraRoll.step(clamp(-lateralForce * 0.0005 - right * 0.0008 - slide * 0.018, -0.03, 0.03) * (1 - ads * 0.85), 12, dt);
		this.fov.step((clamp((motion.horizontalSpeed - 6.2) / 2.9, 0, 1.4) * 3 + slide * 0.7 + clamp(forwardForce / 34, 0, 1) * 0.8) * (1 - ads), 12, dt);
	}
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
