# R1 — Combat / Vitals Authority Closure — QA Quick Report

Date: 2026-09-08
Worktree: E:/tutienidle/.agent-worktrees/r1-combat-vitals-authority
Branch: feat/r1-combat-vitals-authority
Mission: R1 (roadmap 0.6) based on Mission 0 finding AR-01.

## Contract evidence (P17 requirement)

The maintained combat reference
`docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md` is absent
(2026-09-08), so the contract below was established from production consumers
and tests before changing turn-side behavior:

- `CombatSystem` is the damage/death authority:
  `applyDirectDamage` → `EntityVitalsSystem.applyDamage` (mutation + vitals
  event) → `killIfDead` (survive-lethal guard, exactly-once death via
  `entity.alive`, `death` + `kill` events, kill triggers).
- `EntityVitalsSystem` owns HP/MP/Ward mutation and emits
  `entity_vitals_changed`; `CombatScene.onVitalsChanged` reads only
  `hpAfter/maxHp` (no reason branching), so new events are presentation-safe.
- `TurnBattleSystem` is the orchestrator: it sequences operations and
  consumes results; it must not write entity vitals fields directly.
- Intended behavior (characterized from
  `TurnBattleSystem.consumeDamage.test.ts` + A3 roadmap entry):
  consumption bonus is true damage applied after the normal hit, then the
  consumed state (ailment stacks / ward) is cleared. The previous raw
  `currentHp`/`currentWard` writes were the observed defect (AR-01), not an
  intentional bypass of death/survival.

## Changes

- `EntityVitalsSystem`: new `spendWard()` (authoritative ward mutation,
  emits vitals event); new reason `'ward_spend'`.
- `CombatSystem`: new typed wrapper `spendWard()`.
- `TurnBattleSystem`: migrated 3 direct-write paths to authorities:
  1. turn-start `hpRegenPerTurn` → `combat.applyHealing(..., 'regen')`
     (full-HP guard added to avoid a no-op event every turn; heal floating
     text is 'healing'/'leech' only, so no HUD spam);
  2. ailment consumption bonus → `combat.applyDirectDamage(...)` (death,
     survive-lethal, events now included);
  3. ward consumption bonus → `combat.applyDirectDamage(...)` +
     `combat.spendWard(..., 'ward_spend', ...)`.

## Explicitly out of scope (audit section 20 + scan evidence)

Remaining vitals-field writers were enumerated (grep across `game/src`):
- `EntityVitalsSystem` (the authority itself), `CombatSystem.killIfDead`
  HP=1 survive branch (authority-internal) — legitimate.
- `TurnSkillAction.ts:95` mana expenditure and `CombatSystem` internal
  MP/Ward absorption at resolveAttack — explicitly out of scope for R1
  (audit section 20).
- `SkillEffectSystem.ts:245`, `SkillActionRegistry.ts:218` ward spends and
  `ArtifactSystem.ts:251/328` ward grants — resource-spending/grant paths
  outside the turn engine boundary (legacy-adjacent skill infra); recorded
  as retained debt for a later vitals-closure pass.
- `TribulationDirector` ghost `currentHp` restores — snapshot semantics,
  AR-12 territory.
- All other matches are test fixtures.

## TDD evidence

- RED: 4 new regression tests failed against the unpatched engine with the
  exact AR-01 counterexample shape (HP 0 + alive true; 0 death events;
  survive guard not intercepted; no ward-spend observation).
- GREEN: after the authority migration, 6/6 pass in
  `TurnBattleSystem.consumeDamage.test.ts`.

## Verification

- P3 full: type-check PASS; build PASS; Vitest 413 files / 2845 tests PASS
  (baseline 2841 + 4 new regression tests).
- P5 code review: PASS (1 diff-noise finding fixed; no behavioral findings
  at confidence >= 80).

## QA probes (this pass)

- Lethal ward-consumption bonus: HP 0 → alive false, exactly one death
  event, battle state `victory`. PASS.
- Lethal ailment-consumption bonus: same completion through the same
  authority. PASS.
- Survive-lethal guard (`bat_tu_the` authored talent) intercepts lethal
  consumption: HP 1, alive stays true. PASS.
- Ward spend observation parity: one `entity_vitals_changed` with
  `reason 'ward_spend'`, wardBefore 20 → wardAfter 0. PASS.
- Consumer consistency: full `BattleLootSystem` + `turn` suites (46 files /
  325 tests) PASS — reward/death consumers agree with the migrated path.

## Runtime / wiring evidence (P13)

GameManager battle-tick integration was not modified; the migrated paths
are the same call sites the engine already drove through
`GameManager.update()` → `TurnBattleSystem.resolveNextStep()`. Full-suite
coverage includes the battle-loop and reward integration specs. Per P14
isolated-worktree exception, live-browser verification is deferred to the
authorized main checkout during branch finishing; this mission does not
touch presentation or wiring-critical app-shell code.

## Suspected / coverage gaps (not confirmed defects)

- Regeneration when `currentHp` is already full previously wrote silently;
  it now skips the no-op event. No consumer branched on this event shape
  (checked CombatScene/TribulationScene handlers), classified as intended
  cleanup rather than behavior change.
- DoT source context omission (AR-06) and hit-result consumption (AR-04)
  remain open — separate missions (R2/R3 chain), untouched here.

## Verdict

**PASS WITH EVIDENCE**
