import type { Vec3 } from "../core/types";
export const add = (a: Vec3, b: Vec3): Vec3 => ({
	x: a.x + b.x,
	y: a.y + b.y,
	z: a.z + b.z,
});
export const sub = (a: Vec3, b: Vec3): Vec3 => ({
	x: a.x - b.x,
	y: a.y - b.y,
	z: a.z - b.z,
});
export const scale = (a: Vec3, n: number): Vec3 => ({
	x: a.x * n,
	y: a.y * n,
	z: a.z * n,
});
export const dot = (a: Vec3, b: Vec3): number =>
	a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const unit = (a: Vec3): Vec3 => scale(a, 1 / Math.max(length(a), 1e-8));
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
	add(a, scale(sub(b, a), t));
export const clamp = (v: number, a: number, b: number): number =>
	Math.max(a, Math.min(b, v));
export function rotate(v: Vec3, yaw: number): Vec3 {
	return {
		x: v.x * Math.cos(yaw) + v.z * Math.sin(yaw),
		y: v.y,
		z: -v.x * Math.sin(yaw) + v.z * Math.cos(yaw),
	};
}
/** Analytic two-bone solve. Pole is a world-space bend direction, not a canned pose. */
export function solveLimb(
	root: Vec3,
	end: Vec3,
	pole: Vec3,
	upper: number,
	lower: number,
): Vec3 {
	const delta = sub(end, root);
	const distance = Math.max(1e-5, length(delta));
	const direction = unit(delta);
	// Small reach adaptation keeps hands attached when weapon travel exceeds arm reach.
	const stretch = Math.max(1, distance / (upper + lower) + 0.001);
	upper *= stretch;
	lower *= stretch;
	const along = clamp(
		(upper * upper - lower * lower + distance * distance) / (2 * distance),
		0,
		upper,
	);
	const height = Math.sqrt(Math.max(0, upper * upper - along * along));
	let bend = sub(pole, scale(direction, dot(pole, direction)));
	if (length(bend) < 1e-5)
		bend = sub({ x: 1, y: 0, z: 0 }, scale(direction, direction.x));
	return add(add(root, scale(direction, along)), scale(unit(bend), height));
}
