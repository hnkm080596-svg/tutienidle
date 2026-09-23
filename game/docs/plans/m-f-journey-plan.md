# M-F-JOURNEY — Trúc Cơ End-to-End Journey + Integration Sweep — Plan

Spec: `game/docs/specs/m-f-journey-spec.md` (v1 — pending C2C spec
review). Delivers the committed headless journey suite
(`TrucCoJourney.test.ts`), the integration-sweep notes doc, the
roadmap/mission-graph docs sync, and the final save-version decision.
Scope limits per mandate: test/docs-only; session seams inside
`EarlyGameSession.ts` are the only permitted non-doc edits; zero
production behavior change.

Phase 1 delivered docs only. Phase 2 begins only after BOTH
coordinator gates: (a) C2C spec + plan reviews pass, (b) coordinator
confirms ALL sibling M-F missions merged (ARTIFACT-DEFER,
BODY-PERFECTION, BODY-HIDDEN pending at spec time). Phase 2 opens
with a rebase onto fresh `origin/p7/truc-co`; the spec's conditional
assertions (artifact unlock realm, any landed body-perfection /
hidden-body surface) are re-derived against the post-merge state
before any test is written — the rebase diff against this plan's seam
census is itself a checkpoint: if a sibling moved a seam the spec
named, the plan is amended first.

## Step 0 — seam census (done during spec)

- `core/simulation/earlygame/EarlyGameSession.ts` — harness gains:
  `playerOwner` constructor option (`this.player = owner.$state` —
  the suite owns a real `usePlayerStore`; the harness file keeps its
  no-`stores/*` rule), `settleTribulationOutcome()` (settleOutcome →
  entitlement-drain check → `director.clear()`), generalized
  `investChapter(chapterId)` (existing `investRefinement` delegates,
  signature unchanged for current callers), `pillAmount`/`holdPill`/
  `holdMaterial` bag seams, `giftRecords`/`claimGift`, `perfectClearOf`/
  `startAutoFarm`, and a `snapshot()` extension covering the TC fields
  (bodyProgression summary, physiqueGrade, highestFoundationAchieved,
  artifact, companionGifts, pendingTalentEntitlement, technique
  grade/rank/history keys). `runTribulation` unchanged — its
  `canTriggerBreakthrough` precheck already mirrors the production
  entry (`triggerBreakthroughAction`).
- `core/simulation/earlygame/TrucCoJourney.test.ts` (new) — legs A–J
  per spec §3. Reuses the M-C suite's conventions: pinned creation
  profile, `grindToLevel`-style helpers (local or factored — decided
  at impl, no shared-test-lib refactor), `vi.useFakeTimers` +
  `setSystemTime` for the checkpoint leg, seeded-fixture convention
  from `TribulationOutcomeSettlement.test.ts` for Leg A / grade legs.
- `docs/p7/missions/mf-journey.notes.md` (new) — M8-format notes:
  task card, save-version decision block, dead-authority table, docs
  sync list, gates.
- `docs/roadmap.md` — append post-P7 wave ledgers (M-QI + M-F).
- `docs/p7/mission-graph.md` — M-QI-11/12 status rows + M-F wave
  ledger section.
- `docs/naming-conventions.md`, `docs/p7/naming-migration.md` —
  amended only if the sweep confirms a family gap.
- No production file is edited. If implementation finds the harness
  cannot express a leg without a production hook, that is a blocking
  finding for the coordinator — not a license to add one.

## Step 1 — session-seam additions (tests-first where they gate)

1. Extend `EarlyGameSession.test.ts` (or a focused harness test beside
   it) with seam pins before building the journey: `playerOwner`
   construction (player identity is the owner state from creation),
   `settleTribulationOutcome` on a committed mortal→LQ victory is a
   settled no-op shape (`qi_refining` early-return) — proves the seam
   before TC exercises it — plus `holdPill`/`holdMaterial`/`investChapter`
   unit pins.
2. Implement the seams per spec §4 — mirrors only; every seam's
   docstring names the production site it mirrors.

## Step 2 — journey suite legs

Order the suite build bottom-up so each leg's helpers exist before
the legs that need them:

1. **Leg A fixtures + admission**: seeded LQ-side state builder
   (enumerated fields: realmId/realmLevel/completedStageIds chain/
   baseStats; plus optional carryover: technique, nodes, refinement
   tiers per leg need); admission asserts
   (`getBreakthroughRequirements` rows flip met/locked correctly).
2. **Leg B tribulation + initiation**: `runTribulation` victory →
   committed-outcome asserts → `settleTribulationOutcome` → post-state
   bundle → `resolveTalentEntitlement` → gift claim. Assert
   double-settle idempotency.
3. **Leg C realm ladder** to L18 (or the level each leg needs —
   Tiểu needs ≥9; the suite climbs once and asserts gates along the
   way).
4. **Leg D body chapters** in authored order with seeded/farmed input
   mix per spec §4.
