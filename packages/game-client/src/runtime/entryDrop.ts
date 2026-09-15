import type { Vec3 } from "../core/types";

export const ENTRY_DROP_CONFIG = {
	startHeight: 58,
	startPitch: -0.65,
	airSteerSpeed: 9,
	descentSpeed: 8,
	diveSpeed: 18,
	response: 3.5,
};
export type EntryDropTarget = { position: Vec3; yaw: number };

/** Entry owns flight intent; the player motor owns position and touchdown. */
export class EntryDrop {
	epoch = 0;
	active = false;
	private origin: Vec3 = { x: 0, y: 0, z: 0 };
	private heading = 0;
	private height = 0;
	private velocity: Vec3 = { x: 0, y: -8, z: 0 };
	start(target: EntryDropTarget): void {
		this.epoch++;
		this.active = true;
		this.origin = { ...target.position, y: target.position.y + ENTRY_DROP_CONFIG.startHeight };
		this.height = this.origin.y;
		this.heading = target.yaw;
		this.velocity = { x: 0, y: -8, z: 0 };
	}
	flightVelocity(moveX: number, moveZ: number, yaw: number, dive: boolean, dt: number): Vec3 {
		const length = Math.max(1, Math.hypot(moveX, moveZ));
		const x = moveX / length, z = moveZ / length;
		const speed = ENTRY_DROP_CONFIG.airSteerSpeed;
		const blend = 1 - Math.exp(-ENTRY_DROP_CONFIG.response * dt);
		const target = {
			x: (x * Math.cos(yaw) - z * Math.sin(yaw)) * speed,
			y: -(dive ? ENTRY_DROP_CONFIG.diveSpeed : ENTRY_DROP_CONFIG.descentSpeed),
			z: (-x * Math.sin(yaw) - z * Math.cos(yaw)) * speed,
		};
		for (const axis of ["x", "y", "z"] as const)
			this.velocity[axis] += (target[axis] - this.velocity[axis]) * blend;
		return { ...this.velocity };
	}
	observe(position: Vec3, grounded: boolean): boolean {
		this.height = position.y;
		if (grounded) this.active = false;
		return !this.active;
	}
	get position(): Vec3 { return { ...this.origin }; }
	get yaw(): number { return this.heading; }
	get pitch(): number { return ENTRY_DROP_CONFIG.startPitch; }
	get progress(): number {
		return this.active ? Math.max(0, Math.min(0.99, (this.origin.y - this.height) / ENTRY_DROP_CONFIG.startHeight)) : 1;
	}
}
