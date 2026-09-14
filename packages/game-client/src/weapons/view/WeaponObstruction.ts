import type RAPIER from "@dimforge/rapier3d-compat";
import { ResponseSpring } from "../../sim/LocomotionResponse";
import type { Vec3 } from "../../core/types";
import type { CharacterPhysics } from "../../physics/characterPhysics";

export type WeaponProbe = {
	position: Vec3;
	radius: number;
};

export type WeaponObstructionResult = {
	retraction: number;
	lateral: number;
	vertical: number;
	normal: Vec3 | null;
	blocked: boolean;
};

/** Resolves a few volumetric view-model probes against solid Rapier colliders. */
export class WeaponObstruction {
	private readonly retraction = new ResponseSpring();
	private readonly lateral = new ResponseSpring();
	private readonly vertical = new ResponseSpring();
	private normal: Vec3 = { x: 0, y: 0, z: 0 };

	constructor(
		private readonly physics: CharacterPhysics,
		private readonly excludeBody: RAPIER.RigidBody,
		private readonly returnSpeed = 12,
	) {}

	resolve(
		camera: Vec3,
		probes: readonly WeaponProbe[],
		dt: number,
		basis = {
			right: { x: 1, y: 0, z: 0 },
			up: { x: 0, y: 1, z: 0 },
			back: { x: 0, y: 0, z: 1 },
		},
		config = {
			maxDisplacement: 0.14,
			approachDistance: 0.12,
			returnSpeed: this.returnSpeed,
		},
	): WeaponObstructionResult {
		dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
		const contacts: Array<{ normal: Vec3; depth: number; cushion: number }> =
			[];
		for (const probe of probes) {
			const delta = subtract(probe.position, camera);
			const distance = length(delta);
			if (distance < 1e-5) continue;
			const hit = this.physics.castSphere(
				camera,
				delta,
				probe.radius,
				distance + config.approachDistance,
				this.excludeBody,
			);
			if (!hit) continue;
			const incidence = Math.max(0, -dot(delta, hit.normal) / distance);
			contacts.push({
				normal: hit.normal,
				depth: Math.max(0, distance - hit.toi + 0.012) * incidence,
				cushion:
					Math.max(0, distance + config.approachDistance - hit.toi) *
					incidence *
					0.25,
			});
		}
		// Solve contact constraints in the camera plane first. Keep this bounded:
		// deep obstruction must retract rather than moving the sight across the screen.
		let x = 0;
		let y = 0;
		for (let iteration = 0; iteration < 3; iteration++)
			for (const contact of contacts) {
				const nx = dot(contact.normal, basis.right);
				const ny = dot(contact.normal, basis.up);
				const planar = nx * nx + ny * ny;
				if (planar < 0.08) continue;
				const remaining = Math.max(
					0,
					contact.depth + contact.cushion - x * nx - y * ny,
				);
				x += (nx * remaining) / planar;
				y += (ny * remaining) / planar;
				const scale = Math.min(
					1,
					config.maxDisplacement / Math.max(1e-6, Math.hypot(x, y)),
				);
				x *= scale;
				y *= scale;
			}
		this.lateral.step(x, 20, dt);
		this.vertical.step(y, 20, dt);
		let target = 0;
		const normal = { x: 0, y: 0, z: 0 };
		let weight = 0;
		for (const contact of contacts) {
			const planarCorrection =
				x * dot(contact.normal, basis.right) +
				y * dot(contact.normal, basis.up);
			const residual = Math.max(
				0,
				contact.depth + contact.cushion - planarCorrection,
			);
			const back = dot(contact.normal, basis.back);
			// Retract only after the desired planar correction spends its travel budget.
			// A bounded denominator avoids extreme pullback at grazing angles.
			target = Math.max(target, residual / Math.max(0.5, back));
			const w = contact.depth + contact.cushion;
			normal.x += contact.normal.x * w;
			normal.y += contact.normal.y * w;
			normal.z += contact.normal.z * w;
			weight += w;
		}
		if ((target - this.retraction.value) * this.retraction.velocity < 0)
			this.retraction.velocity = 0;
		this.retraction.step(
			target,
			target > this.retraction.value ? 24 : config.returnSpeed,
			dt,
		);
		const blend = 1 - Math.exp(-12 * dt);
		for (const axis of ["x", "y", "z"] as const)
			this.normal[axis] +=
				((weight > 0 ? normal[axis] / weight : 0) - this.normal[axis]) * blend;
		return {
			retraction: Math.max(0, this.retraction.value),
			lateral: this.lateral.value,
			vertical: this.vertical.value,
			normal: length(this.normal) > 1e-4 ? { ...this.normal } : null,
			blocked: contacts.some((contact) => contact.depth > 0),
		};
	}
}

function subtract(a: Vec3, b: Vec3): Vec3 {
	return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function length(value: Vec3): number {
	return Math.hypot(value.x, value.y, value.z);
}

function dot(a: Vec3, b: Vec3): number {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}