5. **Leg E stage chain** — floor-1 victory → locked-floor assert →
   growth-cycle recovery → floor-10 boss victory.
6. **Leg F ceiling boundary**.
7. **Leg G checkpoint restore** — mid-TC `buildGameSave` → fresh
   session + fresh owner → parity sweep + post-restore `runStage` +
   the coherence-rejection boundary case.
8. **Leg H adversarial rejects** — all state-unchanged.
9. **Leg I perfection surfaces** — perfect-clear + auto-farm unlock +
   grade-ladder fixture legs.
10. **Leg J determinism** — two seeded runs → identical snapshots.

Timing watch: LQ→TC tribulation drives ~40 simulated seconds of tank
chapters at `tickOps.update(1)` granularity plus battle drives at
0.1s combat steps — bounded by `MAX_TRIBULATION_TICKS`/`MAX_DRIVE_STEPS`;
generous vitest timeouts on heavy legs (60s+, matching existing).

## Step 3 — integration sweep

Run the spec §5 audit program over the merged base; record the
results table in `mf-journey.notes.md`. For every row: verdict
(clean / expected-deferral / finding), evidence (grep/test/log ref),
classification (in-mission fix vs pre-existing report vs authored
blank). **No fixes beyond in-mission defects.**

## Step 4 — docs sync + save-version decision

- `roadmap.md`: append the M-QI ledger (M-QI-01..10 merged w/ commit
  refs; M-QI-11/12 status) and the Trúc Cơ wave section (each landed
  M-F mission: commit, save version, gate summary — in P7 ledger
  style). Keep it a ledger — don't restate spec prose.
- `mission-graph.md`: M-F wave table + M-QI-11/12 rows; M-QI-12's row
  carries the coordinator's disposition (subsumption note pending C2C).
- `naming-conventions.md`/`naming-migration.md`: amend only on a
  confirmed gap (record "no amendment needed" explicitly otherwise).
- `mf-journey.notes.md`: save-version decision block — CURRENT value
  on the merged base at implementation start, per-bump coverage table
  (v72..v78 + any pending-sibling bumps), verdict + rule citation.

## Step 5 — gates

- E3 simplify pass over the diff (suite file included — journeys rot
  on duplication; helpers over copy-paste legs).
- P3 **full** — `cd game && npm run verify` (final-mission gate per
  mandate; also re-run after every P5-pass fix).
- P18 OCR delegation over the diff.
- P4 adversarial QA quick — scope: the suite's honesty (seeded-input
  boundary, seam fidelity) + the sweep's completeness; escalate to
  deep on quick-flagged breadth.
- P5 sequential ≥3 passes, per-pass evidence blocks; pass 2 reviews
  the sweep report itself (authority audit self-check).
- P15 ASCII scan on new comments/doc text I add.
- Commit + push + PR base `p7/truc-co`. Report to coordinator:
  branch, files, per-gate evidence, limitations, sweep findings table.

## Risks / watch

- **Tribulation survival realism**: the body/lightning tanks damage
  REAL maxHp — the seeded LQ profile must carry enough maxHp/defense
  to survive the authored profile at the run's grade (the committed
  suite seeds 5M/50k for exactly this). If the honest-stat band can't
  survive, that's a balance finding, not a fix.
- **Fixture honesty creep**: the seeded-input list is a boundary —
  anything found mid-impl that needs seeding BEYOND it goes to the
  spec/C2C, not quietly into the fixture.
- **Pending-sibling drift**: rebase may move seams this plan names
  (artifact realm, body chapters 4-5 surfaces, respec cost shape).
  Re-derive conditional legs first; amend the plan if the census
  changed.
- **Suite runtime**: full TC floor chain + tribulation + grind in one
  file — keep legs independent sessions where they don't share
  narrative (grade ladder already is); watch vitest wall-clock.
- **Snapshot parity scope**: `snapshot()` extension must stay
  normalized-deterministic (no timestamps/ids) — extend the field
  list, not the volatility.

## Per-delta acceptance map

| Delta | Spec § | Plan step | Acceptance |
|---|---|---|---|
| Harness seams (owner, settle, invest, bags, gifts, farm, snapshot) | §4 | 1 | A1, A2, A6 |
| Legs A–B (admission → breakthrough → initiation) | §3 A-B | 2.1-2.2 | A2, A5(partial) |
| Legs C–D (realm levels, body chapters) | §3 C-D | 2.3-2.4 | A3 |
| Legs E–F (stage chain, ceiling) | §3 E-F | 2.5-2.6 | A4, A5 |
| Leg G (save/restore) | §3 G | 2.7 | A6 |
| Legs H–J (rejects, perfection, determinism) | §3 H-J | 2.8-2.10 | A4, A7 |
| Integration sweep notes | §5 | 3 | A8, A12 |
| Docs sync | §6 | 4 | A9 |
| Save-version decision | §7 | 4 | A10 |
| Gates | §8 | 5 | A11 |
