import { AbilityRegistry } from "./SpecialAbility";

/** Local character's default special ability (Q). */
export const dashDefinition = AbilityRegistry.register({
	id: "dash",
	name: "Dash",
	kind: "dash",
	cooldown: 1.15,
	speed: 18,
	pitchLift: 5.5,
});

/** Attachable alternative: hook a surface and pull toward it. */
export const grappleDefinition = AbilityRegistry.register({
	id: "grapple",
	name: "Grapple",
	kind: "grapple",
	cooldown: 0.85,
	maxRange: 28,
	/** Fast, but short hooks still take a beat (time scales with distance). */
	hookSpeed: 48,
	pullSpeed: 16,
	airStrafeSpeed: 3.2,
	releaseDistance: 1.85,
});
