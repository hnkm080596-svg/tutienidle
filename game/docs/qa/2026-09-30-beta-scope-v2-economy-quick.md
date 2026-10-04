# P4 Quick Adversarial QA — BETA SCOPE LOCK v2 Phase-5 (economy + dormant-domain shutdown)

- Date: 2026-09-30
- Scope: Phase-5 diff — §11 equipment gates, §12 alchemy read-model, §13 production/worker-lodge, §14 companion/formation/artifact shutdown, §15 quest lifecycle + Phase-4 fallout, §17 economy census.
- Mode: quick (per work order). Deep-escalation review: the change is cross-system BY DESIGN (the scope-lock mandate spans 3 mapped domains), but the change class is fail-closed gating + authored-data retirement — no new transitions, no save-shape change, no time-ownership change; persistence contracts are preserved and pinned. Risk bounded by gate-completeness + grandfathered-state sweeps below.

## Inputs

- Task-owned production paths (11 unmapped, manually routed):
  - `src/core/betaScope.ts` — authority additions (economy classes, worker-lodge tabs). Routed: economy-and-progression.
  - `src/core/companion/CompanionAvailability.ts`, `core/companion/CompanionGifts.ts`, `core/game/FormationPlacement.ts`, `core/artifact/ArtifactProgression.ts`, `core/game/HiddenBeastSystem.ts` — domain-predicate seams. Routed: economy-and-progression (domain-access gating).
  - `src/core/game/GameManagerAlchemyOps.ts`, `GameManagerBuildingOps.ts` — ops gates + read-models. Routed: economy-and-progression.
  - `src/data/drop/FamilyDropTables.ts` — drop-table data. Routed: economy-and-progression.
  - `src/locales/{en,vi}.json` — new `scope_hidden` reason strings. Presentation-only; no domain routing.
- Mapped domains: economy-and-progression, inventory-equipment, combat-and-tribulation.
- Domain packs read: economy-and-progression (+ inventory-equipment for affix seams).
- learned-defects.md matching entries: QA-2026-09-01-009 (refine raw-value validation) — precedent confirms preview/commit ticket seams need gates; covered by the three-point gate pattern on both wash and refine.

## Invariant ledger (selected attack operators)

1. Gate-completeness sweep — every public mutating/query seam on a hidden domain must fail closed. Operators: enumerate public methods, check each for the predicate.
2. Gate ordering — predicate must fire before any bag/counter mutation. Verified top-of-function placement on all added gates.
3. Single-check invariant — save/restore paths must never re-consult scope flags (ownership data survives). Verified: `DecomposeSystem.getSaveState/restore`, `ArtifactProgression.normalizeArtifactProgress`, save validators untouched.
4. Grandfathered-state sweep — persisted pre-flag data (companions, formationLoadout, hidden-beast progress, wash tickets, ore-decompose settings, unregistered quest progress) must not produce domain effects. THIS is where the real findings lived.
5. Faucet-suppression completeness — every delivery path for hidden-domain currencies. Verified: pull token (existing `isCompanionPullTokenSourceSuppressed`, pool hard-closed), essences (new `physiqueEssenceGradeOf` + `isScopeHidden('bodyPath')` gate), doan_bao_thach (`domainUnlockRealmId` gate), hidden-beast kill channels (`onEnemyDefeated` gate + spawn funnel via `stageSpawnableEnemyIds`), companion mailbox (`issueCompanionGifts → []`), production hidden channels (`rollHiddenChannelRewards` early-return at its single settle call site).
6. Census self-masking — anti-vacuous floors (≥60 sources/sinks) + purpose-sink sweep + suppressed-faucet absence assertions.

## Findings

