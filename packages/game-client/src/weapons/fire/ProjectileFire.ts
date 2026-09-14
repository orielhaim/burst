import type { Vec3 } from "../../core/types";
import type { FireWeaponCommand } from "../WeaponDefinition";

export type ProjectileLaunch = {
	position: Vec3;
	velocity: Vec3;
	gravity: number;
	lifetimeRemaining: number;
};

/** Converts a projectile command into server/client-simulatable launch state. */
export function createProjectileLaunch(
	command: FireWeaponCommand,
): ProjectileLaunch {
	if (command.projectile.type !== "projectile") {
		throw new Error("createProjectileLaunch requires a projectile command");
	}
	const length =
		Math.hypot(command.direction.x, command.direction.y, command.direction.z) ||
		1;
	return {
		position: { ...command.origin },
		velocity: {
			x: (command.direction.x / length) * command.projectile.speed,
			y: (command.direction.y / length) * command.projectile.speed,
			z: (command.direction.z / length) * command.projectile.speed,
		},
		gravity: command.projectile.gravity,
		lifetimeRemaining: command.projectile.lifetime,
	};
}

export class ProjectileSimulation {
	private active: Array<
		ProjectileLaunch & { command: FireWeaponCommand; damage: number }
	> = [];
	launch(command: FireWeaponCommand, damage: number): void {
		this.active.push({ ...createProjectileLaunch(command), command, damage });
	}
	clear(): void {
		this.active.length = 0;
	}
	update(
		dt: number,
		physics: import("../../physics/characterPhysics").CharacterPhysics,
		body: import("@dimforge/rapier3d-compat").RigidBody,
	) {
		const events: Array<{
			weaponId: string;
			damage: number;
			origin: Vec3;
			point: Vec3;
			normal: Vec3 | null;
			colliderHandle?: number;
		}> = [];
		this.active = this.active.filter((projectile) => {
			const step = Math.min(dt, projectile.lifetimeRemaining);
			const origin = { ...projectile.position };
			const delta = {
				x: projectile.velocity.x * step,
				y:
					projectile.velocity.y * step - (projectile.gravity * step * step) / 2,
				z: projectile.velocity.z * step,
			};
			const distance = Math.hypot(delta.x, delta.y, delta.z);
			const hit =
				distance > 0 ? physics.raycast(origin, delta, distance, body) : null;
			projectile.position = hit?.point ?? {
				x: origin.x + delta.x,
				y: origin.y + delta.y,
				z: origin.z + delta.z,
			};
			projectile.velocity.y -= projectile.gravity * step;
			projectile.lifetimeRemaining -= step;
			events.push({
				weaponId: projectile.command.weaponId,
				damage: hit ? projectile.damage : 0,
				origin,
				point: projectile.position,
				normal: hit?.normal ?? null,
				colliderHandle: hit?.colliderHandle,
			});
			return !hit && projectile.lifetimeRemaining > 0;
		});
		return events;
	}
}
