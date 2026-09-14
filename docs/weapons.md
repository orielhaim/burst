# Weapons

The playable loadout is assembled in `packages/game-client/src/weapons/definitions/loadout.ts`. Register a firearm definition and add it to `primaryLoadout` to expose it to wheel selection and the HUD. Definitions contain gameplay values, primitive model parts, optic mounts, obstruction probes, handling and equip timing. The knife is a separate registered melee definition and is excluded from the primary list.

| Weapon | Capacity | RPM | Damage | Pellets | Optic | Reload |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Rifle | 30 | 480 | 22 | 1 | 1.25x | 1.6 s magazine |
| SMG | 36 | 900 | 14 | 1 | 1x | 1.35 s magazine |
| Sniper | 5 | 48 | 110 | 1 | 6x | 2.6 s magazine |
| Shotgun | 5 | 85 | 14 per pellet | 8 | 1x | 0.55 s first shell, 0.45 s subsequent shells |

`WeaponRuntime` owns firearm ammo, cooldown, spread, pellets and reload state. One shotgun trigger consumes one shell and applies recoil once. Magazine reload locks firing until completion. Per-round reload inserts only missing rounds and can be interrupted as soon as ammunition is available. Reserves are infinite.

`WeaponLoadout` owns primary selection, lowering/raising, the ADS release gate, quick melee and held-knife selection. `MeleeRuntime` owns windup, hit window, recovery and attack cooldown. Tap F draws and attacks, then restores the previous firearm. Holding F for 240 ms keeps the knife equipped. Primary fire repeats attacks while equipped; wheel selection returns to the retained primary. A hit window can sample multiple physics steps but registers at most one contact per swing.

`GameRuntime` resolves hit commands against Rapier. Hitscan checks the camera aim and corrected muzzle; projectile definitions launch swept trajectories with gravity and lifetime. Melee sphere casts use the defined range and radius. Gameplay targets can subscribe to `runtime.onImpact` for damage and collider identity; the current test yard is geometry without target health. No damage queue grows when no subscriber exists.

Presentation reads simulation state. Models switch at the lowered point, optics render their own magnified view, and ADS never narrows the main camera for magnification. Register any finite magnification of at least 1x in `ScopeRegistry`. Weight, response, recoil travel, reload tilt and insertion travel come from each weapon's motion profile.

Wall contact probes the uncorrected intended pose. It first solves bounded displacement in the camera plane, then smoothly retracts for residual obstruction. This allows side contact without a backward snap. Sudden deep overlap deliberately follows the smooth response rather than teleporting the weapon, so brief visual penetration is possible on abrupt camera turns. Rapier collision still owns the player's position and muzzle obstruction checks still prevent firing through cover.
