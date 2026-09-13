# M7 — ARCH-002 stat refresh / battle reset repair (G5 evidence report)

Mission: `arch/m7-stat-refresh`, worktree `arch-m7-stat-refresh`, fork `81c30e04`.
Scope: unify stat assembly, effective-stat refresh, and battle reset so the game
has one resolved->effective stat path and no modifier leakage between battles.

## G0 — task card

**Responsibility being repaired (ARCH-002):**

1. Ephemeral passive state resets BEFORE the player battle snapshot is taken
   (`playerToCombatEntity` reads final stats), not after.
2. The battle entity's resolved base contains only static sources; the live
   runtime modifier set (passive stacks, persistent buff pool) reaches the
   effective view through one battle-scoped provider owned by the turn engine.
3. `entity.stats` refreshes immediately at every buff apply/remove/expire and
   at every pacing step — including CC'd and charging actors — so every
   dependent read (speed pacing, damage, counters) sees current values.
4. Battle reads the same effective values the menu/UI shows (one modifier
   union, one calculator, two passes per the R2 contract).

**Invariants restored:**

- `entity.baseStats` = resolved entry snapshot (never mutated post-build; the
  R14.3a guard already forbids `.baseStats =` in production).
- `entity.stats` = `calculateEffectiveStats(baseStats, buffModifiers + liveModifiers)`
  recomputed at every mutation boundary; `participant.speed` mirrors
  `entity.stats.speed`.
- `calculateStats` (raw->resolved, branded `BaseStats` input) runs exactly once
  per battle entry, inside the ops after the passive reset; no second
  calculator is introduced.
- Passive stacks remain owned by `PassiveSystem`/`SkillManager`; the turn
  engine only reads them through `effectOps.getLiveBattleModifiers()`.

## G1 — evidence map (pre-change)

Reproduction anchors from the audit (2026-09-14 audit-combat-review C01/C03):

- `stores/player.ts` `finalStats`: `calculateStats(baseStats, [modifiers,
  externalModifiers, kiemY])` — `externalModifiers` is a per-world-tick mirror
  written by `App.vue` from `effectOps.getAggregatedModifiers()` (which folds
  `skillSystem.getScaledPassiveModifiers()` at CURRENT stacks). A menu refresh
  after battle N therefore bakes battle-N stacks into `playerStats` passed to
  battle N+1 -> leak (observed: 106.159 vs clean 100.15).
- `GameManagerTurnBattleOps.startBattleWithPlayer` (line ~798): resolved
  `playerStats` arrives from the caller BEFORE `startBattle` runs
  `deps.resetPassiveStacks()` (line ~748) -> reset cannot scrub the snapshot.
- `GameManagerTurnBattleOps.buildTurnBattle` (line ~946): formation buffs are
  applied to `participant.buffs` with no effective-stat recompute until the
  first actionable turn.
- `TurnBattleSystem.declareActorAction` (line ~781-793): the only recompute is
  gated by `alive && !ccBlocked && !isCharging`; apply/remove/expire paths in
  `applyActionImpact` (lines ~1036/1050/1054/1065/1075/1118/1124) never
  recompute; `tickPacing`/`peekNextActor` only copy `entity.stats.speed` into
  the cache.
- `recomputeEffectiveStats(resolvedBase, buffs)` (TurnStatsRecompute.ts):
  buff-pool modifiers only — the passive/persistent live set has no path in.
- `getActiveRuntimeModifiers()` (timed + socket mods) had no battle
  consumer pre-change, and the menu mirror excluded it too — both sides
  silently dropped the channel. (G2 decision: wire it into BOTH the live
  battle provider and the App.vue mirror so the union stays symmetric.)

## G2 — design decisions

- **Owner of the resolved base:** `resolvePlayerFinalStats(player, external)`
  extracted from the store getter into `core/player/Player.ts`; the store
  getter delegates to it. Ops resolves the base internally via
  `deps.resolvePlayerStats` = `resolvePlayerFinalStats(player,
  effectOps.getBattleBaseModifiers(player))` — called AFTER
  `resetPassiveStacks()`, so the snapshot cannot capture stale stacks.
- **Aggregation partition (same owner, `GameManagerPersistentEffectOps`):**
  - `getBattleBaseModifiers(player)` — technique tier + path + nodes +
    technique combat modifiers (static for the duration of a battle).
  - `getLiveBattleModifiers()` — persistent buff pool + scaled passive
    modifiers (duration/stack-bound, read live at every refresh).
  - `getAggregatedModifiers(player)` (menu mirror) is unchanged; App.vue
    now appends `getActiveRuntimeModifiers(player)` to the
    `externalModifiers` it feeds the store, so the menu shows the same
    modifier UNION the battle live provider serves.
