# P4 — Deterministic Combat Simulation: Inventory & Census

Audit for `runBattle(seed, build, encounter)` — the headless deterministic
battle harness (plan:
`docs/superpowers/plans/2026-09-22-deterministic-combat-simulation.md`).
Scope: the WHOLE combat dependency closure — battle/scheduler/ops plus every
owner the canonical build pulls from (PersistentEffectOps, Player assembly,
SkillSystem/TechniqueSystem, BuffPersistence, stage/encounter, settlement).

## 1. Non-determinism census

Sweep: `Date.now` / `performance.now` / `Math.random` / `crypto.randomUUID`
over `src/core/battle`, `src/core/combat`, `GameManagerTurnBattleOps`,
`CombatBuild`, `GameManagerPersistentEffectOps`, `src/core/enemy`,
`StageWaveSystem`, `Player`, `src/core/skill`, `src/core/technique`,
`src/core/buff2`, `GameManager`.

| Site | Role | Verdict |
|---|---|---|
| `FunctionCombatRng(() => Math.random())` defaults — TurnBattleSystem:490, CombatSystem:124, ops:1002/1043, GameManager:251 | All combat rolls (formulas, procs, spawn placement, picks) | DETERMINISTIC — every default is wrapped by the per-cycle `combatRng` seam; `setBattleRngFactory(() => new SeededCombatRng(seed))` installs the seeded stream for the whole cycle (`commitCycleRng`, ops:1589) |
| `crypto.randomUUID()` — EnemySystem:20 | Spawned-enemy entity ids | EXCLUDED by normalization — raw ids differ across same-seed runs; metrics/fingerprint aggregate by role key (`enemy:<templateId>:<spawnOrdinal>`) |
| `Date.now()` — ops:2087 `turnBattleStartedAtMs` | Presentation timing (HUD elapsed display) | EXCLUDED — never feeds combat math |
| `Date.now()` — PersistentEffectOps:266/277/305/342/360 | Timed-effect read (`getActiveRuntimeModifiers` bare at :145 via `getLiveBattleModifiers`), expiry (`tickTimedEffects` on `setActivePlayer`), grant/activation | CONTRACT-STRIPPED — harness removes `persistentTimedEffects` from the cloned player; consumables are wall-clock state, not build identity. Diagnostic `timedEffectsStripped` counts removals. Conditional repair (deterministic `now` seam at the owner) deferred — P5 baselines don't need buffed builds |
| `Date.now()` — Player:411 `lastSavedAt` | Save metadata | EXCLUDED — not combat |
| `performance.now` | — | CLEAN — zero hits in the closure |
| `Math.random` economy lanes (loot/alchemy/pill) | Post-battle drops | OUT OF SCOPE by design — metrics exclude drops |
| `src/core/skill`, `src/core/technique`, `src/core/buff2` | Build state owners | CLEAN — zero unseeded hits; state arrives via `restore()` clones |

## 2. Consumed-step boundary

`getElapsedCombatSteps()` counts EMITTED fixed-step batches — `advanceCombat`
drops the remainder of a batch when a step freezes/stops the clock, and one
outer `ManualClockSource.advance()` can emit several steps. The harness counts
and samples on `turn_battle_entity_snapshot` (ops:504/509/545), emitted once
per CONSUMED step and carrying `phase` (`intro`/`countdown`/`fighting`/…).

- `steps` = all consumed snapshots → `durationSeconds`
- `fightingSteps` = steps consumed under `fighting` by PRE-step phase
  attribution — the snapshot's `phase` is post-step state, so a
  transition step (countdown→fighting, fighting→victory/defeat) belongs
  to the phase that spent it (collector `lastPhase` chain);
  `metrics.phaseSteps` exposes the per-phase breakdown → `combatDurationSeconds` — the
  DPS/TTK/rate time base (intro+countdown are fixed presentation time)

## 3. Build-snapshot census (non-PlayerData combat state)

