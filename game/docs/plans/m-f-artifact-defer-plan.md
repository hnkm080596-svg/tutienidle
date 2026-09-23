# M-F-ARTIFACT-DEFER — Artifact deferral to Kim Đan+ — plan

Spec: `game/docs/specs/m-f-artifact-defer-spec.md` (v1 — pending
C2C spec review). Implements the Trúc Cơ mission-graph ruling
(§2, §52): the artifact domain defers to `golden_core+` — grant,
awaken/normalize, EXP feed, realm-tier advance, path/upgrade ops,
`doan_bao_thach` acquisition, and the wheel predicate all evaluate
`isArtifactDomainUnlocked`; the deferred-window surface shows
`RELEASE_UNAVAILABLE_REASON`. Scope limits per ruling: no artifact
content rebalancing, no UI redesign, keep the architecture for the
future KD surface, no save migration/strip.

Phase 1 delivered docs only; Phase 2 begins after C2C spec + plan
gates pass.

## G0 task card (proportional — carried for Phase 2)

```text
TASK CARD
Task / user request: M-F-ARTIFACT-DEFER — defer artifact domain to
  golden_core+ per the Trúc Cơ mission-graph ruling.
Assigned absolute worktree / branch:
  ~/repos/tutienidle/.agent-worktrees/m-f-artifact-defer
  branch devin/<ts>-m-f-artifact-defer off origin/p7/truc-co.
Requested observable behavior: no artifact grant/normalize/EXP/
  upgrade/path/stone-acquisition before KD; phap_bao slot disabled
  with RELEASE_UNAVAILABLE_REASON at TC; full live path at KD under
  an open window; persisted artifacts survive dormant.
Single responsibility / invariant: artifact domain availability is
  single-sourced at isArtifactDomainUnlocked
  (core/artifact/ArtifactProgression.ts) — every live action checks
  it; acquisition suppression rides the M-F-CEILING tag+policy
  authority.
Current owner (path + symbol): ARTIFACT_UNLOCK_REALM_ID +
  isArtifactDomainUnlocked (ArtifactProgression.ts); reward
  declaration at PhapTuPath.ts realmRewards; material tag at
  materials.ts + BreakthroughScopedResources.ts.
Target owner: same owners — the mission moves declarations and adds
  the missing domain guards; no new authority.
Existing primitive/mechanism to reuse: M-F-CEILING seams —
  isRealmAvailable/isRealmTransitionEnabled/
  isBreakthroughAcquisitionEnabled, the breakthroughRealmId /
  domainUnlockRealmId tag families, grant-fails-closed delivery,
  RELEASE_UNAVAILABLE_REASON surface, realmReleaseUnavailable
  context feed.
Missing capability: ops-level domain guard on
  setArtifactPath/tryUpgradeArtifactGrade (real caller: the same
  ops; wheel context's deferred-window flag for the reason ladder).
Production chain: tribulation realm write -> grantCultivationPath
  RealmReward -> player.artifact; kill -> BattleLootSystem ->
  EXP feed + tagged material filter; restore -> store
  normalizeArtifactProgress; wheel context -> slot
  enabled/disabledReason; ops -> setArtifactPath/upgrade.
State: player.artifact (persisted, normalize-owned, never
  stripped); doan_bao_thach in materialBag (conserved); artifact
  realmLevel banked advance (gated); wheel context
  (display-only predicate feeds).
Expected files and why each is in this responsibility: see Step 0
  census — each row names owns-rule / declares-data /
  calls-owner / tests-invariant.
Explicit non-goals: artifact rebalancing, UI redesign, KD surface
  design, save migration, ArtifactRuntime, other-path definitions.
Applicable roadmap phase and current source evidence: P7/post-P7
  mission graph; M-F-CEILING QA ledger 2026-09-23 (INV-CEILING-2/3/7).
Tests and gates selected: spec §5 suites; P3 quick -> full verify
  escalation (progression+policy+e2e oracle touched); P18 OCR; P14
  Playwright wheel pass; P4 quick; P5 >= 3 passes.
Stop condition: all A1-A8 green with per-gate evidence; residual
  limitations reported.
Unresolved material assumptions: none — census verified on base.
```

## Step 0 — seam census (done during spec)

Production chain (verified on `origin/p7/truc-co` `271df96e`):

