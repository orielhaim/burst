import type { Vec3 } from "../core/types";
import type { CharacterPhysics } from "../physics/characterPhysics";
import type { PlayerController } from "../player/PlayerController";
import {
	AbilityRegistry,
	type SpecialAbilityDefinition,
} from "./SpecialAbility";

export type AbilityUpdateContext = {
	dt: number;
	/** Edge-triggered Q press for this step. */
	activated: boolean;
	/** Edge-triggered jump — cancels an active grapple pull. */
	jumpPressed: boolean;
	/** World-space cast origin (eye). */
	origin: Vec3;
	/** Unit look direction (camera forward). */
	direction: Vec3;
	player: PlayerController;
	physics: CharacterPhysics | null;
	/** Fixed-step torso attach used for cable occlusion tests. */
	cableStart?: Vec3;
};

export type AbilityMotionContext = {
	jumpPressed: boolean;
	/** Q while a hook/pull is live cuts the line. */
	activated: boolean;
	player: PlayerController;
	physics: CharacterPhysics | null;
	/** Fixed-step torso attach used for cable occlusion tests. */
	cableStart: Vec3;
	/** Strafe input for light air control during pull. */
	moveX: number;
	moveZ: number;
	lookYaw: number;
};

export type AbilityPresentation = {
	id: string;
	name: string;
	kind: "dash" | "grapple";
	cooldownRemaining: number;
	cooldownDuration: number;
	ready: boolean;
	pulling: boolean;
	/** Live hook line while flying or pulling; otherwise null. */
	lineStart: Vec3 | null;
	lineEnd: Vec3 | null;
};

type GrapplePhase = "idle" | "flying" | "pulling";

/**
 * Per-character special ability runtime (Q). One instance owns cooldown,
 * active pull state, and motion writes against a PlayerController.
 *
 * Swap abilities with `equip("grapple")` without replacing the instance —
 * presentation/UI can keep a stable handle on the runtime.
 */
export class AbilityRuntime {
	private definition: SpecialAbilityDefinition;
	private cooldownRemaining = 0;
	private grapplePhase: GrapplePhase = "idle";
	private anchor: Vec3 | null = null;
	/** Flight start (body attach); tip lerps from here to the anchor. */
	private hookOrigin: Vec3 = { x: 0, y: 0, z: 0 };
	private hookDistance = 0;
	private hookProgress = 0;
	private prevHookProgress = 0;
	/** Set when prepareMotion consumed Q/jump as a cut this step. */
	private cancelledThisStep = false;

	constructor(definition: SpecialAbilityDefinition) {
		this.definition = definition;
	}

	static fromId(id: string): AbilityRuntime {
		const definition = AbilityRegistry.get(id);
		if (!definition) throw new Error(`Unknown special ability: ${id}`);
		return new AbilityRuntime(definition);
	}

	get current(): SpecialAbilityDefinition {
		return this.definition;
	}

	get isPulling(): boolean {
		return this.grapplePhase === "pulling";
	}

	get isActive(): boolean {
		return this.grapplePhase !== "idle";
	}

	/**
	 * Cable end for rendering: tip while the hook flies, full anchor while
	 * pulling. `alpha` blends the last two fixed flight steps so the tip does
	 * not step at 60 Hz on high-refresh displays.
	 */
	getTip(alpha = 1): Vec3 | null {
		if (this.grapplePhase === "idle" || !this.anchor) return null;
		if (this.grapplePhase === "pulling") return { ...this.anchor };
		const t = clamp01(
			this.prevHookProgress +
				(this.hookProgress - this.prevHookProgress) * clamp01(alpha),
		);
		return {
			x: this.hookOrigin.x + (this.anchor.x - this.hookOrigin.x) * t,
			y: this.hookOrigin.y + (this.anchor.y - this.hookOrigin.y) * t,
			z: this.hookOrigin.z + (this.anchor.z - this.hookOrigin.z) * t,
		};
	}

	/** Sim-rate tip (alpha = 1). Prefer getTip(renderAlpha) for drawing. */
	get anchorPoint(): Vec3 | null {
		return this.getTip(1);
	}

	equip(id: string | SpecialAbilityDefinition): void {
		const definition =
			typeof id === "string" ? AbilityRegistry.get(id) : id;
		if (!definition)
			throw new Error(`Unknown special ability: ${String(id)}`);
		this.reset();
		this.definition = definition;
	}

