import type { Vec3 } from "../../core/types";
import type {
	FireWeaponCommand,
	ProjectileDefinition,
} from "../WeaponDefinition";
import type { CharacterPhysics } from "../../physics/characterPhysics";
import type RAPIER from "@dimforge/rapier3d-compat";
import {
	WORLD_ENVIRONMENT,
	type BallisticEnvironment,
} from "../../sim/Environment";
import { HitRegions } from "../../character/HitRegions";
import {
	CollisionLayer,
	interactionGroups,
} from "../../physics/CollisionGroups";

export type ProjectileLaunch = {
	position: Vec3;
	velocity: Vec3;
	age: number;
	distance: number;
};
export function createProjectileLaunch(
	command: FireWeaponCommand,
): ProjectileLaunch {
	const length = Math.hypot(
		command.direction.x,
		command.direction.y,
		command.direction.z,
	);
	if (length < 1e-9) throw new Error("Projectile direction must be nonzero");
	const speed = command.projectile.muzzleVelocity / length;
	return {
		position: { ...command.origin },
		velocity: {
			x: command.direction.x * speed,
			y: command.direction.y * speed,
			z: command.direction.z * speed,
		},
		age: 0,
		distance: 0,
	};
}
function acceleration(
	velocity: Vec3,
	definition: ProjectileDefinition,
	environment: BallisticEnvironment,
): Vec3 {
	const relative = {
		x: velocity.x - environment.wind.x,
		y: velocity.y - environment.wind.y,
		z: velocity.z - environment.wind.z,
	};
	const speed = Math.hypot(relative.x, relative.y, relative.z);
	// Fdrag = 1/2 rho Cd A v². BC fixes CdA/m, so mass cancels in acceleration.
	// Keeping the force calculation explicit exposes mass/force for future penetration.
	const dragArea = definition.mass / definition.ballisticCoefficient;
	const forcePerVelocity = 0.5 * environment.airDensity * dragArea * speed;
	const drag = forcePerVelocity / definition.mass;
	return {
		x: environment.gravity.x - relative.x * drag,
		y: environment.gravity.y - relative.y * drag,
		z: environment.gravity.z - relative.z * drag,
	};
}
/** Midpoint integration; the caller sweeps each bounded substep for collisions. */
export function integrateProjectile(
	state: ProjectileLaunch,
	definition: ProjectileDefinition,
	dt: number,
	environment = WORLD_ENVIRONMENT,
): void {
	const a = acceleration(state.velocity, definition, environment);
	const mid = {
		x: state.velocity.x + (a.x * dt) / 2,
		y: state.velocity.y + (a.y * dt) / 2,
		z: state.velocity.z + (a.z * dt) / 2,
	};
	const next = acceleration(mid, definition, environment);
	state.position = {
		x: state.position.x + mid.x * dt,
		y: state.position.y + mid.y * dt,
		z: state.position.z + mid.z * dt,
	};
	state.velocity = {
		x: state.velocity.x + next.x * dt,
		y: state.velocity.y + next.y * dt,
		z: state.velocity.z + next.z * dt,
	};
	state.distance += Math.hypot(mid.x, mid.y, mid.z) * dt;
	state.age += dt;
}
export type BallisticEvent = {
	weaponId: string;
	damage: number;
	origin: Vec3;
	point: Vec3;
	normal: Vec3 | null;
	colliderHandle?: number;
	actorId?: string;
	region?: string;
	impactVelocity: Vec3;
	timeOfFlight: number;
	distance: number;
};
export class ProjectileSimulation {
	private active: Array<
		ProjectileLaunch & { command: FireWeaponCommand; owner: string }
	> = [];
	constructor(
		readonly regions = new HitRegions(),
		readonly environment = WORLD_ENVIRONMENT,
	) {}
	launch(command: FireWeaponCommand, owner = "local"): void {
		this.active.push({ ...createProjectileLaunch(command), command, owner });
	}
	clear(): void {
		this.active.length = 0;
	}
	get count(): number {
		return this.active.length;
	}
	update(
		dt: number,
		physics: CharacterPhysics,
		body: RAPIER.RigidBody,
	): BallisticEvent[] {
		if (!Number.isFinite(dt) || dt <= 0) return [];
		const events: BallisticEvent[] = [];
		this.active = this.active.filter((projectile) => {
			let remaining = dt;
			const origin = { ...projectile.position };
			while (
				remaining > 1e-9 &&
				projectile.age < this.environment.projectileLifetime
			) {
				const step = Math.min(
					remaining,
					this.environment.ballisticStep,
					this.environment.projectileLifetime - projectile.age,
				);
				const start = { ...projectile.position };
				const oldVelocity = { ...projectile.velocity };
				integrateProjectile(
					projectile,
					projectile.command.projectile,
					step,
					this.environment,
				);
				const delta = {
					x: projectile.position.x - start.x,
					y: projectile.position.y - start.y,
					z: projectile.position.z - start.z,
				};
				const distance = Math.hypot(delta.x, delta.y, delta.z);
				const world =
					distance > 0
						? physics.raycast(
								start,
								delta,
								distance,
								body,
								interactionGroups(
									CollisionLayer.PROJECTILE,
									CollisionLayer.WORLD_STATIC | CollisionLayer.WORLD_DYNAMIC,
								),
							)
						: null;
				const region = this.regions.cast(start, delta, projectile.owner);
				const characterHit =
					region && (!world || region.distance < world.toi) ? region : null;
				const hit = characterHit ?? world;
				if (hit) {
					const hitDistance = characterHit?.distance ?? world!.toi;
					const fraction = distance > 0 ? hitDistance / distance : 0;
					const profile = projectile.command.projectile;
					events.push({
						weaponId: projectile.command.weaponId,
						origin,
						point: hit.point,
						normal: hit.normal,
						damage:
							profile.baseDamage *
							(characterHit?.region === "head"
								? profile.headshotMultiplier
								: 1),
						actorId: characterHit?.actorId,
						region: characterHit?.region,
						colliderHandle: characterHit ? undefined : world?.colliderHandle,
						impactVelocity: {
							x:
								oldVelocity.x +
								(projectile.velocity.x - oldVelocity.x) * fraction,
							y:
								oldVelocity.y +
								(projectile.velocity.y - oldVelocity.y) * fraction,
							z:
								oldVelocity.z +
								(projectile.velocity.z - oldVelocity.z) * fraction,
						},
						timeOfFlight: projectile.age - step * (1 - fraction),
						distance: projectile.distance - distance + hitDistance,
					});
					return false;
				}
				remaining -= step;
			}
			events.push({
				weaponId: projectile.command.weaponId,
				damage: 0,
				origin,
				point: { ...projectile.position },
				normal: null,
				impactVelocity: { ...projectile.velocity },
				timeOfFlight: projectile.age,
				distance: projectile.distance,
			});
			return projectile.age < this.environment.projectileLifetime;
		});
		return events;
	}
}
