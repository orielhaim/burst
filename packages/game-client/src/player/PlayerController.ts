import type RAPIER from "@dimforge/rapier3d-compat";
import type { Vec3 } from "../core/types";
import type { CharacterPhysics } from "../physics/characterPhysics";
import { GroundDetector, type GroundContact } from "./GroundDetector";
import { accelerate, applyFriction, clampHorizontal, horizontalDot, projectOnPlane, steerVelocity } from "./MovementMath";
import { DEFAULT_MOVEMENT_CONFIG, type MovementConfig } from "./MovementConfig";
import { createMovementState, type MovementInput, type MovementRuntimeState } from "./MovementState";
import { PlayerMotor } from "./PlayerMotor";
import { type WallContact, WallDetector } from "./WallDetector";

export type PlayerControllerConfig = MovementConfig;
export const DEFAULT_PLAYER_CONFIG = DEFAULT_MOVEMENT_CONFIG;

/** Fixed-step movement coordinator. DOM input and presentation stop at this seam. */
export class PlayerController {
	readonly config: MovementConfig;
	readonly movement: MovementRuntimeState = createMovementState();
	readonly motor: PlayerMotor;
	private readonly groundDetector: GroundDetector;
	private readonly wallDetector: WallDetector;
	private simulationTime = 0;
	private jumpBufferedUntil = Number.NEGATIVE_INFINITY;
	private slideBufferedUntil = Number.NEGATIVE_INFINITY;
	private ignoreGroundUntil = Number.NEGATIVE_INFINITY;
	private lastRealGroundTime = Number.NEGATIVE_INFINITY;
	private lastStableGround: GroundContact | null = null;
	private lastUsedWallHandle: number | null = null;
	private lastUsedWallNormal: Vec3 | null = null;
	private lastWallJumpTime = Number.NEGATIVE_INFINITY;
	private lastWallJumpPosition: Vec3 | null = null;
	private pendingImpulse: Vec3 = { x: 0, y: 0, z: 0 };

	constructor(physics: CharacterPhysics, spawn: Vec3, config: MovementConfig = DEFAULT_MOVEMENT_CONFIG) {
		this.config = config;
		this.motor = new PlayerMotor(physics, spawn, config.radius, config.standingHalfHeight, config);
		this.groundDetector = new GroundDetector(physics);
		this.wallDetector = new WallDetector(physics);
	}

	get body(): RAPIER.RigidBody { return this.motor.body; }
	getPosition(): Vec3 { return this.motor.getPosition(); }
	getFeetPosition(): Vec3 { return this.motor.getFeetPosition(); }
	getVelocity(): Vec3 { return this.motor.getVelocity(); }
	isGrounded(): boolean { return this.movement.grounded; }
	getCameraHeight(): number {
		if (this.movement.sliding) return this.config.slideEyeHeight;
		if (this.movement.crouched) return this.config.crouchingEyeHeight;
		return this.config.standingEyeHeight;
	}

	applyImpulse(impulse: Vec3): void {
		this.pendingImpulse = {
			x: this.pendingImpulse.x + impulse.x,
			y: this.pendingImpulse.y + impulse.y,
			z: this.pendingImpulse.z + impulse.z,
		};
	}

	teleport(position: Vec3): boolean {
		if (!this.motor.teleport(position)) return false;
		Object.assign(this.movement, createMovementState());
		this.movement.crouched = !this.motor.tryStand(this.config.standingHalfHeight);
		this.jumpBufferedUntil = Number.NEGATIVE_INFINITY;
		this.slideBufferedUntil = Number.NEGATIVE_INFINITY;
		this.ignoreGroundUntil = Number.NEGATIVE_INFINITY;
		this.lastRealGroundTime = Number.NEGATIVE_INFINITY;
		this.lastStableGround = null;
		this.lastUsedWallHandle = null;
		this.lastUsedWallNormal = null;
		this.lastWallJumpPosition = null;
		return true;
	}