	reset(): void {
		this.cooldownRemaining = 0;
		this.releaseGrapple();
	}

	/**
	 * Compute this step's ability-owned velocity (grapple pull), or null.
	 * Call BEFORE PlayerController.update and pass the result as
	 * `velocityOverride` so locomotion cannot fight the pull.
	 *
	 * Q or jump while live cuts the line. Occlusion between the body and the
	 * anchor also severs the cable so it never draws through geometry.
	 */
	prepareMotion(context: AbilityMotionContext): Vec3 | null {
		this.cancelledThisStep = false;
		if (this.definition.kind !== "grapple") return null;
		if (this.grapplePhase === "idle") return null;

		if (context.jumpPressed || context.activated) {
			this.releaseGrapple();
			this.cancelledThisStep = true;
			return null;
		}

		if (this.anchor && this.isCableBlocked(context)) {
			this.releaseGrapple();
			return null;
		}

		// Hook is still in flight — player keeps normal locomotion.
		if (this.grapplePhase === "flying") return null;

		const definition = this.definition;
		const position = context.player.getPosition();
		const toAnchor = {
			x: this.anchor!.x - position.x,
			y: this.anchor!.y - position.y,
			z: this.anchor!.z - position.z,
		};
		const distance = Math.hypot(toAnchor.x, toAnchor.y, toAnchor.z);
		if (distance <= definition.releaseDistance) {
			this.releaseGrapple();
			return null;
		}

		const inverse = 1 / Math.max(distance, 1e-5);
		let velocity: Vec3 = {
			x: toAnchor.x * inverse * definition.pullSpeed,
			y: toAnchor.y * inverse * definition.pullSpeed,
			z: toAnchor.z * inverse * definition.pullSpeed,
		};

		// Light camera-relative air control so strafe keys still do something.
		if (definition.airStrafeSpeed > 0) {
			const yaw = context.lookYaw;
			const wishX =
				Math.cos(yaw) * context.moveX - Math.sin(yaw) * context.moveZ;
			const wishZ =
				-Math.sin(yaw) * context.moveX - Math.cos(yaw) * context.moveZ;
			const wishLength = Math.hypot(wishX, wishZ);
			if (wishLength > 1e-4) {
				const scale =
					(Math.min(1, wishLength) * definition.airStrafeSpeed) /
					wishLength;
				velocity = {
					x: velocity.x + wishX * scale,
					y: velocity.y,
					z: velocity.z + wishZ * scale,
				};
			}
		}

		// Slide along walls instead of re-driving into them every tick.
		const wall = context.player.movement.wallNormal;
		if (wall) {
			const into =
				velocity.x * wall.x + velocity.y * wall.y + velocity.z * wall.z;
			if (into < 0) {
				velocity = {
					x: velocity.x - wall.x * into,
					y: velocity.y - wall.y * into,
					z: velocity.z - wall.z * into,
				};
			}
		}

		return velocity;
	}

	/**
	 * Advance cooldown, hook flight, and activation.
	 * Call after PlayerController.update.
	 */
	update(context: AbilityUpdateContext): AbilityPresentation {
		const dt = Number.isFinite(context.dt)
			? Math.max(0, context.dt)
			: 0;
		if (this.cooldownRemaining > 0)
			this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);

