import type { Vec3 } from "../core/types";
export type HitRegion = { name: string; center: Vec3; radius: number };
export type RegionHit = {
	actorId: string;
	region: string;
	point: Vec3;
	normal: Vec3;
	distance: number;
};
/** World-space hit volumes supplied by character simulation, never by meshes. */
export class HitRegions {
	private actors = new Map<string, readonly HitRegion[]>();
	set(actorId: string, regions: readonly HitRegion[]): void {
		this.actors.set(actorId, regions);
	}
	remove(actorId: string): void {
		this.actors.delete(actorId);
	}
	clear(): void {
		this.actors.clear();
	}
	cast(origin: Vec3, delta: Vec3, exclude?: string): RegionHit | null {
		const length = Math.hypot(delta.x, delta.y, delta.z);
		if (length < 1e-9) return null;
		const d = { x: delta.x / length, y: delta.y / length, z: delta.z / length };
		let best: RegionHit | null = null;
		for (const [actorId, regions] of this.actors) {
			if (actorId === exclude) continue;
			for (const region of regions) {
				const o = {
					x: origin.x - region.center.x,
					y: origin.y - region.center.y,
					z: origin.z - region.center.z,
				};
				const b = o.x * d.x + o.y * d.y + o.z * d.z;
				const c = o.x * o.x + o.y * o.y + o.z * o.z - region.radius ** 2;
				const discriminant = b * b - c;
				if (discriminant < 0) continue;
				const distance = c <= 0 ? 0 : -b - Math.sqrt(discriminant);
				if (
					distance < 0 ||
					distance > length ||
					(best && distance >= best.distance)
				)
					continue;
				const point = {
					x: origin.x + d.x * distance,
					y: origin.y + d.y * distance,
					z: origin.z + d.z * distance,
				};
				best = {
					actorId,
					region: region.name,
					distance,
					point,
					normal: {
						x: (point.x - region.center.x) / region.radius,
						y: (point.y - region.center.y) / region.radius,
						z: (point.z - region.center.z) / region.radius,
					},
				};
			}
		}
		return best;
	}
}