| # | Severity | Class | Finding | Evidence | Disposition |
|---|----------|-------|---------|----------|-------------|
| 1 | Low | Dead code | Redundant `COMPANION_PULL_TOKEN_MATERIAL_IDS` post-resolve block added in `BattleLootSystem` — unreachable because the two-cases-earlier `isCompanionPullTokenSourceSuppressed` check unconditionally suppresses the same id (pull pool is hard-coded `false`). | Source trace: `ReleasePolicy.isCompanionPullPoolEnabled() → false`. | FIXED — block removed; suppression stays owned by the existing seam. |
| 2 | Medium | Domain access leak (grandfathered save) | `BattleLootSystem` companion battle EXP loop ran whenever `player.companions.length > 0` with no domain check — a pre-flag save carrying owned companions + a persisted `formationLoadout` kept accruing companion EXP through the normal kill path. §14 requires no domain mutation/actions reachable via normal beta API. | SOURCE_PROOF → confirmed by failing/green repro: new gate `isCompanionDomainUnlocked(player.realmId)` added at the loop guard; pinned by `betaScopeEconomyGates.test.ts` 'companion battle EXP does not accrue on a grandfathered save' (exp stays 0 under real flags) + `BattleLootSystem.companionExp.test.ts` keeps enabled semantics (flags stubbed + foundation realm). | FIXED |
| 3 | Medium | Domain access leak (grandfathered save) | `resolveCombatBuild` fielded persisted companions and applied the Tran Phap formation buff with no domain checks — same grandfathered-save class: `player.companions` + `player.formationLoadout` survive from a pre-flag save and fight in beta combat. | SOURCE_PROOF → confirmed via repro: `companions` now `[]` when `!isCompanionDomainUnlocked`; `formationBuffId` undefined when `!isFormationUnlocked`. Pinned by gates test 'grandfathered combat build fields no companions and no Tran Phap buff'; `CombatBuild.test.ts` M3 describe keeps enabled semantics via flags stub + `domainPlayer()` (foundation realm). | FIXED |

## Verified-non-findings (rejected hypotheses, recorded)

- Hidden-beast spawn substitution on beta stages — already doubly closed: `onEnemyDefeated` freeze + `stageSpawnableEnemyIds(stage).has(hidden.id)` funnel rejects huyet_mong on every beta stage. Phase-4 positive control (`maybeReplaceSpawn` stays live off-window) preserved and pinned.
- `advanceArtifactRealmLevel`/`recordArtifactExp` direct calls — every in-game caller composes `isArtifactDomainUnlocked` (loot EXP, realm-advance ops, CultivationPathSystem, BreakthroughOutcomeService, normalize awaken gate). No uncalled mutation path reachable through normal API.
- Companion ops public methods (`pullCompanion`, `exchangeCompanion`, `claimCompanionGift`, `feedCompanion`) — all check `isCompanionDomainUnlocked` before mutating; `duyenPhan`/`companionPullsSinceRare` writes only inside those gated ops.
- Daily-quest residue — unregistered `questProgress` entries are inert (events skip `!registry.has`, claims resolve via registry, projection iterates registry); pinned by ChieuHienLenhDrops + r81qa tests.
- Player formation position read in `resolvePartyFormation` — benign positioning of the player slot only; not a domain effect. Left ungated (minimal diff).

## Deferred (Low/Nit, intentionally not fixed)

- None new. Pre-existing: `EquipmentSystem.ts` unused imports (lines ~20–22) predating this phase; repo-wide 93 eslint errors pre-existing. Both recorded in the plan doc.

## Verdict

**PASS WITH EVIDENCE** — 2 Medium domain-access leaks on grandfathered saves found and fixed with repro pins; 1 Low dead code removed. All seams re-verified:

- `npx vitest run tests/architecture/betaScopeEconomyGates.test.ts` → 17/17 green
- `npx vitest run src/core/game/BattleLootSystem*` → all green (companionExp: flags stub + foundation realm)
- `npx vitest run src/core/game/CombatBuild` → 25/25 green (M3 describe uses flags stub + domainPlayer)
- `npm run type-check` → clean

Gaps: UI surface assertions (Worker Lodge tab model, alchemy read-model consumer) covered at read-model level only — no P13/P14 browser pass this phase (backend/read-model task; gates are domain-level and bypass-tested). Deep-mode escalation considered and rejected: risk bounded to gate completeness, which the sweeps above enumerate exhaustively for the touched domains.
