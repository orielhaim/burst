import type { Vec3 } from "../core/types";

export type Horizontal = { x: number; z: number };

export function projectOnPlane(vector: Vec3, normal: Vec3): Vec3 {
	const amount = vector.x * normal.x + vector.y * normal.y + vector.z * normal.z;
	return {
		x: vector.x - normal.x * amount,
		y: vector.y - normal.y * amount,
		z: vector.z - normal.z * amount,
	};
}

export function accelerate(
	velocity: Horizontal,
	direction: Horizontal,
	desiredSpeed: number,
	acceleration: number,
	dt: number,
): Horizontal {
	const alongWish = velocity.x * direction.x + velocity.z * direction.z;
	const speedToAdd = desiredSpeed - alongWish;
	if (speedToAdd <= 0) return { ...velocity };
	const amount = Math.min(speedToAdd, Math.max(0, acceleration * dt));
	return {
		x: velocity.x + direction.x * amount,
		z: velocity.z + direction.z * amount,
	};
}

export function applyFriction(
	velocity: Horizontal,
	deceleration: number,
	friction: number,
	dt: number,
): Horizontal {
	const speed = Math.hypot(velocity.x, velocity.z);
	if (speed < 1e-6) return { x: 0, z: 0 };
	const drop = Math.max(deceleration, speed * friction) * Math.max(0, dt);
	const nextSpeed = Math.max(0, speed - drop);
	const scale = nextSpeed / speed;
	return { x: velocity.x * scale, z: velocity.z * scale };
}

export function steerVelocity(
	velocity: Horizontal,
	desiredDirection: Horizontal,
	maxRadians: number,
): Horizontal {
	const speed = Math.hypot(velocity.x, velocity.z);
	if (speed < 1e-6) return { ...velocity };
	const desiredLength = Math.hypot(desiredDirection.x, desiredDirection.z);
	if (desiredLength < 1e-6) return { ...velocity };
	const currentAngle = Math.atan2(velocity.z, velocity.x);
	const desiredAngle = Math.atan2(desiredDirection.z, desiredDirection.x);
	let delta = desiredAngle - currentAngle;
	delta = Math.atan2(Math.sin(delta), Math.cos(delta));
	const angle = currentAngle + clamp(delta, -maxRadians, maxRadians);
	return { x: Math.cos(angle) * speed, z: Math.sin(angle) * speed };
}

export function horizontalDot(a: Horizontal, b: Horizontal): number {
	return a.x * b.x + a.z * b.z;
}

export function clampHorizontal(
	velocity: Horizontal,
	maxSpeed: number,
): Horizontal {
	const speed = Math.hypot(velocity.x, velocity.z);
	if (speed <= maxSpeed || speed < 1e-6) return { ...velocity };
	const scale = maxSpeed / speed;
	return { x: velocity.x * scale, z: velocity.z * scale };
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
