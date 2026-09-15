/**
 * @burst/game-client — R3F + @react-three/rapier game client.
 *
 * Visual identity: tiny doodle fighters on a messy desk / notebook world.
 * React owns composition/mounting (r3f/, maps/, player/, weapons/ .tsx).
 * Simulation owns per-frame state (runtime/, sim/, movement/weapon rules).
 */

// —— framework-independent core (safe for future server sim) ——
export type { Action, ActionBindings } from "./core/Input";
export { Input } from "./core/Input";
export type {
	DebugSnapshot,
	GameMode,
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
export type { KillZone } from "./player/PlayerController";
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
export { COLORS, css } from "./rendering/palette";
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
export { EntryDrop, ENTRY_DROP_CONFIG } from "./runtime/entryDrop";
export { ChaosDrops } from "./chaos/ChaosDrops";
export {
	DESK_CHAOS_AREA,
	scheduleChaosDrops,
} from "./chaos/schedule";
export type {
	ChaosArea,
	ChaosDropKind,
	ChaosDropSpec,
} from "./chaos/schedule";
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

// —— map system (data-driven kit) ——
export type {
	MapBounds,
	MapDefinition,
	MapSpawn,
	PropComponentProps,
	PropId,
	PropInstance,
	PropVariant,
	Vec3Tuple,
} from "./maps/types";
export {
	DEFAULT_MAP_ID,
	getMapBounds,
	getMapDefinition,
	getMapSpawns,
	MAP_DEFINITIONS,
} from "./maps/definitions";
export {
	deskBattlefieldEntry,
	getMap,
	listMaps,
	paperIslandEntry,
	registerMap,
} from "./maps/registry";
export type { MapEntry } from "./maps/registry";
export { PROP_CATALOG, resolveProp } from "./maps/kit/propCatalog";
export { MapFromDefinition } from "./maps/MapFromDefinition";
export { DeskBattlefield } from "./maps/DeskBattlefield";
export { deskBattlefieldDefinition } from "./maps/deskBattlefieldDef";
export { ChaosDesk } from "./maps/ChaosDesk";
export { chaosDeskDefinition } from "./maps/chaosDeskDef";
export { PaperIsland } from "./maps/PaperIsland";
export { paperIslandDefinition } from "./maps/paperIslandDef";
export {
	Book,
	BookStack,
	CoverBlock,
	DeskLeg,
	DeskSlab,
	Eraser,
	Laptop,
	Monitor,
	Mug,
	NotebookClosed,
	NotebookOpen,
	Paperclip,
	PaperSlip,
	PaperStack,
	Pen,
	Pencil,
	Phone,
	RoomFloor,
	Ruler,
	SpawnPad,
	Sticky,
	TapeRoll,
} from "./maps/kit/props";

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
export { DoodleHead } from "./character/DoodleHead";
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
