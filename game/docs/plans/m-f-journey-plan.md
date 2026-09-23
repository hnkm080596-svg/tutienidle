# M-F-JOURNEY — Trúc Cơ End-to-End Journey + Integration Sweep — Plan

Spec: `game/docs/specs/m-f-journey-spec.md` — **v-final** (C2C spec
verify r92: PASSED — legs A–L, two-phase settle/drain seams, explicit
leg order, expansion gate). Delivers the committed headless journey
suite (`TrucCoJourney.test.ts`), the integration-sweep notes doc, the
roadmap/mission-graph docs sync, and the final save-version decision.
Scope limits per mandate: test/docs-only; session seams inside
`EarlyGameSession.ts` are the only permitted non-doc edits; zero
production behavior change.

Phase 2 begins only after BOTH coordinator gates: (a) this plan's C2C
review passes, (b) coordinator confirms ALL sibling M-F missions
merged — at plan time only **M-F-BODY-HIDDEN** remains outstanding
(spec legs K/L key on landed shapes: K's negative/structural leg is
mandatory regardless; L resolves per expansion gate A13). Phase 2
opens with a rebase onto fresh `origin/p7/truc-co`, then **Step 0b —
conditional expansion** (spec A13): every `(conditional)` marker
resolves into a concrete assertion or a named expected-deferral row
BEFORE any test is written — zero bare conditionals remain; the
rebase diff against this plan's seam census is itself a checkpoint:
if a sibling moved a seam the spec named, the plan is amended first.

## Step 0 — seam census (done during spec + r-series amendments)

- `core/simulation/earlygame/EarlyGameSession.ts` — harness gains:
  `playerOwner` constructor option (`this.player = owner.$state` —
  the suite owns a real `usePlayerStore`; the harness file keeps its
  no-`stores/*` rule), `settleTribulationOutcome()` (settleOutcome
  only — binds/applies ONCE, returns the bound receipt, NO drain;
  repeated pre-resolution calls are idempotent),
  `drainTribulationOutcome()` (mirrors the reconcile→deferred-drain
  half: `reconcileTalentEntitlement` → hold while
  `pendingTalentEntitlement` unresolved → `director.clear()` only
  post-resolution), `resolveTalentEntitlement(decision)`, generalized
  `investChapter(chapterId)` (existing `investRefinement` delegates —
  signature unchanged for current callers), `pillAmount`/`holdPill`/
  `holdMaterial` bag seams, `giftRecords`/`claimGift`,
  `perfectClearOf`/`startAutoFarm`, and a `snapshot()` extension
  covering the TC fields + pending-sibling persisted fields
  (`bodyPerfection.*`, artifact, hidden-material per landed shapes).
  `runTribulation` unchanged — its `canTriggerBreakthrough` precheck
  already mirrors the production entry (`triggerBreakthroughAction`).
- `core/simulation/earlygame/TrucCoJourney.test.ts` (new) — legs A–L
  per spec §3 in the pinned order: A → B → E.1 → D.1+D.2 → C+E.2
  interleaved (G's checkpoint inside at TC L9 / circulation 180 /
  floors 1–9, journey continues on the restored session) → F → I →
  J → K → L; D.3 + H are aggregation sections (H's rejections execute
  inline where each precondition exists — no separate pass).
- `docs/p7/missions/mf-journey.notes.md` (new) — M8-format notes:
  task card, save-version decision block, dead-authority table, docs
  sync list, gates.
