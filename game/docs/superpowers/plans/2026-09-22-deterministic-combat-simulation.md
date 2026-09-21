# P4 — Deterministic Combat Simulation & Balance Harness

> **For agentic workers:** Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0-G5) and return the G5 evidence report. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/specs/2026-09-20-post-canonical-foundation-block-spec.md` §P4.

**Goal:** `runBattle(seed, build, encounter)` — a headless deterministic battle driver over the canonical systems (P1 path authority → P2 `resolveCombatBuild` → P3-proven `TurnBattle` loop) that emits a normalized metrics record for balancing and regression checks. Same seed + same inputs → same result; outcome independent of frame-rate / Phaser; batch simulation available.

```
Combat Input (seed + SimBuildSnapshot{player,skills,techniques} + optional ritual{pathId,wayId} + SimEncounter)
    ↓
Deterministic Combat Simulation (GameManager headless, ManualClockSource, SeededCombatRng)
    ↓
Canonical Combat Events (eventBus + scheduler trace + per-step buff sampling)
    ↓
Normalized metrics record (role-normalized entity keys, FNV fingerprint)
```

## Decisions (settled before review)

- **Harness is an orchestrator, not a rule owner.** `src/core/simulation/` constructs a real `GameManager`, registers the real data catalogs (SKILLS / TECHNIQUES / ENEMIES / STAGES / progression nodes — same fixture set the P3 vertical-slice test proved), installs `ManualClockSource` + `SeededCombatRng` through the EXISTING seams (`setCombatClockSource`, `setBattleRngFactory`), drives the clock to terminal, and reads only public surfaces (`eventBus`, `turnBattleOps`, `getTurnBattle`, `getElapsedCombatSteps`, `getBattleBuffs`). No new authority, no private-field access, no combat-rule branching inside the harness.
- **RNG scope is already correct.** `commitCycleRng` (ops:1589) installs the seeded stream for every combat roll — formulas, procs, spawn placement, pool/tag/hidden-beast picks. Economy (loot/alchemy/pill) deliberately stays on `Math.random`; metrics exclude drops, so the scope boundary needs no change.
- **Consumed-step boundary, not emitted-step counting.** `getElapsedCombatSteps()` counts EMITTED batch steps — `advanceCombat` drops the rest of a batch the moment a step freezes/stops the clock (ops:404 comment), and one outer `advance()` can emit several steps. The harness therefore counts and samples on `turn_battle_entity_snapshot` — emitted exactly once per CONSUMED step across intro/countdown/fighting (ops:504/509/545) and carries `phase`. Two counters: `steps` = all consumed snapshots (lifecycle duration), `fightingSteps` = `phase === 'fighting'` only (combat duration — the DPS/TTK time base; intro+countdown are fixed presentation time, never balance signal). Uptime sampling runs per snapshot event, never per outer `advance()` call.
- **Detached build snapshot — manager state included.** A `PlayerData` alone is NOT a complete build: `pathCapabilityDeps.hasSkill` reads `skillManager.has()` membership (GameManager:867), kit resolution and `getScaledPassiveModifiers` read SkillSystem state, and `getTechniqueCombatModifiers` reads `techniqueManager.getEquipped()`. The simulation input is therefore a detached snapshot restored through the canonical M1 session-restore seams:
  ```ts
  interface SimBuildSnapshot {
    player: PlayerData        // structuredClone'd per run
    skills: Skill[]           // skillManager.restore(clone) per run
    techniques: Technique[]   // techniqueManager.restore(clone) per run
  }
  ```
  `restore()` already deep-clones its payload (SkillManager:28/TechniqueManager M1 boundary), and the harness additionally clones `player` so the caller's object is never mutated — a run writes path/way, mirrors `skillCastCounts`/`skillLevels`, and settles rewards/`completedStageIds` onto it. Non-PlayerData census: `BuffPersistence` is GameManager-scoped (constructed per GameManager, starts empty — sim inputs cannot carry it, recorded as a boundary note); Ngộ Đạo nodes (`player.nodeLevels`), formation (`formationLoadout`), companions (`companions`), and Pháp Tu state (`player.phapTu`) all live ON PlayerData.
- **Ritual selection is an optional PAIR.** `ritual?: { pathId: CultivationPathId; wayId: string }` — both fields required together; harness runs `chooseCultivationPath` for real when present, and asserts the snapshot's player is pre-ritual first (the ritual legitimately rejects an already-chosen player).
- **Encounter = discriminated union over real seams only.** There is no production multi-enemy raw seam — `startBattle`/`startBattleWithPlayer` take a SINGULAR `enemy`. So:
  ```ts
  type SimEncounter =
    | { kind: 'stage'; stageId: string }       // STAGES registry
    | { kind: 'customStage'; stage: Stage }    // in-memory authored stage via registerStages (multi-enemy goes here)
    | { kind: 'enemy'; enemy: Enemy }          // singular raw path (startBattleWithPlayer)
  ```
  Exactly one variant — no zero-or-multiple-source ambiguity.
- **Entity-id normalization.** `EnemySystem` mints spawn ids via `crypto.randomUUID()` — raw ids differ across same-seed runs. Metrics aggregate by ROLE key (`player` / `companion:<i>` / `enemy:<templateId>:<spawnOrdinal>`), never raw ids. The fingerprint hashes normalized aggregates only.
- **Uptime is measured by per-step sampling with a fighting-phase entity-active denominator**, not event pairing and not battle-wide steps: on each `turn_battle_entity_snapshot` where `phase === 'fighting'`, snapshot `getBattleBuffs(entityId)` for every live participant; uptime(entity, definitionId) = fighting-steps-with-instance / fighting-steps-entity-was-alive. A seal on an enemy spawned mid-fight can still report 100% lifetime coverage; intro/countdown are presentation prelude and never count. All per-minute rates (reactions, casts) use `combatDurationSeconds`. (A battle-wide side-uptime can be derived later if balance needs it — the per-entity form is the honest primitive.)
- **Wall-clock exclusion is part of the input contract.** Combat reads real time: `getLiveBattleModifiers` → `getActiveRuntimeModifiers(player, now = Date.now())` bare (PersistentEffectOps:145), and `setActivePlayer` → `tickTimedEffects` expires on `Date.now()`. Same seed + a timed effect near expiry → different builds by wall time. The harness therefore strips `persistentTimedEffects` from the cloned player (timed effects are wall-clock consumables, not deterministic build identity) and reports `timedEffectsStripped: n` in the result diagnostics — never silently dropped. Recorded as an architecture note; a deterministic `now` seam at `PersistentEffectOps` is a CONDITIONAL repair only if a later sim use-case requires buffed builds (P5 baselines do not).
- **FPS-independence is structural, then proven.** `CombatClock` quantizes to `COMBAT_STEP_SECONDS` (0.1s) with carry accumulation — the engine consumes integer steps, never wall time. The proof test drives the same seed with different advance chunk sizes (0.1 vs 0.033 vs 0.25) to terminal and asserts identical fingerprints.
- **Metrics vocabulary (all canonical surfaces, no new instrumentation):**
  - total damage + DPS + damage-by-source (+damageType): `damage` events (value / hpDamage / critical) grouped by role-normalized sourceId; DPS uses `combatDurationSeconds` (fighting-phase steps only — intro/countdown excluded)
  - time-to-kill: `fightingSteps` × 0.1s (combat TTK); lifecycle `steps` reported alongside
  - seal uptime: per-step sampling filtered to canonical seal ids + `elemental_application_committed` trace counts
  - reaction frequency: `reaction_resolved` (bus) + `reaction_skipped`, count + per-id breakdown + per-minute rate
  - buff/debuff uptime: same per-step sampling per definitionId per side
  - resource gen/spend — provenance by lane, never summed blindly: AUTHORED ops are authoritative via `trace.executions` (`gain_resource`/`consume_resource`/`apply_shield`) aggregated from `executions[].result.result?.applied` — the SETTLED amount nested inside the operation result (narrow `record.result.status === 'resolved'` + `type` first; the outer `result` is the CombatOperationResult union, the inner `.result` is the authority's `{before, requested, applied, after}`), not the requested payload (caps/drains can differ; mana costs via `consumeResourceFor` emit NO vitals event so the trace lane is their only surface). Vitals events only SUPPLEMENT movement not backed by authored ops — reasons `ward_spend`/`ward_grant` are op side-effects (excluded — already in the trace lane); counted: `regen` mp AND ward deltas (`applyTurnRegen` regenerates all three pools — ward leg included) plus `damage`-reason mp/ward deltas (mana-shield drain, ward absorbed by damage).
  - **absorption** (named precisely — full mitigation is a gap): `damage` event absorb fields vs value — `wardAbsorbed` ALREADY includes `externalWardAbsorbed` (ops:441 `wardAbsorbed = externalWardAbsorbed + nativeWardAbsorbed`), so absorption = wardAbsorbed + manaShieldAbsorbed; externalWardAbsorbed is reported as a breakdown field only, never added again. Armor/resistance/block reduction happens BEFORE `damage.value` and is not observable from the event — full mitigation is an M0 recorded gap, not silently claimed.
  - healing + overheal: actual healing = positive `hpAfter − hpBefore` on `entity_vitals_changed` for reasons `healing | leech | regen` (`heal` events cover only healing/leech — HP regen exists ONLY on the vitals lane). Overheal = `max(0, amount − hpDelta)` computed ONLY on `healing | leech` (`amount` is the pre-clamp request there); for `regen` the `amount` field is the post-clamp applied hp — regen overheal is unobservable → recorded as a narrow diagnostics gap. No production event change needed.
  - cast frequency: `attack` events grouped by `skillId`
  - deaths + outcome: `death`/`kill` events + terminal `battle.state` (timeout cap = explicit third outcome).
- **API shape:**
  ```ts
  interface BattleSimulationInput {
    seed: number
    build: SimBuildSnapshot                  // {player, skills, techniques} - cloned into fresh managers per run
    ritual?: { pathId: CultivationPathId; wayId: string }  // optional PAIR - real chooseCultivationPath; player must be pre-ritual
    encounter: SimEncounter                  // {kind:'stage'|stageId} | {kind:'customStage'|stage} | {kind:'enemy'|enemy}
    maxSteps?: number                        // consumed-step cap, default 5000 -> 'timeout' outcome
  }
  interface BattleSimulationResult {
    outcome: 'victory' | 'defeat' | 'timeout'
    steps: number                            // ALL consumed lifecycle steps (intro+countdown+fighting)
    durationSeconds: number                  // steps x 0.1
    fightingSteps: number                    // consumed steps where snapshot.phase === 'fighting'
    combatDurationSeconds: number            // fightingSteps x 0.1 - the DPS/TTK time base
    metrics: BattleMetrics
    fingerprint: string                      // FNV-1a over normalized digest
    diagnostics: { timedEffectsStripped: number; gaps: string[] }  // exclusions + recorded observability gaps
  }
  runBattle(input): BattleSimulationResult
  runBattles(inputs): readonly BattleSimulationResult[]   // fresh GameManager + cloned player per run
  ```
- **Fingerprint basis:** stable-stringified normalized digest (outcome, steps, fightingSteps, rounded per-role damage/heal/absorb totals, sorted reaction counts, sorted seal-uptime entries, sorted cast counts, deaths) → FNV-1a hex. Not the raw event stream (entity ids + eventIds are unseeded). Rounding: values fixed to 4 decimals pre-hash to avoid float-representation drift; the VALUES themselves are deterministic under the seeded RNG.
- **Batch:** `runBattles` maps inputs to results with a fresh `GameManager` per run — isolation by construction (P3 teardown audit already proves per-cycle freshness).
- **Non-determinism census (M0):** grep `Date.now`/`performance.now`/`Math.random`/`randomUUID` across the WHOLE combat dependency closure — `src/core/battle`, `src/core/combat`, `GameManagerTurnBattleOps`, `src/core/enemy`, `StageWaveSystem`, AND the state the build pulls: `GameManagerPersistentEffectOps` (timed-effect `Date.now` — the confirmed wall-clock leak), `Player` assembly, `SkillSystem`/`TechniqueSystem`, `BuffPersistence`, settlement/reward lanes. Classify each hit as combat-relevant (route through seeded stream / contract-excluded) or presentation/economy (excluded, recorded). Known: `randomUUID` spawn ids (normalized), economy rolls (out of scope by design), `turnBattleStartedAtMs` (presentation timing), `persistentTimedEffects` wall-clock reads (contract-stripped, diagnostic-counted).

## Mission P4-M0 — census + inventory doc

- [ ] **Step 1 — Event-to-metric map:** for each of the 12 spec metrics, record the concrete event(s)/surface it derives from (table above verified against source).
- [ ] **Step 2 — Non-determinism census:** the grep audit above; classify every hit.
- [ ] **Step 3 — Gap report:** observable-vs-spec gaps; each classified confirmed-gap / out-of-scope / clean. (Overheal resolved by derivation — vitals `amount` is the pre-clamp request.) Doc: `docs/architecture/2026-09-22-deterministic-simulation-inventory.md`.

## Mission P4-M1 — simulation harness

- [ ] **Step 1 — Tests first** (`src/core/simulation/BattleSimulation.test.ts`): runBattle returns victory for a known-strong build vs a weak encounter; defeat for weak vs strong; timeout respected; `ritual{pathId,wayId}` pair path works on a pre-ritual player and rejects a post-ritual one; `{kind:'customStage'}` (in-memory multi-enemy) and `{kind:'enemy'}` paths both work; result carries consumed-steps/duration/fingerprint/diagnostics; caller's `build` snapshot (player + skills + techniques arrays) is not mutated; `persistentTimedEffects` stripped + counted in diagnostics.
- [ ] **Step 2 — `BattleSimulation.ts`:** GameManager construction + catalog registration + clock/RNG install + snapshot restore (`skillManager.restore(clone(build.skills))`, `techniqueManager.restore(clone(build.techniques))`, `setActivePlayer(clone(build.player))` with `persistentTimedEffects` stripped) + drive loop (`advance(COMBAT_STEP_SECONDS)` until `battle.state` terminal or `maxSteps` CONSUMED steps — counted via `turn_battle_entity_snapshot`, not emitted-step reads) + result assembly. Role-normalization helper lives here (or its own leaf) — maps live entity ids to stable role keys at collect time.

## Mission P4-M2 — metrics collector

- [ ] **Step 1 — Tests first** (`src/core/simulation/BattleMetrics.test.ts`): a scripted micro-battle (weak player vs fast enemy or ngo_dao fixture) asserts each metric family is populated with correct semantics — damage sums match `damage` events, uptime fractions in [0,1] with entity-active denominators (a late-spawned entity's seal reports lifetime coverage, not battle-wide coverage), reaction counts match `reaction_resolved`, casts grouped by skillId, deaths counted, resource ledger by provenance lane (authored gain_resource/consume_resource/apply_shield aggregate `executions[].result.result?.applied` after status/type narrowing — settled not requested; vitals supplements only non-op movement — ward_spend/ward_grant excluded so ward ops never double-count; regen counts mp+ward; mana spend visible only via trace), ABSORPTION = wardAbsorbed + manaShieldAbsorbed without double-counting externalWard and full mitigation stays a recorded gap, healing totals include regen hp deltas while overheal = amount − hpDelta ONLY on `reason === 'healing' | 'leech'` (regen overheal unobservable → gap), `steps` counts all consumed phases while `fightingSteps`/DPS/TTK and uptime denominators use fighting-phase only (`snapshot.phase === 'fighting'`).
- [ ] **Step 2 — `BattleMetrics.ts`:** collector subscribing to `eventBus` during the run (detach on teardown — the harness owns unsubscribe) + per-snapshot `getBattleBuffs` sampler tracking per-entity observed-active steps + scheduler `trace.executions` scan for resource ops + aggregation into the normalized record.

## Mission P4-M3 — determinism + batch proofs

- [ ] **Step 1 — Same-seed determinism:** two `runBattle` calls, identical input → identical metrics objects AND identical fingerprints (deep-equal). Include the ngo_dao stage-1 build from P3 (seals+reactions exercised) and a plain-physical build.
- [ ] **Step 2 — FPS-independence:** same input driven with `advance(0.1)` vs `advance(0.033)` vs `advance(0.25)` chunking → identical fingerprints and identical consumed-step counts (snapshot-based). If a divergence surfaces, it is a CONFIRMED engine defect — stop and report, do not patch around it in the harness.
- [ ] **Step 3 — Seed sanity:** same input, different seed → fingerprint differs OR (if the battle is deterministic-inevitable, e.g. one-hit kill) the differing metrics are documented — assert at minimum that two distinct seeds produce distinguishable runs on a build with proc/crit variance.
- [ ] **Step 4 — Batch:** `runBattles` over ≥3 heterogeneous inputs → results independent (no cross-run state bleed — new GameManager each), order-stable, fingerprints match their solo `runBattle` counterparts.

## Mission P4-M4 — gates + docs

- [ ] `npm run verify` (full) green inside this worktree.
- [ ] P18 OCR over the P4 delta; P4 adversarial QA (quick); 3 sequential review passes; external review loop to IMPLEMENT-READY.
- [ ] Docs: `docs/systems/combat-overview.md` (or new `combat-simulation.md`) gains the harness map: input surface, metric provenance, normalization rules, determinism guarantees, known-excluded randomness (economy/spawn ids). Inventory doc finalized.

## Boundaries

- No new combat content (no new skills/enemies/stages) — the spec forbids content expansion in P1–P4.
- No combat-rule changes. The harness consumes canonical seams; any discovered engine non-determinism is a defect to REPORT (and fix via canonical owner only if confirmed), never hidden by harness-side normalization beyond the declared entity-id mapping.
- Harness is headless tooling — it must not be imported by presentation/UI code, and nothing on the gameplay path may depend on it (same class of boundary as `CombatTraceExporter`).
- Metrics exclude loot/economy rolls by design (documented RNG scope boundary).
- `runBattle` caps at `maxSteps` and reports `timeout` — never an unbounded loop.

## Implementation amendments (post-review, shipped state)

External implementation review corrected four plan-era contracts; the
shipped harness differs from the M1/M2 text above as follows:

1. **Phase attribution (post-impl HIGH):** the snapshot's `phase` is
   POST-step state — a transition step (intro→countdown,
   countdown→fighting, fighting→terminal) was consumed under the prior
   phase. `fightingSteps`/uptime now use pre-step attribution via the
   collector's `lastPhase` chain; `metrics.phaseSteps` exposes the
   per-phase breakdown. Oracle: `phaseSteps.countdown ===
   COUNTDOWN_TOTAL_TICKS`, `phaseSteps.victory === 0` (the lethal step
   lands under `fighting`).
2. **maxSteps hard cap (post-impl MEDIUM):** fed time per iteration is
   clamped to `remaining * COMBAT_STEP_SECONDS` — a coarse
   `advanceChunkSeconds` (e.g. 0.25) can consume several steps per call
   and would otherwise overshoot. Result counters are captured BEFORE
   `abandonBattle()` teardown.
3. **Resource lanes inverted (post-impl self-review + review fix):**
   ward is VITALS-COMPLETE — every ward mutator emits
   (`ward_spend`/`ward_grant`, `damage` before-snapshot drains, `regen`),
   covering authored ops AND engine-lane spends (consume-ward burst has
   no trace record). The trace lane therefore owns ONLY raw-write pools
   (`mana` via `consumeResourceFor`, `the` via `currentThe`); counting
   ward/`apply_shield` there would double-count. Applied-vs-requested is
   locked by a capped-gain oracle (`gain the 150 → applied 100` under
   `MAX_THE`).
4. **Cast-cost is NOT a gap:** production routed casts map `plan.cost`
   → `consume_resource` ops via `routeCast`/`commitShell` — the trace
   sees them. `commitAction → consumeResourceFor` runs only on the
   engine-unit lane (`runtime === undefined`), not the GameManager
   production path. The `cast_resource_cost_unobservable` diagnostic was
   removed.