	update(dt: number, input: MovementInput): void {
		dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 1 / 20)) : 0;
		this.simulationTime += dt;
		const cfg = this.config;
		const position = this.motor.getPosition();
		const incoming = this.motor.getVelocity();
		const wasGrounded = this.movement.grounded;
		const rawGround = this.detectGround(position);
		// Ground stick: brief contact loss (stair lips, geometry seams) keeps
		// the last stable contact while falling speed is negligible. Jumps
		// explicitly clear contact via the grace timer instead.
		let ground = rawGround;
		if (
			!ground &&
			wasGrounded &&
			incoming.y <= 0.01 &&
			this.simulationTime - this.lastRealGroundTime <= cfg.groundStickTime &&
			this.lastStableGround
		) {
			ground = this.lastStableGround;
		}
		if (rawGround) {
			this.lastRealGroundTime = this.simulationTime;
			this.lastStableGround = rawGround;
		}
		this.setGroundContact(ground, dt);
		if (!ground) this.updateWallContact(position);

		if (input.jumpPressed) this.jumpBufferedUntil = this.simulationTime + cfg.jumpBufferTime;
		if (input.crouchPressed && !ground) this.slideBufferedUntil = this.simulationTime + cfg.airSlideBufferTime;
		const wish = cameraRelativeWish(input, ground?.normal ?? null);
		const landed = !wasGrounded && ground !== null && incoming.y <= 0;
		if (landed) {
			incoming.x *= cfg.landingMomentumRetention;
			incoming.z *= cfg.landingMomentumRetention;
		}


		const horizontalSpeed = Math.hypot(incoming.x, incoming.z);
		const landingSlide = Boolean(landed && this.simulationTime <= this.slideBufferedUntil && horizontalSpeed >= cfg.airSlideMinHorizontalSpeed);
		const groundSlide = Boolean(ground && input.crouchPressed && horizontalSpeed >= cfg.slideMinStartSpeed);
		if (!this.movement.sliding && (landingSlide || groundSlide)) {
			this.startSlide(incoming);
			this.slideBufferedUntil = Number.NEGATIVE_INFINITY;
		}
		this.updateStance(input.crouchHeld);
		this.movement.sprinting = Boolean(ground && !this.movement.crouched && !this.movement.sliding && input.sprintHeld && !input.aimHeld && wish.length > 1e-4 && (cfg.omnidirectionalSprint || input.moveY >= cfg.sprintForwardThreshold));

		let next = this.movement.sliding
			? this.updateSlide(dt, incoming, wish, input.crouchHeld, ground)
			: this.updateLocomotion(dt, incoming, wish, input.movementSpeedMultiplier ?? 1, ground);
		if (!ground) next.y = Math.max(-cfg.maxFallSpeed, next.y - cfg.gravity * dt);
		next = this.tryConsumeJump(next, position, ground !== null, input);
		// Ability-owned motion (grapple) fully replaces this step's velocity so
		// locomotion/friction/gravity cannot fight the pull and cause vibration.
		if (input.velocityOverride) {
			next = {
				x: input.velocityOverride.x,
				y: input.velocityOverride.y,
				z: input.velocityOverride.z,
			};
		}
		next = {
			x: next.x + this.pendingImpulse.x,
			y: next.y + this.pendingImpulse.y,
			z: next.z + this.pendingImpulse.z,
		};
		this.pendingImpulse = { x: 0, y: 0, z: 0 };
		const capped = clampHorizontal(next, cfg.physicalHorizontalSpeedCap);
		next.x = capped.x;
		next.z = capped.z;
		if (!isFiniteVector(next)) next = { x: 0, y: 0, z: 0 };
		const resolved = this.motor.move(next, dt);
		if (this.movement.sliding && Math.hypot(resolved.x, resolved.z) < cfg.slideExitSpeed) this.endSlide(input.crouchHeld);
		this.updatePublicState(resolved);
		if (position.y < -20) this.teleport({ x: 0, y: 2, z: 0 });
	}

	private detectGround(position: Vec3): GroundContact | null {
		// Jump grace: right after takeoff the body is still inside the probe
		// range (ramps especially). Ignore contact so the jump can leave.
		if (this.simulationTime < this.ignoreGroundUntil) return null;
		const cfg = this.config;
		const ground = this.groundDetector.detect(this.body, position, cfg.radius, this.motor.getHalfHeight(), cfg.groundProbeDistance, Math.cos(cfg.maxWalkableSlope));
		return ground && ground.angle <= cfg.maxWalkableSlope ? ground : null;
	}

	private setGroundContact(ground: GroundContact | null, dt: number): void {
		this.movement.grounded = ground !== null;
		this.movement.groundNormal = ground?.normal ?? null;
		this.movement.groundAngle = ground?.angle ?? 0;
		this.movement.groundColliderHandle = ground?.colliderHandle ?? null;
		if (ground) {
			this.movement.lastGroundedTime = this.simulationTime;
			this.movement.timeAirborne = 0;
			this.movement.wallNormal = null;
			this.movement.wallColliderHandle = null;
		} else this.movement.timeAirborne += dt;
	}

	private updateLocomotion(dt: number, velocity: Vec3, wish: WishDirection, speedMultiplier: number, ground: GroundContact | null): Vec3 {
		const cfg = this.config;
		const desiredSpeed = (this.movement.crouched ? cfg.crouchSpeed : this.movement.sprinting ? cfg.sprintSpeed : cfg.walkSpeed) * speedMultiplier * wish.length;
		this.movement.desiredSpeed = desiredSpeed;
		let horizontal = { x: velocity.x, z: velocity.z };
		if (!ground) {
			if (wish.length > 0) horizontal = accelerate(horizontal, wish, desiredSpeed, cfg.airAcceleration * cfg.airControl, dt);
			horizontal = applyFriction(horizontal, 0, cfg.airDrag, dt);
			this.movement.acceleration = wish.length > 0 ? cfg.airAcceleration * cfg.airControl : 0;
			return { x: horizontal.x, y: velocity.y, z: horizontal.z };
		}
		if (wish.length < 1e-4) {
			if (ground.angle > cfg.slopeSlideAngle) {
				// Too steep to stand: slippery, slide downhill instead of
				// perching on the slope (or a rounded edge corner).
				const slide = projectOnPlane({ x: 0, y: -cfg.gravity, z: 0 }, ground.normal);
				horizontal.x += slide.x * cfg.slopeSlideFactor * dt;
				horizontal.z += slide.z * cfg.slopeSlideFactor * dt;
				this.movement.acceleration = -cfg.slideFriction;
			} else {
				const deceleration = this.movement.sprinting ? cfg.sprintDeceleration : cfg.groundDeceleration;
				horizontal = applyFriction(horizontal, deceleration, cfg.groundFriction, dt);
				this.movement.acceleration = -deceleration;
			}
		} else {
			const speed = Math.hypot(horizontal.x, horizontal.z);
			const alignment = speed > 1e-5 ? horizontalDot(horizontal, wish) / speed : 1;
			if (alignment < -0.25) horizontal = applyFriction(horizontal, cfg.groundDeceleration * cfg.reverseBrakingMultiplier, 0, dt);
			else {
				horizontal = steerVelocity(horizontal, wish, cfg.groundSteering * dt);
				if (horizontalDot(horizontal, wish) > desiredSpeed) horizontal = applyFriction(horizontal, this.movement.sprinting ? cfg.sprintDeceleration : cfg.groundDeceleration, 0, dt);
			}
			const acceleration = this.movement.sprinting ? cfg.sprintAcceleration : cfg.groundAcceleration;
			horizontal = accelerate(horizontal, wish, desiredSpeed, acceleration, dt);
			this.movement.acceleration = acceleration;
		}
		return { x: horizontal.x, y: Math.min(0, velocity.y), z: horizontal.z };
	}

	private startSlide(velocity: Vec3): void {
		const incomingSpeed = Math.hypot(velocity.x, velocity.z);
		// A single push from lowering into the slide, bounded above sprint speed.
		const speed = incomingSpeed + Math.min(this.config.slideEntryBoost, Math.max(0, this.config.sprintSpeed + this.config.slideEntryBoost - incomingSpeed));
		velocity.x *= speed / incomingSpeed;
		velocity.z *= speed / incomingSpeed;
		this.movement.slideDirection = { x: velocity.x / speed, y: 0, z: velocity.z / speed };
		this.movement.slideSpeed = speed;
		this.movement.sliding = true;
		this.movement.sprinting = false;
		this.enterCrouch();
	}

	private updateSlide(dt: number, velocity: Vec3, wish: WishDirection, crouchHeld: boolean, ground: GroundContact | null): Vec3 {
		const cfg = this.config;
		let horizontal = { x: velocity.x, z: velocity.z };
		if (!ground || Math.hypot(horizontal.x, horizontal.z) < cfg.slideExitSpeed) {
			this.endSlide(crouchHeld);
			return velocity;
		}
		// Steering spends traction on direction, never adds propulsion.
		const speed = Math.hypot(horizontal.x, horizontal.z);
		const braking = wish.length > 0 ? Math.max(0, -horizontalDot(horizontal, wish) / speed) : 0;
		if (wish.length > 0 && braking === 0) horizontal = steerVelocity(horizontal, wish, cfg.slideSteering * dt);
		const gravity = projectOnPlane({ x: 0, y: -cfg.gravity, z: 0 }, ground.normal);
		horizontal.x += gravity.x * dt;
		horizontal.z += gravity.z * dt;
		horizontal = applyFriction(horizontal, cfg.slideFriction * ground.normal.y + braking * cfg.groundDeceleration + Math.hypot(horizontal.x, horizontal.z) * cfg.slideDrag, 0, dt);
		const nextSpeed = Math.hypot(horizontal.x, horizontal.z);
		if (nextSpeed > 1e-5) this.movement.slideDirection = { x: horizontal.x / nextSpeed, y: 0, z: horizontal.z / nextSpeed };
		this.movement.desiredSpeed = 0;
		this.movement.acceleration = (nextSpeed - speed) / Math.max(dt, 1e-5);
		if (nextSpeed < cfg.slideExitSpeed) this.endSlide(crouchHeld);
		return { x: horizontal.x, y: Math.min(0, velocity.y), z: horizontal.z };
	}

	private tryConsumeJump(velocity: Vec3, position: Vec3, grounded: boolean, input: MovementInput): Vec3 {
		if (this.simulationTime > this.jumpBufferedUntil) return velocity;
		const withinCoyote = this.simulationTime - this.movement.lastGroundedTime <= this.config.coyoteTime;
		if (grounded || withinCoyote) {
			velocity.y = this.config.jumpVelocity;
			this.consumeJump();
			return velocity;
		}
		const wall = this.getUsableWall(position);
		if (!wall) return velocity;
		const wish = cameraRelativeWish(input, null);
		const intent = wish.length > 0 ? wish : { x: -Math.sin(input.lookYaw), z: -Math.cos(input.lookYaw) };
		const normalSpeed = velocity.x * wall.normal.x + velocity.z * wall.normal.z;
		const into = intent.x * wall.normal.x + intent.z * wall.normal.z;
		const tangent = { x: intent.x - wall.normal.x * into, z: intent.z - wall.normal.z * into };
		const tangentLength = Math.hypot(tangent.x, tangent.z);
		const travelSpeed = Math.max(this.config.wallJumpTravelSpeed, Math.hypot(velocity.x, velocity.z));
		const steer = tangentLength > 0.05 ? this.config.wallJumpIntentWeight : 0;
		const away = this.config.wallJumpAwaySpeed + Math.max(0, into) * travelSpeed;
		velocity = {
			x: (velocity.x - wall.normal.x * normalSpeed) * (1 - steer) + tangent.x * travelSpeed * steer + wall.normal.x * away,
			y: this.config.wallJumpUpSpeed + Math.max(0, Math.sin(input.lookPitch ?? 0)) * this.config.wallJumpLookLift,
			z: (velocity.z - wall.normal.z * normalSpeed) * (1 - steer) + tangent.z * travelSpeed * steer + wall.normal.z * away,
		};
		this.lastUsedWallHandle = wall.colliderHandle;
		this.lastUsedWallNormal = wall.normal;
		this.lastWallJumpTime = this.simulationTime;
		this.lastWallJumpPosition = position;
		this.consumeJump();
		return velocity;
	}

	private updateStance(crouchHeld: boolean): void {
		if (this.movement.sliding) return;
		if (crouchHeld && (this.movement.grounded || this.movement.crouched)) this.enterCrouch();
		else this.tryStand();
	}
	private enterCrouch(): void { this.motor.setCrouched(this.config.crouchingHalfHeight); this.movement.crouched = true; }
	private tryStand(): void { if (this.movement.crouched && this.motor.tryStand(this.config.standingHalfHeight)) this.movement.crouched = false; }
	private endSlide(crouchHeld: boolean): void { this.movement.sliding = false; this.movement.slideSpeed = 0; if (!crouchHeld) this.tryStand(); }
	private consumeJump(): void { this.movement.sprinting = false; this.jumpBufferedUntil = Number.NEGATIVE_INFINITY; this.slideBufferedUntil = Number.NEGATIVE_INFINITY; this.ignoreGroundUntil = this.simulationTime + this.config.jumpGroundGraceTime; this.movement.grounded = false; this.movement.lastGroundedTime = Number.NEGATIVE_INFINITY; if (this.movement.sliding) this.endSlide(true); }

	private updateWallContact(position: Vec3): void {
		const cfg = this.config;
		const wall = this.wallDetector.detect(this.body, position, cfg.radius, this.motor.getHalfHeight(), cfg.wallProbeDistance, cfg.wallMaxNormalY);
		if (!wall) {
			if (this.simulationTime - this.movement.lastWallContactTime > cfg.wallContactGraceTime) { this.movement.wallNormal = null; this.movement.wallColliderHandle = null; }
			return;
		}
		this.movement.wallNormal = wall.normal;
		this.movement.wallColliderHandle = wall.colliderHandle;
		this.movement.lastWallNormal = wall.normal;
		this.movement.lastWallContactTime = this.simulationTime;
	}

	private getUsableWall(position: Vec3): WallContact | null {
		const normal = this.movement.wallNormal;
		const colliderHandle = this.movement.wallColliderHandle;
		if (!normal || colliderHandle === null || this.simulationTime - this.movement.lastWallContactTime > this.config.wallContactGraceTime) return null;
		const sameWall = colliderHandle === this.lastUsedWallHandle && this.lastUsedWallNormal !== null && dot(normal, this.lastUsedWallNormal) >= this.config.sameWallNormalDot;
		if (sameWall) {
			const cooled = this.simulationTime - this.lastWallJumpTime >= this.config.sameWallCooldown;
			const separated = this.lastWallJumpPosition !== null && distance(position, this.lastWallJumpPosition) >= this.config.sameWallSeparation;
			if (!cooled || !separated) return null;
		}
		return { normal, colliderHandle, distance: 0 };
	}

	private updatePublicState(velocity: Vec3): void {
		this.movement.velocity = { ...velocity };
		this.movement.horizontalSpeed = Math.hypot(velocity.x, velocity.z);
		this.movement.slideSpeed = this.movement.sliding ? this.movement.horizontalSpeed : 0;
		this.movement.mode = this.movement.sliding ? "sliding" : this.movement.crouched ? "crouching" : this.movement.grounded ? "grounded" : "airborne";
	}
}

type WishDirection = { x: number; z: number; length: number };
function cameraRelativeWish(input: MovementInput, groundNormal: Vec3 | null): WishDirection {
	let vector = { x: Math.cos(input.lookYaw) * input.moveX - Math.sin(input.lookYaw) * input.moveY, y: 0, z: -Math.sin(input.lookYaw) * input.moveX - Math.cos(input.lookYaw) * input.moveY };
	const inputLength = Math.min(1, Math.hypot(vector.x, vector.z));
	if (inputLength < 1e-4) return { x: 0, z: 0, length: 0 };
	if (groundNormal) vector = projectOnPlane(vector, groundNormal);
	const horizontalLength = Math.hypot(vector.x, vector.z);
	return { x: vector.x / horizontalLength, z: vector.z / horizontalLength, length: inputLength };
}
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function distance(a: Vec3, b: Vec3): number { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
function isFiniteVector(value: Vec3): boolean { return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z); }
