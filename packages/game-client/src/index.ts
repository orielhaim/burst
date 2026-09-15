/**
 * @burst/game-client — R3F + @react-three/rapier game client.
 *
 * React owns composition/mounting (r3f/, maps/, player/, weapons/ .tsx).
 * Simulation owns per-frame state (runtime/, sim/, movement/weapon rules).
 * Framework-independent rules never import three/react/r3f.
 */

// —— framework-independent core (safe for future server sim) ——
export type { Action, ActionBindings } from "./core/Input";
export { Input } from "./core/Input";
export type {
	DebugSnapshot,
	GamePhase,
	InputFrame,
	UiSnapshot,
	Vec3,
} from "./core/types";
export { applySpread, isGrounded } from "./physics/collision";
export {
	CollisionGroups,
	CollisionLayer,
	interactionGroups,
} from "./physics/CollisionGroups";
export type {
	CharacterBody,
	CharacterPhysics,
	PlayerBodyOptions,
	RayHit,
	ShapeHit,
} from "./physics/characterPhysics";
export type { MovementConfig } from "./player/MovementConfig";
export { DEFAULT_MOVEMENT_CONFIG } from "./player/MovementConfig";
export type {
	MovementInput,
	MovementMode,
	MovementRuntimeState,
} from "./player/MovementState";
export {
	DEFAULT_PLAYER_CONFIG,
	PlayerController,
} from "./player/PlayerController";
export {
	CameraState,
	DEFAULT_CAMERA_STATE_CONFIG,
} from "./sim/cameraState";
export type { CameraStateConfig } from "./sim/cameraState";
export {
	lensAngularFovDegrees,
	magnifiedFovDegrees,
	scopeTargetSize,
} from "./sim/scopeMath";
export { COLORS } from "./rendering/palette";
export type { PaletteColor } from "./rendering/palette";
export type {
	ReticleDefinition,
	ScopeDefinition,
} from "./weapons/optics/ScopeDefinition";
export { ScopeRegistry } from "./weapons/optics/ScopeRegistry";
export { rifleDefinition } from "./weapons/definitions/rifle";
export type {
	FireWeaponCommand,
	WeaponDefinition,
} from "./weapons/WeaponDefinition";
export { WeaponRegistry } from "./weapons/WeaponRegistry";
export type { WeaponIntent, WeaponRuntimeState } from "./weapons/WeaponRuntime";
export { WeaponRuntime } from "./weapons/WeaponRuntime";

// —— mutable runtime (no React state per frame) ——
export { GameRuntime } from "./runtime/GameRuntime";
export type { RuntimeOptions, ShotEvent } from "./runtime/GameRuntime";
export {
	GameRuntimeContext,
	useGameRuntime,
} from "./runtime/GameRuntimeContext";
export { devLog, getLogLines } from "./runtime/log";
export { useGameStore, DEFAULT_UI } from "./runtime/gameStore";
export { useDebugStore } from "./runtime/debugStore";

// —— R3F scene composition ——
export { GameScene } from "./r3f/GameScene";
export { RapierBridge } from "./r3f/RapierBridge";
export { LocalPlayer, RemotePlayers } from "./player/LocalPlayer";
export { WeaponViewModel } from "./weapons/WeaponViewModel";
export { WorldEffects } from "./effects/WorldEffects";
export {
	Crate,
	Floor,
	Pillar,
	Platform,
	Ramp,
	SolidBox,
	SpawnPoint,
	Wall,
} from "./maps/primitives";
export { TestYard } from "./maps/TestYard";
export { getMap, listMaps, registerMap, testYardEntry } from "./maps/registry";
export type { MapEntry, MapSpawn } from "./maps/registry";

export { WeaponLoadout } from "./weapons/WeaponLoadout";
export { MeleeRuntime } from "./weapons/MeleeRuntime";
export { primaryLoadout, knifeDefinition } from "./weapons/definitions/loadout";
export type {
	MeleeDefinition,
	AnyWeaponDefinition,
} from "./weapons/WeaponDefinition";

export {
	ProceduralCharacter,
	CHARACTER_CONFIG,
} from "./character/ProceduralCharacter";
export type {
	CharacterInput,
	CharacterPose,
	GroundQuery,
	HandTargets,
} from "./character/ProceduralCharacter";
export { CharacterWorld } from "./character/CharacterWorld";
export { CharacterView } from "./character/CharacterView";
export { HitRegions } from "./character/HitRegions";
export {
	ProjectileSimulation,
	integrateProjectile,
} from "./weapons/fire/ProjectileFire";
export { WORLD_ENVIRONMENT } from "./sim/Environment";
export { AbilityRuntime } from "./abilities/AbilityRuntime";
export type {
	AbilityPresentation,
	AbilityUpdateContext,
} from "./abilities/AbilityRuntime";
export { AbilityRegistry } from "./abilities/SpecialAbility";
export type {
	DashAbilityDefinition,
	GrappleAbilityDefinition,
	SpecialAbilityDefinition,
} from "./abilities/SpecialAbility";
export {
	dashDefinition,
	grappleDefinition,
} from "./abilities/definitions";
