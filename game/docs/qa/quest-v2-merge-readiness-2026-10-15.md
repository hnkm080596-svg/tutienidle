# Quest V2 merge preparation - 2026-10-15

## Scope and verdict

Read-only review of committed `codex/quest-v2-integration` plus its current uncommitted Quest files, against the actual working checkout at `E:/tutienidle`. No production fixes, commits, stashes, merges, deletions or pushes were made. Existing audio work in the Quest worktree is separately owned and was excluded from the Quest readiness claim.

**Not ready to integrate as a working Quest V2 feature.** The committed foundation may be considered separately as dormant content/achievement scaffolding; merging its current HEAD does not include the pending objective, transaction, receipt or recurrence work and does not change the live quest UI.

## Exact state

- Destination: `master`, HEAD `e894af77b0127614b90fa72c4bc9927a537e7e0a`, with substantial uncommitted UI/material/combat work preserved.
- Candidate worktree: `E:/tutienidle/.agent-worktrees/quest-v2-integration`.
- Candidate branch HEAD: `1f094581bc6187bf91a55564a91c4a4b8753a7f4`.
- Merge base: destination HEAD `e894af77b0127614b90fa72c4bc9927a537e7e0a`.
- Committed delta: 29 added files, 4,252 inserted lines, no deleted files. Content, achievement primitives and design/evidence files only.
- Pending delta includes S1 objective/atomic claim changes, S2 receipt primitives, S6 recurring schedule/templates and unrelated audio work. None of this pending work is included by merging HEAD.

## Confirmed readiness blockers

1. **Material compatibility - Medium integration defect / blocks activating V2.** `questV2Mainline.ts:40,155,683,862`, `achievements.ts:17-18` and `recurringV2.ts:34-36,67` still match realm-specific wood/ore IDs such as `mortal_wood_decade` and `foundation_establishment_ore_decade`. The destination's fresh material catalogue generates only age-based `material_spirit_wood_<age>` and `material_spirit_ore_<age>` identities. Fresh production deliveries cannot satisfy these authored targets/counters after activation. Update references and remove realm identity from those wood/ore objectives while preserving realm gates and the five-age axis; no balance change is implied. Herbs keep their separate realm/recipe contract.

2. **Runtime/save/UI closure is absent - feature completeness blocker, not an unexpected defect in deliberately dormant scaffolding.** The mainline file explicitly declares authored intent at its header. Source census found no runtime importer of `QUEST_V2_MAINLINE`, no real `AchievementSystem` construction and no receipt/recurring consumers in game/save orchestration. `GameManagerQuestOps` still receives unkeyed material notifications. Receipts and lifetime/period state are not persisted with their real producers. V1/V2 reward cutover, activation and multiobjective/achievement/weekly UI remain necessary before describing this as playable V2. Do not silently enable flags while merging foundations.

3. **Candidate boundary is unfinished - integration packaging blocker.** S1/S2/S6 remain uncommitted; the worktree also holds audio assets and AudioCueManifest changes. Freeze and commit the intended Quest slice independently before an actual integration review. Do not stage the whole worktree or imply that branch HEAD reproduces its current disk state.

## Previous finding rechecked

The historical JSON rollback defect is not repeated as an open finding. Current uncommitted `PlayerSnapshot.ts` uses an in-memory graph checkpoint preserving own undefined properties and nested references; `GameManagerQuestOps.ts` uses it with bag, quest and notification checkpoints. The focused transaction suite passes. Its fix is still uncommitted and therefore absent from a HEAD-only merge.

The recurring scheduler documents validated replacement restore rather than monotonic lifetime restore. No speculative standalone rollback finding was raised against that declared primitive contract; cross-process duplicate-reward protection remains a producer/save integration obligation.

## Mechanical preparation

The committed candidate adds files on top of destination HEAD, rather than replacing the current UI. Six incoming design documents already exist untracked on the destination. Git clean-filter blob hashes match all six exactly: README, IMPLEMENTATION, ACT-I-MORTAL, ACT-II-QI, ACT-III-FOUNDATION, ACHIEVEMENTS-DAILY-WEEKLY. Preserve them explicitly during any later integration; no files were removed or staged here.

There are no directly overlapping tracked dirty paths between the candidate's pending tracked changes and the destination's current tracked/untracked paths. This is not proof of semantic compatibility: the material identity mismatch above crosses different files.

Suggested integration sequence: align content with current material rulings; finish or explicitly defer producer/save/UI closure; package Quest changes apart from audio; preserve the destination's uncommitted UI; integrate the frozen candidate; then run relevant verification over the resulting combined state. A dormant-foundation merge requires an explicit scope decision distinct from enabling Quest V2.

## Current verification

Run in the Quest integration worktree's `game/`:

- `npm run type-check`: PASS.
- Focused Vitest: 13 files / 256 tests PASS. Scope: objective unit/integration/debt, atomic settlement, current QuestSystem, receipt ledger, recurring schedule/templates, authored V2 mainline, achievement system/boundary/campaign/catalogue.

These tests validate the isolated candidate against its own material baseline. They do not prove compatibility with the destination's uncommitted material catalogue, actual Quest V2 gameplay, producer/save/UI wiring, independent review or full QA. No full QA or fixed-point/merge-ready claim is made.