| State | Owner | Restore seam |
|---|---|---|
| Learned skills (`has()`, kit, `getScaledPassiveModifiers`, Ngộ Đạo validation) | `SkillManager` | `skillManager.restore(clone(skills))` |
| Learned/equipped techniques (`getTechniqueCombatModifiers`) | `TechniqueManager` | `techniqueManager.restore(clone(techniques))` |
| Path/way identity, nodes, formation, companions, Pháp Tu route, equipment, stats | `PlayerData` | `setActivePlayer(structuredClone(player))` |
| Persistent buffs | `BuffPersistence` | GameManager-scoped — fresh-empty per run; sim inputs cannot carry it (boundary note) |
| Timed effects | `player.persistentTimedEffects` | STRIPPED per contract (§1) |

`SimBuildSnapshot = { player, skills, techniques }`. `restore()` deep-clones
its payload; the harness additionally clones `player` — a run mutates it
(ritual writes path/way, battle mirrors `skillCastCounts`, settlement writes
rewards/`completedStageIds`).

## 4. Metric provenance map

| Metric | Canonical surface | Rule |
|---|---|---|
| Damage / DPS / by-source / damageType | `damage` events | DPS time base = `combatDurationSeconds` |
| TTK | `fightingSteps` × 0.1s | lifecycle `steps` reported alongside |
| Absorption | `damage` event `wardAbsorbed + manaShieldAbsorbed` | `wardAbsorbed` already includes `externalWardAbsorbed` (ops:441) — never add it again. Full mitigation (armor/resist/block pre-value) is NOT observable → recorded gap |
| Healing | vitals positive `hpAfter−hpBefore` for `healing`/`leech`/`regen` | `heal` events cover only healing/leech — regen hp lives only on vitals |
| Overheal | `max(0, amount − hpDelta)` | `healing`/`leech` ONLY (`amount` = pre-clamp request). Regen `amount` = post-clamp applied → regen overheal unobservable → recorded gap |
| Resource ledger | **ward = vitals-complete**: every ward mutator emits (`spendWard`/`grantWard` → `ward_spend`/`ward_grant`; the raw `currentWard` drain in `resolveIncomingHit` arrives via the `damage` event's before-snapshot; `applyTurnRegen` → `regen`). Authored ward ops AND the engine-lane consume-ward burst (TurnBattleSystem, no op record) both surface here — trace must NOT recount ward/`apply_shield` (double-count) | **mana/`the` = trace lane**: `consume_resource`/`gain_resource` narrowed `status==='resolved'` + type → `result.result?.applied`; both are raw field writes with no vitals (`consumeResourceFor`, `currentThe`). Vitals mp deltas (mana-shield `damage` drains, `regen`) supplement without overlap |
| Cast frequency | `attack` events by `skillId` | committed casts only |
| Buff/seal uptime | per-snapshot `getBattleBuffs` samples | denominator = entity alive during `phase==='fighting'` steps |
| Reactions | `reaction_resolved` + `reaction_skipped` | count + per-id + per-minute over `combatDurationSeconds` |
| Deaths / outcome | `death`/`kill` + terminal `battle.state` | `maxSteps` cap → `timeout` |

## 5. Gap report

| Item | Status |
|---|---|
| Full mitigation (armor/resistance/block reduction pre-`damage.value`) | CONFIRMED GAP — no canonical surface; recorded in `diagnostics.gaps`, not silently claimed |
| Regen overheal | CONFIRMED GAP — `amount` = post-clamp applied; recorded |
| Cast-cost resource debits | NOT A GAP (corrected in review) — production routed casts map `plan.cost` → `consume_resource` ops via `routeCast`/`commitShell`; trace covers them. `commitAction → consumeResourceFor` runs only on the engine-unit lane (`runtime === undefined`, no scheduler) — not the GameManager production path |
| Persistent buffs in sim input | BOUNDARY — `BuffPersistence` is GameManager-scoped, always fresh-empty |
| Timed effects | CONTRACT-STRIPPED — deterministic `now` seam deferred (conditional repair if a future sim needs buffed builds) |
| Spawn entity ids | NORMALIZED — role keys, never raw `randomUUID` ids |
| Economy/drop rolls | OUT OF SCOPE — metrics exclude drops |

Everything else resolves through canonical surfaces — no production event
schema extension required in this phase.
