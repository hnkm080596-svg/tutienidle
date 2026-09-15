# QA Review: phap-tu review-fixes (HIGH-1/2, MED-3/4 + integration test)

- Date: 2026-09-15
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/src/data/skill/TurnAnKitSkills.ts`
  - `game/src/core/game/GameManager.ts` (resolveAnElementBasicPool + An kit wiring)
  - `game/src/core/progression/NodeSystem.ts` (switchRoute + previewRouteSwitch gates)
  - `game/src/core/game/GameManagerProgressionOps.ts` (switchRoute op guard)
  - `game/src/core/phap-tu/PhapTuRoutes.ts` (getRouteStatModifiers path gate)
  - `game/src/core/battle/turn/TurnBattleSystem.ts` (participant capability flag + initiation gate)
  - `game/src/core/game/TurnBattleAdapter.ts` (capability stamping)
  - `game/src/core/battle/turn/TurnReactionManager.ts` (Cong Minh generic potency)
  - `game/src/core/buff/BuffSystem.ts` (scaleBuffPotency primitive)
  - test files: `NodeSystem.route.test.ts`, `PhapTuRoutes.test.ts`, `TurnReactionManager.rules.test.ts`, `TurnBuffIdentity.test.ts`, `TurnBattleAdapter.test.ts`, `TurnBattleSystem.test.ts`, `TurnBattleSystem.detonate.test.ts`, `GameManager.phapTuAnPath.test.ts`

## Scope and Risk Map

Changed-risk mapper: domains combat-and-tribulation, economy-and-progression, pinia-phaser-sync, time-and-offline; `deepAuditCandidate: true` (4 domains, time-and-offline boundary). **Escalation decision: not escalated** — the flag is produced by whole-file mapping of `GameManager.ts`; the actual changed lines are four bounded edits (a read-only pool derivation, two guard clauses, one participant flag + one gate read, one pure scaling function + one call site). No save/cloud, clock, offline, or Vue/Pinia/Phaser lifecycle transition is touched by the diff. All four findings were reproduced failing-first, then verified green.

## Invariant Ledger

| ID | State/owner | Transition | Invariant | Attack operator | Observable oracle | Result |
| --- | --- | --- | --- | --- | --- | --- |
| QA-R1 | An element pool — `GameManager.resolveAnElementBasicPool` | battle build for phap_tu_an | Single authority: pool = canonical authored conversion | Value mutation (authored doc_chuong is ailment-only) | `pool[wood].damage === undefined`, `trung_doc` ailment present, authored `manaScalingRatio`/`attributeScaling` survive | **Resolved** — `GameManager.phapTuAnPath.test.ts` |
| QA-R2 | `phapTu.route` — `NodeSystem.switchRoute` + ops | route switch pre-commit / wrong path | Atomicity + ownership: only committed `phap_tu` route can switch | Reorder (write route before element commit) | rejection, `phapTu` unchanged at both layers | **Resolved** — `NodeSystem.route.test.ts` |
| QA-R3 | route stat modifiers — `getRouteStatModifiers` | aggregation for a non-phap_tu player holding dirty route state | Domain containment of universal stats | Stale state (`phap_tu_an` + committed `phapTu.route`) | no `phap_tu_route_*` mods in menu/battle-base aggregators | **Resolved** — `PhapTuRoutes.test.ts` |
| QA-R4 | reaction initiation — `TurnBattleParticipant.canInitiateWuxingReactions` | ailment application by companion / non-phap_tu participant | Capability = phap_tu-domain ownership, not party side | Cross-system (enemy incumbent + unflagged player-side actor) | 0 reaction events, ailment still lands; adapter stamps true for phap_tu/phap_tu_an only | **Resolved** — `TurnReactionManager.rules.test.ts`, `TurnBattleAdapter.test.ts`, `TurnBuffIdentity.test.ts` |
| QA-R5 | Cong Minh child — `TurnReactionManager` + `scaleBuffPotency` | sinh pair with non-DoT child | Potency = every numeric magnitude carrier | Value mutation (thach_hoa statModifier + onHitProc) | percent -0.3→-0.45, chance 0.5→0.75, remainingTurns ×1.5 | **Resolved** — `TurnReactionManager.rules.test.ts` |
| QA-R6 | refresh/stack re-application + Cong Minh | repeated sinh applications on the SAME buff instance | Boundedness | Repeat operator | instance `effects` compound ×1.5 per application event | **Suspected** — see Finding QA-2026-09-15-R1 (pre-existing semantic, widened surface) |
| QA-R7 | `PHAP_TU_BASICS` fallback table | converter rejection on normal phap_tu basic | Degraded-mode fidelity to authored data | Coverage: fallback wood still carries phantom damage | unreachable while canonical conversion succeeds | **Coverage gap** — noted, not in repair scope |
| QA-R8 | `canInitiateWuxingReactions` persistence | save/reload mid-battle | N/A — battle state is not persisted; flag is rebuilt via adapter at next build | Interruption | — | Resolved by inspection |
| QA-R9 | `resolveAnElementBasicPool` template stability | repeated battle builds | Determinism | Repeat | `skillTemplates.get` returns read-only template; `getEffectiveSkill` never mutates | Resolved by inspection |
| QA-R10 | proc-chance magnitude carriers | Cong Minh amp on chance ≥ 2/3 | Boundedness | Value mutation | `scaleBuffPotency` clamps `onHitProc`/`reactiveTrigger` chance at 1 | Resolved — clamp in primitive (no dedicated test; covered by the Thach Hoa assertion) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | `vue-tsc --build`, 0 errors |
| `npm run build` | clean | chunk-size warnings only |
| `npx vitest run` (full) | 558 files / 4203 tests pass, 4 expected-fail | worktree run; gitignored `tests/lab/local/` scratch absent here (main-checkout-only failures, pre-existing) |
| Scoped re-run (10 files, all touched areas) | 155 tests pass | NodeSystem.route, PhapTuRoutes, reaction rules, buff identity, adapter, detonate, anKit, phapTuAnPath, TurnBattleSystem |

## Findings

### QA-2026-09-15-R1: Cong Minh potency compounds on refresh/stack re-application of the same child instance

- Severity: Medium
- Status: Suspected (pre-existing semantic, surface widened by this fix)
- Invariant: Boundedness
- Preconditions: a flagged (phap_tu-domain) actor re-applies an ailment whose element is the sinh CHILD of a coexisting incumbent — e.g. repeated earth casts while a fire incumbent lives on the target.
- Reproduction: apply `bong` then `thach_hoa` twice through `checkAndTrigger` — each application event amps the SAME live instance (refresh/stack modes keep `existing.effects`; only `remainingTurns` resets).
- Expected (design question): whether each Cong Minh event should re-amp the already-amped instance or re-derive from base is not pinned by spec.
- Actual: `statModifier` percent/flat and DoT tick fields compound ×(1+CONG_MINH_AMP) per event; proc `chance` is clamped at 1; duration does NOT compound (refresh resets to authored duration before the ×1.5).
- Evidence: code inspection — `BuffSystem.handleExisting` refresh/stack branches never rebuild `effects`; the pre-existing DoT-only amp compounded identically, so this is not a regression introduced by the fix — the review-requested generic scaling extends the same semantic to more carriers. Mathematically unbounded (percent/flat), practically saturating (evasion floors at 0, chance clamps at 1).
- Test file: none (classification is Suspected; writing a failing test would require first deciding the intended semantics)
- Owner subsystem: `TurnReactionManager` / buff-domain
- Blast radius: phap_tu_an multicast storms and any future multi-element phap_tu content; normal phap_tu reaches it only via foreign incumbents (enemy self-debuffs). Flag for the CONG_MINH_AMP balance pass.

### QA-2026-09-15-R2: `PHAP_TU_BASICS` fallback still drifts from authored basics

- Severity: Low
- Status: Coverage gap
- Invariant: Single authority (degraded path)
- Preconditions: `toTurnSkillDefinition` throws for a normal `phap_tu` basic — the `catch` in `GameManager.resolvePlayerBasicAttack` falls back to `BASIC_ATTACKS_BY_BUILD['phap_tu_wood']`, whose wood entry still carries an `elemental×1` hit that authored `doc_chuong` does not have.
- Expected: a fallback should mirror authored semantics as closely as the static shape allows.
- Actual: fallback would silently deal direct damage on wood (and drops authored scaling on the other four entries).
- Evidence: code inspection — `TurnBasicAttacks.ts:31` unchanged; unreachable while conversion succeeds. Recorded rather than repaired: the fallback's purpose is graceful degradation and normal-path conversion has not been observed to fail.
- Test file: none
- Owner subsystem: `GameManager.resolvePlayerBasicAttack` fallback seam
- Blast radius: degraded-mode only.

## New or Changed QA Tests

- `GameManager.phapTuAnPath.test.ts` — HIGH-1 pool assertions (wood no-damage + authored scaling) and the `chooseCultivationPath('phap_tu_an') → startStage → resolved actions` lifecycle test that previously existed only as a browser reproduction.
- `NodeSystem.route.test.ts` — domain + ops rejection for uncommitted/non-phap_tu route switches; all route fixtures now carry `cultivationPath` honestly.
- `PhapTuRoutes.test.ts` — route stat modifiers gated on `cultivationPath === 'phap_tu'`.
- `TurnReactionManager.rules.test.ts` — unflagged player-side participant never initiates; flagged player vs enemy-origin incumbent resolves normally; Cong Minh non-DoT potency (Thach Hoa).
- `TurnBuffIdentity.test.ts` — ARCH-009 rewritten so the flagged player initiates while the unflagged companion's application lands inert (covers the new gate AND multi-source consume).
- `TurnBattleAdapter.test.ts` — capability stamped for phap_tu + phap_tu_an, denied for kiem_tu/no-buildId.
- `TurnBattleSystem.test.ts`, `TurnBattleSystem.detonate.test.ts` — existing phap_tu fixtures flagged to model real participants.

## Gaps and Residual Risk

1. QA-2026-09-15-R1 (compounding) is a design-semantics question for the balance pass — spec pins "potency + duration amp" but not whether repeat application events re-amp the same instance. Chance clamp bounds probabilities; percent/flat magnitudes are unbounded in principle, saturated in practice.
2. QA-2026-09-15-R2 fallback drift noted above.
3. P14 browser pass on the review fixes themselves was not re-run (the earlier live-browser verification of the An path still stands; these changes are guard/derivation-layer). The new `startStage` integration test covers the chain headlessly that the browser pass originally exposed.

## Pre-existing Failures

- 4 expected-fail tests (pre-date this work).
- `tests/lab/local/*` gitignored scratch failures exist only in the main checkout (stale `getSkillRuntimeStats` API usage), not in this worktree.
