import type { Vec3 } from "../core/types";

export type MovementMode = "grounded" | "airborne" | "crouching" | "sliding";

export interface MovementInput {
	moveX: number;
	moveY: number;
	jumpPressed: boolean;
	jumpHeld: boolean;
	sprintHeld: boolean;
	crouchHeld: boolean;
	crouchPressed: boolean;
	lookYaw: number;
	lookPitch?: number;
	aimHeld?: boolean;
	movementSpeedMultiplier?: number;
}

export type MovementRuntimeState = {
	mode: MovementMode;
	grounded: boolean;
	crouched: boolean;
	sprinting: boolean;
	sliding: boolean;
	velocity: Vec3;
	horizontalSpeed: number;
	desiredSpeed: number;
	acceleration: number;
	groundNormal: Vec3 | null;
	groundAngle: number;
	groundColliderHandle: number | null;
	timeAirborne: number;
	slideDirection: Vec3;
	slideSpeed: number;
	lastGroundedTime: number;
	lastWallNormal: Vec3 | null;
	lastWallContactTime: number;
	wallNormal: Vec3 | null;
	wallColliderHandle: number | null;
};

export function createMovementState(): MovementRuntimeState {
	return {
		mode: "airborne",
		grounded: false,
		crouched: false,
		sprinting: false,
		sliding: false,
		velocity: { x: 0, y: 0, z: 0 },
		horizontalSpeed: 0,
		desiredSpeed: 0,
		acceleration: 0,
		groundNormal: null,
		groundAngle: 0,
		groundColliderHandle: null,
		timeAirborne: 0,
		slideDirection: { x: 0, y: 0, z: -1 },
		slideSpeed: 0,
		lastGroundedTime: Number.NEGATIVE_INFINITY,
		lastWallNormal: null,
		lastWallContactTime: Number.NEGATIVE_INFINITY,
		wallNormal: null,
		wallColliderHandle: null,
	};
}
