# Weapons

The playable loadout is assembled in `packages/game-client/src/weapons/definitions/loadout.ts`. Register a firearm definition and add it to `primaryLoadout` to expose it to wheel selection and the HUD. Definitions contain gameplay values, primitive model parts, optic mounts, obstruction probes, handling and equip timing. The knife is a separate registered melee definition and is excluded from the primary list.

| Weapon | Capacity | RPM | Damage | Pellets | Optic | Reload |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Rifle | 30 | 480 | 22 | 1 | 1.25x | 1.6 s magazine |
| SMG | 36 | 900 | 14 | 1 | 1x | 1.35 s magazine |
| Sniper | 5 | 48 | 80 | 1 | 6x | 2.6 s magazine |
| Shotgun | 5 | 85 | 14 per pellet | 8 | 1x | 0.55 s first shell, 0.45 s subsequent shells |

`WeaponRuntime` owns firearm ammo, cooldown, spread, pellets and reload state. One shotgun trigger consumes one shell and applies recoil once. Magazine reload locks firing until completion. Per-round reload inserts only missing rounds and can be interrupted as soon as ammunition is available. Reserves are infinite.

`WeaponLoadout` owns primary selection, lowering/raising, the ADS release gate, quick melee and held-knife selection. `MeleeRuntime` owns windup, hit window, recovery and attack cooldown. Tap F draws and attacks, then restores the previous firearm. Holding F for 240 ms keeps the knife equipped. Primary fire repeats attacks while equipped; wheel selection returns to the retained primary. A hit window can sample multiple physics steps but registers at most one contact per swing.

`GameRuntime` launches every firearm pellet into `ProjectileSimulation` from the resolved muzzle. There is no hitscan firearm path. Projectiles sweep each integration segment against Rapier world geometry and registered character hit regions; only collisions apply damage. The test-yard character has health and head/body regions. `runtime.onImpact` also exposes actor/region, flight time and impact velocity. Melee retains its configured sphere sweep.

Projectile definitions use muzzle velocity (m/s), mass (kg), and effective ballistic coefficient (kg/m²): BC = mass / (Cd × cross-sectional area). This is explicitly not a G1/G7 catalog coefficient. Quadratic drag uses shared air density and relative wind velocity; shared world gravity determines drop. Mass cancels out of acceleration for equal BC, since BC already contains mass. Damage remains a gameplay value, multiplied by the configured headshot multiplier on head contact; energy does not set damage. `sim/Environment.ts` centralizes gravity, air density, wind, integration step and lifetime. Gravity remains 28 m/s² to match the movement world. The current effective drag model does not yet model Mach-dependent drag, penetration or ricochet.

Presentation reads simulation state. Models switch at the lowered point, optics render their own magnified view, and ADS never narrows the main camera for magnification. Register any finite magnification of at least 1x in `ScopeRegistry`. Weight, response, recoil travel, reload tilt and insertion travel come from each weapon's motion profile.

Wall contact probes the uncorrected intended pose. It first solves bounded displacement in the camera plane, then smoothly retracts for residual obstruction. This allows side contact without a backward snap. Sudden deep overlap deliberately follows the smooth response rather than teleporting the weapon, so brief visual penetration is possible on abrupt camera turns. Rapier collision still owns the player's position and muzzle obstruction checks still prevent firing through cover.


Optic textures remain live outside ADS. The secondary camera shares the simulation aim, including camera recoil; cosmetic weapon rotation does not create a second aiming direction. Muzzle launch directions converge on the sight ray target; this ray selects direction only and never applies damage. Ballistic drop after launch remains physical. Camera recoil values are angular shot displacement in radians; visualKick is a view-model spring velocity impulse.

The primitive character lives in `character/`. `ProceduralCharacter` consumes motion snapshots and a ground-query function, independently of React and input. Foot plants are world-locked; predicted footholds, alternating support, reach limits and terrain contacts drive the legs. Crouch, slide, airborne and wall-brace targets feed the same limb solver. `CharacterWorld` owns actors and hit regions. Weapon grip/loading points supply arm targets, and the local rendered weapon hierarchy supplies exact grip positions after ADS, recoil, reload and obstruction transforms. Local head, upper torso, upper arms and duplicate world weapon are excluded from the first-person camera to prevent self-occlusion. Hips and legs remain visible, with hands and forearms attached to the rendered weapon. Body snapshots interpolate on the same timeline as the camera. Render-only hand IK never writes back to simulation or hit regions. Remote bodies use the same rig from snapshots. The test-yard bot exercises its motor with movement transitions.