- `docs/roadmap.md` — append post-P7 wave ledgers (M-QI + M-F).
- `docs/p7/mission-graph.md` — M-QI-11/12 status rows + M-F wave
  ledger section (M-QI-12 row carries the coordinator's disposition).
- `docs/naming-conventions.md`, `docs/p7/naming-migration.md` —
  amended only if the sweep confirms a family gap.
- No production file is edited. If implementation finds the harness
  cannot express a leg without a production hook, that is a blocking
  finding for the coordinator — not a license to add one.

## Step 1 — session-seam additions (tests-first where they gate)

1. Extend `EarlyGameSession.test.ts` (or a focused harness test beside
   it) with seam pins before building the journey: `playerOwner`
   construction (player identity is the owner state from creation);
   `settleTribulationOutcome` on a committed mortal→LQ victory is a
   settled no-op shape (`qi_refining` early-return) AND the drain seam
   holds correctly; `holdPill`/`holdMaterial`/`investChapter` unit
   pins.
2. Implement the seams per spec §4 — mirrors only; every seam's
   docstring names the production site it mirrors. The settle/drain
   split follows `checkTribulationOutcomeAction`'s domain half
   exactly: settle binds once; reconcile+defer; clear only after the
   entitlement resolves.

## Step 2 — journey suite legs (spec-ordered)

Build bottom-up so each leg's helpers exist before the legs that need
them; the RUN order is the spec's pinned order.

1. **Leg A fixtures + admission**: seeded LQ-side state builder
   (enumerated fields: realmId/realmLevel/completedStageIds chain/
   baseStats; optional carryover: technique, nodes, refinement tiers
   per leg need); admission asserts (`getBreakthroughRequirements`
   rows flip met/locked correctly; pre-met `runTribulation` refuses —
   H-map item); pre-TC zhou_tian capacity-0 rejection asserted here.
2. **Leg B tribulation + initiation**: `runTribulation` victory →
   committed-outcome asserts → **phase (a)** repeated
   `settleTribulationOutcome` idempotent + `drainTribulationOutcome`
   HOLDS + illegal-entitlement reject (H-map item) → **phase (b)**
   legal `resolveTalentEntitlement` → drain executes → gift claim →
   full initiation bundle asserts.
3. **Leg E.1**: floor-1 first clear at TC L1 + unlock observation —
   E owns all first-clear asserts.
4. **Legs D.1 + D.2** at TC L1 — each reject owned by the state in
   which its precondition exists (C2C-r93-M):
   a. body_refinement completion (authority split — collector-channel
      deltas asserted, intrinsic `baseStats` byte-unchanged) →
      physique flip;
   b. **immediately before the final refinement tier commits**:
      `investBodyChapter('meridian')` → 0, no pill/material debit
      (bags unchanged — the meridian reject's precondition exists
      only while refinement is INcomplete);
   c. **after refinement commits but before opening the first
      meridian**: `investBodyChapter('zhou_tian')` → 0, no Pháp
      essence debit (the zhou_tian reject's precondition exists only
      while meridian is INcomplete);
   d. then D.2: meridian strict-prefix 9/9 with `bat-mach:*` on the
      modifier channel only.
   Both rejects are ownership-mapped in H (see 2.12).
5. **Legs C + E.2 interleaved**: the level/zhou_tian ladder — per-level
   capacity assert + circulation resume to new cap; pinned
   observations: ≥1 below-cap clamp (L1 vs 20), L8→L9 Tiểu (180),
   L17→L18 Đại (360); exact-Pháp-debit proof; floors 2→N clear as
   realmLevel reaches N with `locked` asserts ahead of each gate;
   honest Pháp farming rides the already-cleared floor_1.
6. **Leg G checkpoint INSIDE the interleave**: at TC L9 / circulation
   180 / floors 1–9 cleared / gift claimed / entitlement resolved →
   **wall-clock freeze pinned (C2C-r94-2): `Date.now` mocked/pinned
   (`vi.setSystemTime`) BEFORE `buildGameSave` and kept frozen
   through the restore + every parity assertion — an elapsed-offline
   settlement window would make parity nondeterministic; the clock
   is restored only after all asserts pass** → `buildGameSave` →
   restore onto a SECOND session + fresh owner via
   `restoreCheckpoint` → persisted-field parity sweep (journey fields
   + pending-sibling fields per A13) → **ordered journey CONTINUES on
   the restored session**: L10 → floor_10 boss → ladder to L18 →
   circulation 360/Đại. Boundary case: incoherent save
   (`{zhou_tian progressed, meridian incomplete}`) rejected at
   preflight.
7. **Leg F ceiling boundary**: `getBreakthroughRequirements` `[]`,
   `canTriggerBreakthrough` false, `runTribulation('golden_core')`
   `'refused'`, companion pull pool closed, artifact-unlock constant
   read (per landed shape).
8. **Leg I perfection surfaces**: perfect-clear record +
   `startAutoFarm` unlock + `autoFarmStage` persists through restore;
   grade-ladder fixture legs (seeded per grade tier per committed
   convention; §9-flagged for C2C); `highestFoundationAchieved` at
   initiation + surviving restore.
9. **Leg J determinism**: two same-seed runs → identical normalized
   snapshots (extended surface).
10. **Leg K body-perfection (mandatory, negative/structural)**: empty
    `BODY_PERFECTION_REALM_MATERIALS` registry → no spurious
    `discoveredMaterials`/`perfectedRealmIds`, `canPerfectBodyRealm`
    false ∀realm, persisted-slice parity through save/restore.
    Positive flow = named expected-deferral row (spec §3 leg K).
11. **Leg L body-hidden**: resolved per A13 against the landed shape
    (assertion or named deferral — never silent).
12. **Leg H**: NOT a pass — the suite header maps each rejection to
    its inline execution point (A seeded state, B phase-a, D sequence
    step b pre-final-tier for meridian / step c pre-first-meridian
    for zhou_tian, E.2 gates, F, E/I) so the aggregation is auditable
    without a temporally-impossible second pass.

Timing watch: LQ→TC tribulation drives ~40 simulated seconds of tank
chapters at `tickOps.update(1)` granularity plus battle drives at
0.1s combat steps — bounded by `MAX_TRIBULATION_TICKS`/`MAX_DRIVE_STEPS`;
generous vitest timeouts on heavy legs (60s+, matching existing).

## Step 3 — integration sweep

Run the spec §5 audit program over the merged base; record the
results table in `mf-journey.notes.md`. For every row: verdict
(clean / expected-deferral / finding), evidence (grep/test/log ref),
classification (in-mission fix vs pre-existing report vs authored
blank). **No fixes beyond in-mission defects** — and per A15, a
pre-existing defect blocking any mandatory acceptance item makes the
mission BLOCKED pending coordinator-owned repair (reported with
evidence, never weakened into a passing characterization).

**Required census row — multi-channel perfection-material census
(C2C-r94-1):** one explicit sweep row (backed by a testable census —
e.g. a spec-level enumeration test or an audited table) covering EVERY
authored perfection material against the full acquisition-channel
lattice: `BODY_PERFECTION_REALM_MATERIALS` registry entries → the
hidden-beast / grotto emitted sets → visible-grant exemptions →
exclusion from normal stage/family/non-signature channels. The row
must REPORT, even when clean: route-less requirements (a registry
entry reachable via no authored channel), duplicate acquisition
authorities (the same material grantable by two independent paths),
and normal-loot bypasses (a channel-only material leaking into
stage/family tables). Leg L's A13 resolution does not substitute for
this authority-level census — it is required regardless of whether
BODY-HIDDEN lands authored materials this wave.

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
- **Pending-sibling drift**: only BODY-HIDDEN remains; rebase may move
  its landed surface (leg L resolves per A13). The seam census is the
  rebase checkpoint — any moved seam → amend plan first.
- **Suite runtime**: full TC floor chain + tribulation + grind in one
  file — keep legs independent sessions where they don't share
  narrative (grade ladder already is); watch vitest wall-clock.
- **Snapshot parity scope**: `snapshot()` extension must stay
  normalized-deterministic (no timestamps/ids) — extend the field
  list, not the volatility.
- **Two-phase settle fidelity**: the drain seam must hold while the
  entitlement is unresolved — a seam that drains early no longer
  mirrors production and can erase the committed outcome (C2C-H1).

## Per-delta acceptance map

| Delta | Spec § | Plan step | Acceptance |
|---|---|---|---|
| Harness seams (owner, settle+drain split, invest, bags, gifts, farm, snapshot) | §4 | 1 | A1, A2, A6 |
| Legs A–B (admission → breakthrough → two-phase initiation) | §3 A-B | 2.1-2.2 | A2, A5(partial) |
| Legs E.1 + D (floor-1 first clear; body prerequisites at L1) | §3 D, E.1 | 2.3-2.4 | A3, A4(partial) |
| Legs C+E.2 interleaved (level/zhou_tian ladder + floors 2→10) | §3 C, E.2 | 2.5 | A3, A4 |
| Leg G (mid-interleave checkpoint, journey continues on restore) | §3 G | 2.6 | A6 |
| Leg F (ceiling boundary) | §3 F | 2.7 | A5 |
| Legs I–J (perfection surfaces, determinism) | §3 I-J | 2.8-2.9 | A4, A7 |
| Legs K–L (body-perfection negative leg; body-hidden resolved) | §3 K-L | 2.10-2.11 | A13, A14 |
| Leg H (ownership map — inline executions) | §3 H | 2.12 | A1 |
| Integration sweep notes | §5 | 3 | A8, A12, A15 |
| Docs sync | §6 | 4 | A9 |
| Save-version decision | §7 | 4 | A10 |
| Gates | §8 | 5 | A11 |