- **Provider:** `TurnBattleSystem` constructor takes an optional
  `liveStatModifiers?: (entity: CombatEntity) => StatModifier[]`; ops wires
  `(entity) => entity.id === 'player' ? deps.getLiveBattleModifiers() : []`.
  The provider returns MODIFIERS, never stats — `TurnStatsRecompute` stays the
  single assembly site.
- **Refresh points:** `refreshEffectiveStats(battle)` (public; also used by
  ops right after `buildTurnBattle` so formation buffs are folded before the
  first gauge read); `tickPacing` + `peekNextActor` refresh all participants;
  `declareActorAction` refreshes the acting participant unconditionally
  (before the alive/CC/charge gate — covers expiry, duration-1 buffs, boss
  triggers, Ba The clears, CC'd and charging actors); `applyActionImpact`
  refreshes each participant after every pool mutation it performs
  (appliesBuff, ailments, consume-removal, on-hit/reactive triggers, charge
  resolve, non-damaging debuff path).
- **Entry signature change:** `startStage`/`StageWaveSystem.start`/
  `launchBattle`/`startBattleWithPlayer`/`GameManager.startBattleWithPlayer`
  drop the `playerStats` parameter — the caller can no longer inject a stale
  resolved snapshot; ops owns resolution post-reset. All call sites migrate
  (tests set `player.baseStats`/`player.modifiers` instead of passing stats).

## Q1-Q12

- **Q1 (observable behavior):** tat_phong stacks raise in-fight speed and
  reset clean for the next battle; kim_giap (via thiet_y_tang self-buff)
  raises defense/thorns before the counter read; buff expiry, CC'd and
  charging actors, formation buffs, and spawn-telegraph windows all read
  current effective stats. Failure mode (stale/leaked stats) is covered by
  `GameManager.statRefresh.test.ts` + `phaGiapCarry.test.ts`.
- **Q2 (one owner):** raw->resolved = `resolvePlayerFinalStats`
  (`core/player/Player.ts`), called once post-reset inside the ops;
  resolved->effective = `recomputeEffectiveStats` (`TurnStatsRecompute.ts`)
  — the only assembly site, now taking the live modifier list as data.
- **Q3 (state lifecycle):** `entity.baseStats` written once at adapter
  construction (R14.3a guard pins zero production post-creation writes);
  `entity.stats` rewritten by refresh only; `participant.speed` mirrors
  `entity.stats.speed`; passive stacks reset by `deps.resetPassiveStacks()`
  before resolution and seeded by `seedPassiveCarry` + immediate refresh.
- **Q4 (real chain):** `useBattleActions.runStageStart` ->
  `turnBattleOps.startStage` -> `StageWaveSystem.start` -> `launchBattle` ->
  `startBattleWithPlayer`; debug spawn uses `GameManager.startBattleWithPlayer`.
  All now stat-injection-free.
- **Q5 (existing primitive):** reused `calculateEffectiveStats`/
  `calculateStats`, `BuffSystem.getActiveModifiers`, the existing
  aggregation owner — no new calculator.
- **Q6 (dependency direction):** engine takes a provider callback
  (dependency inversion), ops owns the closure; `Player.ts` gains a
  KiemYSystem import (core->core, same layer as the store getter it
  replaced). No presentation imports in core.
- **Q7 (timing/gameplay/presentation):** refresh is a domain write inside
  tick/declare/impact; presentation unchanged — App.vue only widens the
  data passed to an existing mirror call.
- **Q8 (consumers preserve semantics):** every former `playerStats`
  consumer migrated; the resolved base now derives post-reset from the
  static partition (strictly fresher than the old caller snapshot);
  `participant.speed` semantics unchanged (cache of entity.stats.speed).
- **Q9 (queries observational):** `peekNextActor` additionally recomputes
  derived views — idempotent, no authoritative mutation; the peek already
  wrote the speed cache before.
- **Q10 (duplicate/stale/failed/interrupted):** `resetPassiveStacks` is
  idempotent (called at ops entry and inside `startBattle`); double
  refresh is idempotent; `liveStatModifiers` returns `[]` for
  non-player/absent-player entities — no stale source.
- **Q11 (old path):** caller-side `finalStats` injection retired for all
  battle entries; the store `finalStats` getter remains as the menu read
  and now delegates to the same `resolvePlayerFinalStats` owner.
  Tribulation retains its own `player.finalStats` snapshot — documented
  retained debt below.
- **Q12 (scope/finish):** every changed file maps to the ARCH-002
  invariant or its migration; verification below; stop condition = full
  suite modulo documented pre-existing failures.

## Files changed

- `core/player/Player.ts` — `resolvePlayerFinalStats` (single resolved-base
  owner, extracted from the store getter; folds permanent Kiem Y mods).
- `stores/player.ts` — `finalStats` delegates to the owner.
- `core/game/GameManagerPersistentEffectOps.ts` — `getBattleBaseModifiers`
  (static partition) + `getLiveBattleModifiers` (live partition).
- `core/game/GameManager.ts` — wires the two deps; entry signature drops
  `playerStats`.
- `core/game/GameManagerTurnBattleOps.ts` — post-reset resolution order,
  `liveStatModifiers` provider, `BUFF_REGISTRY` for non-stage battles,
  post-construction + post-seed refreshes, `startStage` signature.
- `core/game/StageWaveSystem.ts` — `start`/`launchBattle` signature.
- `core/battle/turn/TurnBattleSystem.ts` — `refreshParticipantStats`/
  `refreshEffectiveStats` + refresh at every mutation/read boundary.
- `core/battle/turn/TurnStatsRecompute.ts` — third `liveModifiers`
  argument; still the single assembly site.
- `App.vue` — menu mirror now unions `getActiveRuntimeModifiers`; debug
  spawn call migrated; dead `getStats` dep removed with
  `core/dev/enemySpawnDebug.ts`.
- `composables/useBattleActions.ts` — `startStage` call migrated.
- `core/game/__fixtures__/startAStage.ts` — patches raw baseStats at
  construction (object-literal form; R14.3a-safe).
- ~35 `*.test.ts` + `tests/lab/*` — migrated to the new signatures; turn
  fixtures now keep `baseStats` synchronized with overridden `stats`;
  new `GameManager.statRefresh.test.ts` (7 M7 regression tests).
- `docs/qa/2026-09-14-m7-stat-refresh*.md` — this report + QA report.

## Verification

- `npm run type-check` — PASS (exit 0).
- `npm run build` — PASS (1739 modules, built in ~6.4s).
- `npx vitest run` (full, post-fix) — 3802 passed / 5 failed of 3807.
  Failures classified per P12:
  - `perfectClear.feasibility` multi-hit floors 1/5/9/10 — PRE-EXISTING
    (all 4 fail identically at fork commit `81c30e04`, verified via
    `git stash` baseline run; marginal/flaky round counts, balance-lock
    limits unreachable for ~3-hit kills — out of M7 scope).
  - `ChiHienQuan.integration` duplicate-pull pity — FLAKE under parallel
    workers; passes in isolated rerun; no stat-path dependency.
- Targeted M7 scope — 125 tests green across 14 files
  (`statRefresh`, `phaGiapCarry`, `talentv4.qa`, `activeTurnBattleStage`,
  `presentationGate`, all `TurnBattleSystem.*`, `tests/lab/*`,
  `statProvenanceAndQueryPurity` guard).

## P4 / P5 / P13 / P14

- **P4 adversarial QA (quick):** `2026-09-14-m7-stat-refresh-quick.md` —
  PASS WITH EVIDENCE. Mapper's `deepAuditCandidate` bounded by inspection
  (no save/cloud, clock/offline, or Phaser-lifecycle change); double-apply
  and partition-overlap hypotheses disproven; all three engine
  constructions verified wired.
- **P5 code review:** diff reviewed against A2/A9 — one calculator, one
  assembly site, provider returns modifiers only. No >=80-confidence
  findings; noted `peekNextActor`'s widened derived-view write is
  idempotent and consistent with its existing cache write.
- **P13 runtime wiring:** driving path change is inside existing
  `GameManager.update()`/`startStage` flows — no new wiring surface;
  headless GameManager tests exercise the real entry chain end-to-end
  (skill specials, waves, perfect-clear bookkeeping).
- **P14 visual:** deferred per the isolated-worktree exception
  (`.agent-worktrees/**`) — no rendering/animation/layout behavior
  changed; menu/battle now show identical effective numbers, verifiable
  from the main checkout at branch finish.

## Retained debt / non-goals

- `TribulationDirector.start` still constructs its own tank entity outside
  the turn engine (no buff/refresh machinery) — only the snapshot leakage
  was repaired (see Review round 1); deeper unification stays out of M7.
- `liveStatModifiers` serves only the primary player (`entity.id ===
  'player'`); companions/enemies return `[]` — they have no runtime
  modifier channel today. If companions ever gain passive stacks or
  persistent debuffs, the provider needs a per-entity lookup.
- The perfect-clear multi-hit feasibility lock is unreachable on floors
  1/5/9/10 even at the fork commit — a balance/test-design issue for a
  separate mission, recorded here so it is not silently absorbed.
- `peekNextActor` now rewrites derived stat views inside a query-shaped
  call — idempotent and consistent with its prior speed-cache write, but
  worth revisiting if a strictly read-only peek is ever needed.

## Review round 1

Independent review (SPEC compliant / changes-needed) follow-up. All items
addressed in the same worktree; no commit yet.

### Fixed this round

- **`entity.maxHp` reconciliation** (`TurnBattleSystem.refreshParticipantStats`,
  ~:587): the effective-stat refresh now writes `entity.stats.maxHp` back to
  the real `entity.maxHp` field that `EntityVitalsSystem` heal clamps,
  regen gates, vitals events and `BattleSnapshotVitals` read. The reconcile
  goes through the vitals authority — `clampToMaxHp(entity, 'stat_refresh')`
  behind a `stats.maxHp !== entity.maxHp` guard — so a changed ceiling emits
  `entity_vitals_changed` on the same step (new `VitalsChangeReason`
  `'stat_refresh'`; `amount` is 0 on pure growth, positive when the shrink
  clamp actually removed HP). Shrink clamps `currentHp`; growth preserves
  it — no free healing.
  Regression: `GameManager.statRefresh.test.ts` "live maxHp moves the real
  heal ceiling" — a timed `maxHp` modifier grows the ceiling mid-battle,
  `CombatSystem.applyHealing` fills past the old cap, expiry shrinks the
  ceiling and clamps `currentHp` on the same step.
- **Tribulation ghost snapshot leakage** (`GameManager.startTribulation`):
  `resetPassiveStacks(player)` now runs BEFORE `resolveAmbientPlayerStats`,
  matching `startBattleWithPlayer` — leftover passive stacks can no longer
  be baked into the ghost's `baseStats`/`stats`/`maxHp`/snapshotDefense.
  `useTribulation` / `TribulationOutcomeService.startTribulationPrepared`
  delegate to this entry, so the fix covers every production path; defeat
  resolution still resolves ambient stats post-reset (consistent with the
  battle-path semantics). Regression: "startTribulation resets leftover
  passive stacks BEFORE the ghost snapshot".
- **Actor refresh symmetry** (`TurnBattleSystem.ts`): the reaction path
  now refreshes the SOURCE actor after `TurnReactionManager` grants it a
  reaction buff (~:1057), the non-damaging branch refreshes the actor
  after the same grant (~:1146), and the paired target/actor refresh after
  `removeAllById` moved OUTSIDE `if (this.registry)` (~:1131) — a
  registry-less engine (reactionPathE2E coverage) no longer leaves stale
  effective stats after removal.
- **Migration cleanup**: dead `calculateStats` imports / `stats` locals
  removed from migrated tests; `turnStatusVfx` comments updated to the
  BUFF_REGISTRY reality.

### Intentional behavior change (was undocumented)

- **`BUFF_REGISTRY` is now constructed at `GameManager`** and passed into
  every `TurnBattleSystem` path (direct battles included). Authored
  buff/ailment mechanics (`buffApplyChance`, `ailments`) now apply in
  direct/duel battles that previously ran registry-less — runtime
  resolution only; `buffChance` remains rejected by content validation.
  Tests that relied on registry-less stage battles were migrated, not
  weakened.

### Retained debt added this round

- Live modifiers targeting `MainStatKeys` (e.g. an attunement modifier)
  propagate the raw stat but derived powers are NOT re-derived:
  `calculateEffectiveStats` re-runs the stat pipeline only, never
  attribute derivation — so `passive_dai_thua_dao_tam` remains dead in
  combat. Parked for M9 buff-identity work that owns the modifier channel.
- Percent-pool split: live percentages multiply over the
  already-percent-scaled resolved base (resolved % baked in, then live %
  applied), while the menu pools % and flat before scaling. Same
  modifiers, different fold order — inherent to the R2 contract, accepted.
- No refresh during intro/countdown: pre-battle steps don't recompute
  effective stats, but nothing reads combat stats there — display-level
  only.
- Equipment asymmetry is intentional: equipment affixes resolve into the
  immutable battle base only; sockets/timed effects flow through the live
  channel and refresh mid-battle.
- `peekNextActor` derivation rewrite and the perfect-clear multi-hit
  feasibility failures (pre-existing at fork commit `81c30e04`) stand as
  recorded above.