| Surface | Path / symbol | Role |
|---|---|---|
| Reward declaration | `core/phap-tu/PhapTuPath.ts` `realmRewards` | owns the artifactId record's realm key |
| Domain constant | `core/artifact/ArtifactProgression.ts` `ARTIFACT_UNLOCK_REALM_ID` | single domain declaration |
| Domain predicate | `core/artifact/ArtifactProgression.ts` `isArtifactDomainUnlocked` | composes CEILING rule (unlock avail + realm avail + reached) |
| Awaken/normalize | `ArtifactProgression.ts` `normalizeArtifactProgress` | creates iff domain open; never strips |
| Way-declaration resolver | `core/artifact/Artifact.ts` `resolveExpectedArtifactId` | CEILING-owned, policy-agnostic — untouched |
| Grant delivery | `core/player/CultivationPathSystem.ts` `grantPathRealmReward`; op facade `GameManagerRealmAdvanceOps.ts` | fails closed on `isRealmAvailable(realmId)` |
| Tribulation awaken | `core/tribulation/BreakthroughOutcomeService.ts` (unreachable branch) + `advanceArtifactRealmLevel` call | hardcoded TC realm, no domain gate |
| EXP feed | `core/game/BattleLootSystem.ts` `grantArtifactExperience` | already domain-gated |
| Ops | `GameManagerRealmAdvanceOps.ts` `setArtifactPath` / `tryUpgradeArtifactGrade` | no domain gate (hole) |
| Material record | `data/materials/materials.ts` `doan_bao_thach` | untagged — never hits the policy filter |
| Delivery predicate | `core/realm/ReleasePolicy.ts` — new `isDomainScopedAcquisitionEnabled` | canonical window+reach rule (same 3-leg composition as domain predicates) |
| Material type | `core/material/Material.ts` | gains `domainUnlockRealmId?: string` |
| Scoped-id census | `data/breakthrough/BreakthroughScopedResources.ts` — new `DOMAIN_SCOPED_MATERIAL_IDS` | invariant list (tag ↔ id both directions), parallel to breakthrough lists |
| Drop table | `data/drop/StageDropTables.ts` `foundation_establishment` row | stays — delivery-side suppression |
| Definition data | `data/artifact/NguHanhChau.ts` `unlockRealmId` | dormant declaration field — authored truth |
| Wheel slot | `data/ui/commandWheelCatalog.ts` `phap_bao` + context | enabled/reason predicates; needs deferred flag |
| Context feed | `components/game/DongFuCommandWheel.vue` | builds catalog context |
| Panel | `components/game/ArtifactPanel.vue` | wheel-gated entry — unchanged |
| Doc claims | `Artifact.ts` resolver doc, `docs/systems/artifact.md`, `docs/game-guide.md` | superseded TC scope claim |

Test surfaces (verified): `core/realm/ReleasePolicy.test.ts`
(domain rows, normalize awaken, grant dormancy, wheel context),
`core/artifact/ArtifactProgression.test.ts`,
`stores/player` artifact tests, `core/game/
GameManager.artifactGradeUpgrade.test.ts`,
`core/game/BattleLootSystem.artifactDrop.test.ts` +
`battleLootTestSetup.ts` fixture,
`CultivationPathSystem`/grant suites,
`core/tribulation/BreakthroughOutcomeService` tests,
`tests/e2e/cultivation-path-ritual.spec.ts` (spell_pathway TC
oracle + hidden path oracle), `saveShapeValidation` block
(untouched). No existing `vi.mock` of ReleasePolicy — the KD
boundary suite introduces it in a new file (same pattern the suite
uses for `TribulationChapters`).

## Step 1 — TDD failing tests first

1. `ReleasePolicy.test.ts` (extend): `isArtifactDomainUnlocked`
   returns false at `foundation_establishment` and below; normalize
   at TC produces no `player.artifact`; persisted id-match survives
   dormant; persisted mismatch cleared and not re-created;
   `grantCultivationPathRealmReward` at TC delivers no artifact.
2. `ArtifactProgression.test.ts` (extend): awaken gate closed at
   TC; normalize idempotent no-op without artifact;
   `advanceArtifactRealmLevel` semantics unchanged below the gate.
3. `player.artifact.test.ts` (extend): restore on a TC save keeps
   `artifact` absent; restore on a save carrying an artifact keeps
   it dormant (id-match survives).
