import { HitRegions } from "./HitRegions";
import {
	ProceduralCharacter,
	type CharacterInput,
	type GroundQuery,
	type CharacterPose,
	type HandTargets,
} from "./ProceduralCharacter";
import type { AnyWeaponDefinition } from "../weapons/WeaponDefinition";
import type { WorldWeaponPose } from "./WeaponAttachments";
import type { AbilityRuntime } from "../abilities/AbilityRuntime";
export type CharacterActor = {
	rig: ProceduralCharacter;
	previousPose?: CharacterPose;
	renderHands?: HandTargets;
	health: number;
	weapon: AnyWeaponDefinition;
	weaponPose: WorldWeaponPose;
	previousWeaponPose?: WorldWeaponPose;
	/** Optional Q special ability owned by this character. */
	ability?: AbilityRuntime;
};
/** Replication/bot seam: meaningful snapshots in, world pose and hit regions out. */
export class CharacterWorld {
	readonly actors = new Map<string, CharacterActor>();
	constructor(readonly regions: HitRegions) {}
	update(
		id: string,
		dt: number,
		input: CharacterInput,
		ground: GroundQuery,
		weapon: AnyWeaponDefinition,
		weaponPose: WorldWeaponPose,
	): CharacterActor {
		let actor = this.actors.get(id);
		if (!actor) {
			actor = {
				rig: new ProceduralCharacter(),
				health: 100,
				weapon,
				weaponPose,
			};
			this.actors.set(id, actor);
		}
		actor.weapon = weapon;
		actor.previousWeaponPose = actor.weaponPose;
		actor.weaponPose = weaponPose;
		const before = structuredClone(actor.rig.pose);
		const initialized = actor.previousPose !== undefined;
		actor.rig.update(dt, input, ground);
		const delta = Math.hypot(
			before.hips.x - actor.rig.pose.hips.x,
			before.hips.y - actor.rig.pose.hips.y,
			before.hips.z - actor.rig.pose.hips.z,
		);
		actor.previousPose =
			initialized && delta < 3 ? before : structuredClone(actor.rig.pose);
		if (actor.health > 0) this.regions.set(id, actor.rig.hitRegions);
		else this.regions.remove(id);
		return actor;
	}
	/** Attach or replace a character's special ability (Q). */
	attachAbility(id: string, ability: AbilityRuntime): void {
		const actor = this.actors.get(id);
		if (!actor) return;
		actor.ability = ability;
	}
	damage(id: string, damage: number, direction?: { x: number; y: number; z: number }): void {
		const actor = this.actors.get(id);
		if (!actor) return;
		actor.health = Math.max(0, actor.health - damage);
		if (direction) actor.rig.applyHit(direction, damage);
		if (actor.health === 0) this.regions.remove(id);
	}
	remove(id: string): void {
		this.actors.delete(id);
		this.regions.remove(id);
	}
	clear(): void {
		this.actors.clear();
		this.regions.clear();
	}
}