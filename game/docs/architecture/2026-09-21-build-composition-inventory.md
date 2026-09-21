# Build Composition Inventory (P2-M0)

Baseline: branch `p1-canonical-path-authority`, HEAD `a4a8357` (P1 landed, uncommitted — this plan stacks on it). Date: 2026-09-21.

This document is the maintained channel/consumer map for the canonical
`ResolvedCombatBuild` layer introduced by the P2 plan
(`docs/superpowers/plans/2026-09-21-canonical-build-composition.md`).

## Modifier channel census (battle path)

Every `StatModifier[]` reaching `resolvePlayerFinalStats` at battle entry,
named — this is the `BuildStatChannel` vocabulary:

| channel | owner call | partition | sourceType values |
|---|---|---|---|
| `player_bag` | `player.modifiers` (persisted) | static | `equipment`, `realm_passive`, `meridian`, `body`, `tribulation`, `pill` — attribution rides `StatModifier.sourceType` |
| `technique_tier` | `GameManagerPersistentEffectOps.getTechniqueTierModifiers(player)` | static | technique tier effects (domain-gated MP family) |
| `cultivation_path` | `getCultivationPathStatModifiers(player)` | static | path base stats |
| `phap_tu_route` | `getRouteStatModifiers(player)` | static | route stats (STATIC in both aggregators — route cannot change mid-battle) |
| `node_levels` | `aggregateNodeStatModifiers(nodeRegistry, player)` | static | ngo_dao + all node trees |
| `technique_combat` | `getTechniqueCombatModifiers()` | static | equipped technique combatModifiers |
| `way_facet` | `collectActiveWayStatModifiers(player, attributeTotals)` — inside `resolvePlayerFinalStats` | static | way stat-facet emissions (D12 totals-gated) |
| `live_battle` | `getLiveBattleModifiers(player)` — persistent buffs + scaled passives + timed/socket effects | live | never folded into the resolved base — reaches `entity.stats` per refresh through the bound provider |

Ordering (D12, spec sec.5): `player_bag + static channels` →
`resolveAttributeTotals` → `way_facet` → `calculateStats`. The totals read
is not a second attribute derivation (INV-6); facet emissions are the only
gated channels (INV-10).

## Assembly-input census (non-stat reads at battle entry)

| input | current site | disposition in build |
|---|---|---|
| `resolvePlayerStats` (base) | ops:1667 `deps.resolvePlayerStats(request.player)` | build field `stats` — resolved once |
| `playerToCombatEntity` | ops:1669-1673 | build field `entity` (minted path) |
| `resolveMaxThe` | ops:1678 | consumed into `entity.maxThe` (minted path only) |
| `resolveBasic`/`resolveSpecialUltimate`/`resolveStatDomains` | ops:1988-1994 | build field `kit` |
| `buildDynamicBasic` | ops:2003-2010 | `kit.buildDynamicBasic` — bound thunk over the node snapshot; rng arrives at mint |
| `emblemSlots` | ops:2014-2020 | `kit.emblem` — applied post-kit in assembly |
| `resolvePartyFormation` | ops:1975 | build field `formation` |
| `player.companions` + `COMPANIONS` + `resolveCompanionSkillKit` + `companionToCombatEntity` | ops:2025-2048 | build field `companions` |
| formation buff (`TRAN_PHAP_FORMATIONS` x `formationLoadout`) | ops:1321-1337 | `entryBuffs` declaration (registry-membership skip stays in ops) |
| aura (`grantsElementalReactionAura` / `phap_tu.reaction_aura` cap) | ops:1345-1359 | `entryBuffs` declaration, source = primary entity id |
| kit-clone `grantsBuffsAtBuild` | ops:1361-1371 | `entryBuffs` from EFFECTIVE post-emblem slots (player + companions) |
| `surviveLethalGuard.beginBattle` + `buildSurviveSources` | ops:1772-1867 | `build.survive` — consumed ONLY inside the `if (request.player)` gate |
| `liveStatModifiers` closure | ops:232-240 | `build.liveModifiers` — literal `'player'` id gate + live `getActivePlayer` read |
| `playerDataForTurnBattle` wiring | ops:1754-1757 | retained ops seam (not build state) |
| `buildPlayerRewardReceiver`/`seedPassiveCarry` | ops:1763-1766 | retained ops seams (player-gated) |
| enemy/wave assembly | ops:1691-1721, 2057-2067 | retained — NOT the build |
| `resolvePathRuntime` | 4 call sites (:1678/:1986/:1349/:1781) | single call in `beginBattleCycleCommitted` (override-aware); retained separately for the dormant revive seam |

## Parity-risk list (order-sensitive)

1. **Emblem before clone collection** — `grantsBuffsAtBuild` reads the
   participant's post-emblem slots (ops:2014-2020 writes
   `participant.special/ultimate`, then ops:1361-1371 scans them).
2. **maxThe two-writer** — ops:1678 (`resolveMaxThe`, player path only)
   then adapter:84-86 (`specialUltimate.maxThe` stamp, both paths).
   Build resolves once: minted = `specialUltimate?.maxThe ??
   resolveMaxThe(source)`; raw override = `specialUltimate?.maxThe ??
   override.maxThe`.
3. **Kit evaluated twice today** — `resolveBasic` and
   `resolveSpecialUltimate` each rebuild the way kit (resolveTheTuKit /
   resolveAnKit). The build resolves once per method call parity
   requires observable equality, not reference identity.
4. **Companion silent skip** — missing definition OR missing formation
   slot drops the companion (ops:2029-2031).
5. **Aura alive-filter** — only living allies receive
   `van_phap_than_hoa` (ops:1352); minted entities are alive at entry.
6. **Unknown formation buff id** — `registry.tryGet` graceful skip stays
   in ops (battle-local registry read — not build state).
7. **Survive/live gates** — survive wiring requires `request.player`;
   live modifiers require literal `entity.id === 'player'` + live
   `getActivePlayer()` read at refresh time (not the build source).