4. `GameManager.artifactGradeUpgrade.test.ts` (extend): both ops
   return false at TC/mortal under real policy regardless of held
   artifact; pre-existing combat guards unchanged.
5. `BattleLootSystem.artifactDrop.test.ts` (extend): TC stage kills
   deliver 0 `doan_bao_thach` under real policy (fixture carries
   the domain tag); EXP block at TC accrues 0 and
   `summary.artifactInsight` stays 0; header comment refresh
   (gate = domain tag + player reach, not table data).
6. `battleLootTestSetup.ts` (fixture): extend `materialIds` with a
   per-record `domainUnlockRealmId` carrier (same shape as
   `pillTemplates`) — required for step 5.
7. `BreakthroughOutcomeService` tests (extend): tier advance skips
   while domain closed; awaken branch requires the domain gate.
8. `components/game/DongFuCommandWheel.test.ts` (extend): slot
   disabled at TC; disabledReason === `RELEASE_UNAVAILABLE_REASON`;
   below-TC same.
9. **New mocked-policy boundary file** (`vi.mock` of
   `core/realm/ReleasePolicy` — open window through golden_core):
   `isArtifactDomainUnlocked('golden_core')` true; normalize
   awakens at KD; grant delivers on KD entry (record carries the
   canonical KD passive too); EXP accrues; path/upgrade succeed;
   slot enabled for Pháp Tu; below-KD slot shows
   `'Cần đạt Kim Đan'`.
   Stone delivery pinned on the REAL retained TC row (C2C-48):
   `golden_core`-realm player resolving the actual
   `foundation_establishment` pool entry receives the stone;
   `foundation_establishment`-realm player on THE SAME row
   receives zero — both through the real `StageDropTables`
   row, never an invented KD-stage row.
10. `tests/e2e/cultivation-path-ritual.spec.ts` (extend): TC seeded
    save → no `player.artifact`, slot aria-disabled with the
    release-unavailable reason; hidden_spell_pathway unchanged.

## Step 2 — domain unlock move (Delta 1)

- `ArtifactProgression.ts`: `ARTIFACT_UNLOCK_REALM_ID = 'golden_core'`;
  refresh the header comment (resolves the self-referencing
  M-F-ARTIFACT-DEFER note) and the `ARTIFACT_MAX_DESIGNED_LEVEL`
  comment (envelope stays 18; domain deferred).
- `PhapTuPath.ts`: move the `artifactId` override to a computed
  `[ARTIFACT_UNLOCK_REALM_ID]` key (C2C-56 — no second authored
  realm literal for the artifact domain); refresh the kit comment
  (award at the domain unlock realm, not TC). Census/integrity pin
  asserts the unique artifact-bearing record is keyed by the
  constant.
- `NguHanhChau.ts`: `unlockRealmId: ARTIFACT_UNLOCK_REALM_ID`
  (constant reference, dormant field —
  authored truth; note in commit that it has no consumers).
- `BreakthroughOutcomeService.ts`: awaken branch realm aligned to
  `ARTIFACT_UNLOCK_REALM_ID` + `isArtifactDomainUnlocked` guard;
  tier-advance guard `player.artifact &&
  isArtifactDomainUnlocked(player.realmId)`.

## Step 3 — acquisition delivery rule (Delta 2, C2C-48 amended)

- `ReleasePolicy.ts`: new exported
  `isDomainScopedAcquisitionEnabled(domainUnlockRealmId?,
  playerRealmId)` — composes `isRealmAvailable(unlock) &&
  isRealmAvailable(player) && reached(unlock)`; untagged → true;
  unknown → fail closed.
- `Material.ts`: `domainUnlockRealmId?: string` field.
- `materials.ts`: `doan_bao_thach` gains
  `domainUnlockRealmId: ARTIFACT_UNLOCK_REALM_ID` — constant
  reference via import, NOT a repeated `'golden_core'` literal
  (C2C-52: one authored realm value for the artifact domain).
  `breakthroughRealmId` not used (window-only semantics).
- `BattleLootSystem.ts` material arm: compose the new predicate
  beside the breakthrough check at the same post-resolve seam
  (`this.player.realmId` already read on the system).