		if (this.definition.kind === "grapple")
			return this.updateGrapple(context, dt);
		return this.updateDash(context);
	}

	private updateDash(context: AbilityUpdateContext): AbilityPresentation {
		const definition = this.definition;
		if (definition.kind !== "dash")
			throw new Error(`AbilityRuntime kind mismatch: ${definition.kind}`);

		if (context.activated && this.cooldownRemaining <= 0) {
			this.applyDash(context.player, context.direction, definition.speed, definition.pitchLift);
			this.cooldownRemaining = definition.cooldown;
		}

		return this.snapshot(context.origin);
	}

	private applyDash(
		player: PlayerController,
		direction: Vec3,
		speed: number,
		pitchLift: number,
	): void {
		const yaw = Math.atan2(-direction.x, -direction.z);
		const facingX = -Math.sin(yaw);
		const facingZ = -Math.cos(yaw);
		const horizontalLength = Math.hypot(facingX, facingZ) || 1;
		const fx = facingX / horizontalLength;
		const fz = facingZ / horizontalLength;
		const velocity = player.getVelocity();
		const lift = direction.y * pitchLift;
		player.motor.setVelocity({
			x: fx * speed,
			y: velocity.y + lift,
			z: fz * speed,
		});
	}

	private updateGrapple(
		context: AbilityUpdateContext,
		dt: number,
	): AbilityPresentation {
		const definition = this.definition;
		if (definition.kind !== "grapple")
			throw new Error(`AbilityRuntime kind mismatch: ${definition.kind}`);

		// Safety cut if update runs without a preceding prepareMotion.
		if (this.grapplePhase !== "idle" && context.jumpPressed)
			this.releaseGrapple();

		// Occlusion during flight: geometry between body and anchor severs the line.
		if (
			this.grapplePhase === "flying" &&
			this.anchor &&
			this.isCableBlocked({
				player: context.player,
				physics: context.physics,
				cableStart: context.cableStart ?? context.origin,
			})
		) {
			this.releaseGrapple();
		}

		// Advance cable flight: time to land scales with distance / hookSpeed.
		if (this.grapplePhase === "flying" && this.anchor) {
			this.prevHookProgress = this.hookProgress;
			const step =
				this.hookDistance > 1e-5
					? (definition.hookSpeed * dt) / this.hookDistance
					: 1;
			this.hookProgress += step;
			if (this.hookProgress >= 1) {
				this.hookProgress = 1;
				this.grapplePhase = "pulling";
			}
		}

		if (
			context.activated &&
			!this.cancelledThisStep &&
			this.grapplePhase === "idle" &&
			this.cooldownRemaining <= 0
		) {
			const hit = context.physics?.raycast(
				context.origin,
				context.direction,
				definition.maxRange,
				context.player.body,
			);
			// Nothing in reach: do not fire and do not spend cooldown.
			if (hit) {
				this.anchor = { ...hit.point };
				this.hookOrigin = { ...context.origin };
				this.hookDistance = Math.hypot(
					this.anchor.x - this.hookOrigin.x,
					this.anchor.y - this.hookOrigin.y,
					this.anchor.z - this.hookOrigin.z,
				);
				this.hookProgress = 0;
				this.prevHookProgress = 0;
				this.grapplePhase = "flying";
				this.cooldownRemaining = definition.cooldown;
			}
		}

		return this.snapshot(context.origin);
	}

	/**
	 * True when world geometry sits between the body attach and the anchor
	 * (excluding the anchor face itself). The cable is severed on a hit so it
	 * never draws through an object.
	 */
	private isCableBlocked(context: {
		player: PlayerController;
		physics: CharacterPhysics | null;
		cableStart: Vec3;
	}): boolean {
		const physics = context.physics;
		const anchor = this.anchor;
		if (!physics || !anchor) return false;
		const from = context.cableStart;
		const dx = anchor.x - from.x;
		const dy = anchor.y - from.y;
		const dz = anchor.z - from.z;
		const distance = Math.hypot(dx, dy, dz);
		if (distance < 0.2) return false;
		const inverse = 1 / distance;
		const hit = physics.raycast(
			from,
			{ x: dx * inverse, y: dy * inverse, z: dz * inverse },
			distance,
			context.player.body,
		);
		if (!hit) return false;
		// Ignore the anchor surface itself — only mid-path blockers cut the cable.
		return hit.toi < distance - 0.2;
	}

	private releaseGrapple(): void {
		this.grapplePhase = "idle";
		this.anchor = null;
		this.hookProgress = 0;
		this.prevHookProgress = 0;
		this.hookDistance = 0;
	}

	private snapshot(origin?: Vec3): AbilityPresentation {
		const tip = this.getTip(1);
		return {
			id: this.definition.id,
			name: this.definition.name,
			kind: this.definition.kind,
			cooldownRemaining: this.cooldownRemaining,
			cooldownDuration: this.definition.cooldown,
			ready: this.cooldownRemaining <= 0 && !this.isActive,
			pulling: this.isPulling,
			lineStart: tip && origin ? { ...origin } : null,
			lineEnd: tip,
		};
	}
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}
