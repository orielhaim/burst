import type { Vec3 } from "../core/types";
import type { MovementRuntimeState } from "../player/MovementState";
import type { HitRegion } from "./HitRegions";
import {
	add,
	sub,
	scale,
	length,
	unit,
	lerp,
	rotate,
	clamp,
	dot,
	solveLimb,
} from "./CharacterMath";
export const CHARACTER_CONFIG = {
	hipHeight: 0.88,
	crouchHeight: 0.56,
	slideHeight: 0.36,
	torsoLength: 0.43,
	stanceWidth: 0.28,
	thigh: 0.52,
	shin: 0.52,
	upperArm: 0.38,
	forearm: 0.38,
	stepHeight: 0.11,
	maxStride: 0.65,
	minFootSeparation: 0.2,
	walkStepTime: 0.32,
	sprintStepTime: 0.18,
	/** Snappier than a pure third-person follow so arms stay under the weapon. */
	bodyTurnRate: 4.6,
	headRadius: 0.15,
	bodyRadius: 0.23,
	footLength: 0.24,
};
export type GroundSample = { position: Vec3; normal: Vec3 };
export type GroundQuery = (position: Vec3) => GroundSample | null;
export type HandTargets = { primary: Vec3; support: Vec3 };
export type CharacterInput = {
	feet: Vec3;
	motion: MovementRuntimeState;
	aimYaw: number;
	aimPitch: number;
	ads: number;
	hands: HandTargets;
	wallPush?: Vec3 | null;
};
export type FootState = {
	position: Vec3;
	normal: Vec3;
	planted: boolean;
	start: Vec3;
	target: Vec3;
	progress: number;
	duration: number;
};
export type CharacterPose = {
	hips: Vec3;
	chest: Vec3;
	head: Vec3;
	bodyYaw: number;
	aimYaw: number;
	aimPitch: number;
	feet: [FootState, FootState];
	knees: [Vec3, Vec3];
	hipJoints: [Vec3, Vec3];
	shoulders: [Vec3, Vec3];
	elbows: [Vec3, Vec3];
	hands: [Vec3, Vec3];
};
const UP = { x: 0, y: 1, z: 0 };
const zero = (): Vec3 => ({ x: 0, y: 0, z: 0 });
function foot(): FootState {
	return {
		position: zero(),
		normal: { ...UP },
		planted: false,
		start: zero(),
		target: zero(),
		progress: 1,
		duration: 0.2,
	};
}
export class ProceduralCharacter {
	readonly pose: CharacterPose = {
		hips: zero(),
		chest: zero(),
		head: zero(),
		bodyYaw: 0,
		aimYaw: 0,
		aimPitch: 0,
		feet: [foot(), foot()],
		knees: [zero(), zero()],
		hipJoints: [zero(), zero()],
		shoulders: [zero(), zero()],
		elbows: [zero(), zero()],
		hands: [zero(), zero()],
	};
	private initialized = false;
	private previousFeet = zero();
	private previousVelocity = zero();
	private acceleration = zero();
	private hipHeight: number;
	private wasGrounded = false;
	private recovery = 0;
	private nextFoot = 0;
	private flinch = zero();
	private previousAirVelocity = 0;
	constructor(readonly config = CHARACTER_CONFIG) {
		this.hipHeight = config.hipHeight;
	}
	reset(): void {
		this.initialized = false;
	}
	applyHit(direction: Vec3, damage: number): void {
		const push = clamp(damage * 0.0045, 0.04, 0.28);
		const dir = unit({ x: direction.x, y: direction.y * 0.25, z: direction.z });
		this.flinch = add(this.flinch, scale(dir, push));
	}
	update(
		dt: number,
		input: CharacterInput,
		ground: GroundQuery,
	): CharacterPose {
		if (dt <= 0 || !Number.isFinite(dt)) return this.pose;
		dt = Math.min(dt, 0.05);
		const { config: cfg, pose } = this;
		const { motion, feet } = input;
		const reset = !this.initialized || length(sub(feet, this.previousFeet)) > 3;
		if (reset) {
			pose.bodyYaw = input.aimYaw;
			this.hipHeight = motion.crouched ? cfg.crouchHeight : cfg.hipHeight;
			this.previousVelocity = { ...motion.velocity };
		}
		this.acceleration = lerp(
			this.acceleration,
			scale(sub(motion.velocity, this.previousVelocity), 1 / dt),
			1 - Math.exp(-4 * dt),
		);
		this.flinch = scale(this.flinch, Math.exp(-10 * dt));
		this.previousVelocity = { ...motion.velocity };
		this.previousFeet = { ...feet };
		const speed = motion.horizontalSpeed;
		const yawError = Math.atan2(
			Math.sin(input.aimYaw - pose.bodyYaw),
			Math.cos(input.aimYaw - pose.bodyYaw),
		);
		// Moderate deadzone: large enough to avoid micro-jitter, small enough
		// that the torso does not drag the arms far behind a turn.
		const deadzone = speed > 0.2 ? 0.08 : 0.28;
		if (Math.abs(yawError) > deadzone)
			pose.bodyYaw += clamp(
				yawError - Math.sign(yawError) * deadzone,
				-cfg.bodyTurnRate * dt,
				cfg.bodyTurnRate * dt,
			);
		pose.aimYaw = input.aimYaw;
		pose.aimPitch = input.aimPitch;
		const right = rotate({ x: 1, y: 0, z: 0 }, pose.bodyYaw);
		const forward = rotate({ x: 0, y: 0, z: -1 }, pose.bodyYaw);
		const travel =
			speed > 0.2
				? unit({ x: motion.velocity.x, y: 0, z: motion.velocity.z })
				: forward;
		if (motion.grounded && !this.wasGrounded)
			this.recovery = clamp(-this.previousAirVelocity * 0.012, 0, 0.14);
		this.recovery *= Math.exp(-12 * dt);
		const desiredHeight =
			(motion.sliding
				? cfg.slideHeight
				: motion.crouched
					? cfg.crouchHeight
					: cfg.hipHeight - clamp(speed / 9.1, 0, 1) * 0.1) - this.recovery;
		this.hipHeight +=
			(desiredHeight - this.hipHeight) * (1 - Math.exp(-14 * dt));
		pose.hips = add(feet, { x: 0, y: this.hipHeight, z: 0 });
		const lean = scale(
			{ x: this.acceleration.x, y: 0, z: this.acceleration.z },
			0.0008,
		);
		const leanLength = length(lean);
		if (leanLength > 0.035) Object.assign(lean, scale(lean, 0.035 / leanLength));
		pose.chest = add(
			pose.hips,
			add(
				{ x: 0, y: cfg.torsoLength, z: 0 },
				motion.sliding
					? scale(travel, -0.18)
					: add(
							add(lean, this.flinch),
							scale(forward, motion.crouched ? 0.12 : 0.035),
						),
			),
		);
		pose.head = add(
			add(pose.chest, { x: 0, y: 0.23, z: 0 }),
			scale(this.flinch, 1.4),
		);
		const maxHoriz = 0.62;
		const stride = clamp(0.14 + speed * 0.012, 0.14, 0.22);
		const stepTime = clamp(
			(maxHoriz - stride) / Math.max(speed, 1),
			0.07,
			cfg.walkStepTime,
		);
		const strafe = dot(travel, right);
		const sample = (point: Vec3) => {
			const contact = ground(point);
			return contact && Math.abs(contact.position.y - feet.y) < 0.26
				? contact
				: null;
		};
		const desired = (index: number, along = 0) => {
			const side = index === 0 ? -1 : 1;
			const origin = add(feet, scale(travel, along));
			let point = this.foothold(
				index,
				origin,
				right,
				forward,
				travel,
				strafe,
				stride,
			);
			const hip = add(
				add(pose.hips, scale(travel, along)),
				scale(right, side * cfg.stanceWidth * 0.4),
			);
			const reach = sub(point, hip);
			const max = (cfg.thigh + cfg.shin) * 0.95;
			if (length(reach) > max) point = add(hip, scale(unit(reach), max));
			const contact = sample(point);
			return (
				contact ?? {
					position: { ...point, y: feet.y + 0.045 },
					normal: { ...UP },
				}
			);
		};
		const special = !motion.grounded || motion.sliding;
		for (let i = 0; i < 2; i++) {
			const f = pose.feet[i]!;
			const side = i === 0 ? -1 : 1;
			if (special) {
				f.planted = false;
				f.progress = 1;
				let target = add(
					feet,
					add(
						scale(right, (side * cfg.stanceWidth) / 2),
						motion.sliding
							? scale(travel, 0.63)
							: scale(forward, -clamp(motion.velocity.y * 0.018, -0.12, 0.2)),
					),
				);
				target.y += motion.sliding
					? 0.08
					: 0.18 + clamp(motion.velocity.y * 0.018, 0, 0.16);
				if (input.wallPush && i === (dot(input.wallPush, right) > 0 ? 0 : 1))
					target = add(
						pose.hips,
						add(scale(input.wallPush, -0.28), { x: 0, y: -0.15, z: 0 }),
					);
				const surface = motion.sliding ? ground(target) : null;
				if (surface) {
					target.y = surface.position.y + 0.05;
					f.normal = surface.normal;
				} else f.normal = input.wallPush ?? UP;
				f.position = reset
					? target
					: lerp(f.position, target, 1 - Math.exp(-18 * dt));
				continue;
			}
			if (reset || !this.wasGrounded) {
				const contact = sample(
					reset
						? add(feet, scale(right, (side * cfg.stanceWidth) / 2))
						: f.position,
				);
				if (contact) {
					f.position = contact.position;
					f.normal = contact.normal;
					f.planted = true;
					f.progress = 1;
				}
			}
		}
		if (!special) {
			const startStep = (i: number) => {
				const air = pose.feet.findIndex((f) => !f.planted);
				if (air >= 0 && air !== i) {
					const hip = pose.hipJoints[i] ?? pose.hips;
					const stretch = length(sub(pose.feet[i]!.position, hip));
					if (stretch < (cfg.thigh + cfg.shin) * 0.9) return;
				}
				const f = pose.feet[i]!;
				const land = sample(
					this.keepApart(
						i,
						desired(i, speed * Math.max(0.1, stepTime)).position,
						right,
						forward,
					),
				) ?? desired(i, speed * Math.max(0.1, stepTime));
				f.planted = false;
				f.start = { ...f.position };
				f.target = { ...land.position };
				f.normal = land.normal;
				f.progress = 0;
				f.duration = Math.max(0.1, stepTime);
				this.nextFoot = 1 - i;
			};
			if (speed > 0.35) {
				const busy = pose.feet.findIndex((f) => !f.planted);
				if (busy < 0 || pose.feet[busy]!.progress > 0.55) {
					let pick = busy >= 0 ? 1 - busy : this.nextFoot;
					if (busy < 0) {
						let lag = Number.NEGATIVE_INFINITY;
						for (let i = 0; i < 2; i++) {
							const behind = -dot(sub(pose.feet[i]!.position, feet), travel);
							if (behind > lag) {
								lag = behind;
								pick = i;
							}
						}
					}
					const planted = pose.feet[pick]!;
					if (planted.planted) {
						const land = desired(pick, speed * stepTime).position;
						const reach = length(sub(planted.position, pose.hips));
						if (
							busy >= 0 ||
							reach > 0.8 ||
							-dot(sub(planted.position, feet), travel) > stride * 0.35 ||
							length(sub(land, planted.position)) > Math.max(0.12, stride * 0.7)
						)
							startStep(pick);
					}
				}
			}
			for (let i = 0; i < 2; i++) {
				const f = pose.feet[i]!;
				if (f.planted) continue;
				const remaining = speed * f.duration * (1 - f.progress);
				const land = sample(
					this.keepApart(i, desired(i, remaining).position, right, forward),
				);
				if (land && f.progress < 0.85)
					f.target = lerp(f.target, land.position, 1 - Math.exp(-10 * dt));
				f.progress = Math.min(1, f.progress + dt / f.duration);
				const t = f.progress * f.progress * (3 - 2 * f.progress);
				f.position = lerp(f.start, f.target, t);
				f.position.y +=
					Math.sin(f.progress * Math.PI) *
					cfg.stepHeight *
					(motion.crouched ? 0.55 : 1);
				if (land) f.normal = land.normal;
				if (f.progress >= 1) {
					f.position = { ...f.target };
					f.planted = true;
				}
			}
			this.unstickSwing(forward);
		}
		for (let i = 0; i < 2; i++) {
			const side = i === 0 ? -1 : 1;
			pose.hipJoints[i] = add(
				pose.hips,
				scale(right, side * cfg.stanceWidth * 0.4),
			);
			const f = pose.feet[i]!;
			const hip = pose.hipJoints[i]!;
			const maxReach = (cfg.thigh + cfg.shin) * 0.98;
			const reach = sub(f.position, hip);
			if (length(reach) <= maxReach) continue;
			if (f.planted && !special) {
				const land = desired(i, speed * stepTime);
				f.planted = false;
				f.start = { ...f.position };
				f.target = land.position;
				f.normal = land.normal;
				f.progress = 0.05;
				f.duration = Math.max(0.1, stepTime);
				this.nextFoot = 1 - i;
			}
			const again = sub(f.position, hip);
			if (!f.planted && length(again) > maxReach)
				f.position = add(hip, scale(unit(again), maxReach));
		}
		if (!special) this.unstickSwing(forward);
		for (let i = 0; i < 2; i++) {
			const side = i === 0 ? -1 : 1;
			pose.knees[i] = solveLimb(
				pose.hipJoints[i]!,
				pose.feet[i]!.position,
				add(
					scale(forward, motion.sliding ? 0.25 : 1),
					scale(right, side * 0.1),
				),
				cfg.thigh,
				cfg.shin,
			);
			const aimRight = rotate({ x: 1, y: 0, z: 0 }, input.aimYaw);
			pose.shoulders[i] = add(
				pose.chest,
				add({ x: 0, y: 0.04, z: 0 }, scale(aimRight, side * 0.22)),
			);
		}
		this.solveHands(input.hands);
		this.initialized = true;
		this.wasGrounded = motion.grounded && !motion.sliding;
		if (!motion.grounded) this.previousAirVelocity = motion.velocity.y;
		return pose;
	}
	private foothold(
		index: number,
		feet: Vec3,
		right: Vec3,
		forward: Vec3,
		travel: Vec3,
		strafe: number,
		stride: number,
	): Vec3 {
		const side = index === 0 ? -1 : 1;
		const cross = clamp(Math.abs(strafe), 0, 1);
		const lead = cross > 0.35 ? Math.sign(strafe) : 0;
		let lat = side * (this.config.stanceWidth / 2);
		let pass = side * 0.03;
		if (lead !== 0) {
			if (side === lead) {
				lat = lead * (this.config.stanceWidth * 0.55 + stride * 0.2);
				pass = -0.05 * cross;
			} else {
				lat = lead * this.config.stanceWidth * 0.08;
				pass = 0.16 * cross;
			}
		}
		return add(
			feet,
			add(add(scale(travel, stride), scale(right, lat)), scale(forward, pass)),
		);
	}
	private unstickSwing(forward: Vec3): void {
		const a = this.pose.feet[0]!;
		const b = this.pose.feet[1]!;
		for (let n = 0; n < 3; n++) {
			const delta = sub(a.position, b.position);
			const dist = length(delta);
			if (dist >= this.config.minFootSeparation) return;
			const dir = dist < 0.02 ? forward : unit(delta);
			const push = this.config.minFootSeparation - dist + 0.012;
			if (!a.planted) a.position = add(a.position, scale(dir, push));
			else if (!b.planted) b.position = add(b.position, scale(dir, -push));
			else return;
		}
	}
	private keepApart(
		index: number,
		point: Vec3,
		right: Vec3,
		forward: Vec3,
	): Vec3 {
		const other = this.pose.feet[1 - index]!.position;
		const planar = { x: point.x - other.x, y: 0, z: point.z - other.z };
		const dist = length(planar);
		if (dist >= this.config.minFootSeparation) return point;
		return add(
			point,
			scale(
				unit(add(scale(forward, 1), scale(right, index === 0 ? -0.2 : 0.2))),
				this.config.minFootSeparation - dist + 0.02,
			),
		);
	}
	solveHands(targets: HandTargets): void {
		this.pose.hands = [{ ...targets.support }, { ...targets.primary }];
		for (let i = 0; i < 2; i++)
			this.pose.elbows[i] = solveLimb(
				this.pose.shoulders[i]!,
				this.pose.hands[i]!,
				rotate({ x: i === 0 ? -1 : 1, y: -0.8, z: 0.3 }, this.pose.aimYaw),
				this.config.upperArm,
				this.config.forearm,
			);
	}
	get hitRegions(): HitRegion[] {
		return [
			{
				name: "head",
				center: { ...this.pose.head },
				radius: this.config.headRadius,
			},
			{
				name: "body",
				center: { ...this.pose.chest },
				radius: this.config.bodyRadius,
			},
			{
				name: "body",
				center: { ...this.pose.hips },
				radius: this.config.bodyRadius,
			},
		];
	}
}