- `BreakthroughScopedResources.ts`: new
  `DOMAIN_SCOPED_MATERIAL_IDS = ['doan_bao_thach']` — same
  two-direction census invariant + cross-field pin
  `domainUnlockRealmId === ARTIFACT_UNLOCK_REALM_ID` per listed
  material; stone is NOT added to the breakthrough list.
- `StageDropTables.ts`: no change — TC-floor row retained; the
  delivery rule is the gate (below-KD player gets nothing on that
  row under any window; KD player gets the stone once open).
- `RealmRewardScale.ts`: comment refresh only if wording implies
  removal (row stays).

## Step 4 — ops gates + wheel surface (Delta 3)

- `GameManagerRealmAdvanceOps.ts`: `setArtifactPath` and
  `tryUpgradeArtifactGrade` return false early when
  `!isArtifactDomainUnlocked(player.realmId)` (before the
  artifact-presence and combat guards — the domain check is the
  outermost predicate, matching domain-gate conventions elsewhere).
- `commandWheelCatalog.ts`: context type gains the deferred-window
  flag; `phap_bao` slot `disabledReason` ladder:
  `!artifactDomainUnlocked` →
  (`realmReleaseUnavailable` → `RELEASE_UNAVAILABLE_REASON`;
   unlock-realm outside window → `RELEASE_UNAVAILABLE_REASON`;
   else → `'Cần đạt Kim Đan'`); then
  `!hasArtifactDefinition` → definition-pending (unchanged).
  Enabled predicate unchanged
  (`artifactDomainUnlocked && hasArtifactDefinition`).
- `DongFuCommandWheel.vue`: feed the flag
  (`isRealmAvailable(ARTIFACT_UNLOCK_REALM_ID)`) beside the
  existing context fields — display-only predicate feed.
- `ArtifactPanel.vue`: unchanged (wheel-gated; ops guards cover
  non-wheel invocation).

## Step 5 — doc note (Delta 4)

- `Artifact.ts`: resolver doc + grant comment → deferred-KD ruling
  note (ASCII English, P15).
- `docs/systems/artifact.md`: status line "Live — unlock Trúc Cơ" →
  deferred/Kim Đan+ wording; unlock references updated; milestone
  copy stays marked as retained design data.
- `docs/game-guide.md`: scope paragraph notes the artifact domain
  rides the deferred KD window.
- Comment sweep on touched seams (PhapTuPath kit comment,
  BattleLootSystem EXP header, catalog slot comments) — remove the
  TC-live framing.

## Step 6 — gates

- P3 quick: `cd game && npm run type-check` +
  `npx vitest run` scoped to `artifact|ReleasePolicy|BattleLoot|
  CultivationPath|player|commandWheel|BreakthroughOutcome` suites.
  Escalate to `npm run verify` (full) — progression/policy surface
  + e2e oracle touched (P3 trigger list).
- E3 simplify pass → P18 OCR delegation (`ocr delegate preview
  -f json` + `ocr delegate rule <paths>` inside the worktree).
- P14 triggers (wheel slot DOM surface + e2e oracle): Playwright
  pass from the implementation worktree — TC dong-fu wheel shows
  the disabled `phap_bao` slot with the release-unavailable reason;
  capture the evidence; clean scratch artifacts.
- P4 `tutienidle-adversarial-qa` (quick) — progression/persistence
  vectors; escalate deep only if quick flags breadth.
- P5 sequential ≥ 3 passes with per-pass evidence blocks (correctness
  → architecture/authority → adversarial integration).
- P15 ASCII scan on new comments; P16 — no new i18n keys
  (reuses `RELEASE_UNAVAILABLE_REASON` + the progression-string
  convention).
- Commit + push branch; PR base `p7/truc-co`; report to
  coordinator: branch, files, per-gate evidence, limitations — then
  STOP.

## Per-delta acceptance map

| Delta | Spec § | Plan step | Acceptance |
|---|---|---|---|
| 1 — grant + awaken to KD | §4-D1 | 2 | A1, A2, A7 |
| 2 — stone suppression | §4-D2 | 3 | A3 |
| 3 — EXP/upgrade/panel gating | §4-D3 | 4 | A4, A5, A7 |
| 4 — doc note | §4-D4 | 5 | A6 |
| 5 — tests | §5 | 1 | A1-A8 |
| persistence invariants | §3, §7 | — | A8 |
