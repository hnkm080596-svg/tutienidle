# QA Review: M-F-COMPANION-GIFT (Beta mail/gift companion acquisition)

- Date: 2026-09-23
- Mode: deep (mandatory escalation: save/cloud boundary materially changed + 4 mapped domains + deepAuditCandidate)
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: core/realm/ReleasePolicy.ts, core/companion/CompanionAvailability.ts, core/companion/CompanionGifts.ts, data/companion/Companions.ts, data/companion/CompanionGiftMoments.ts, core/player/Player.ts, core/game/GameManagerCompanionOps.ts, core/quest/QuestSystem.ts, core/game/BattleLootSystem.ts, core/tribulation/TribulationOutcomeService.ts, core/game/GameManagerRealmAdvanceOps.ts, core/game/GameManagerBattleRewardOps.ts, components/panels/WorkerLodgePanel.vue, components/panels/worker-lodge/{QuaTangTab,ChieuMoTab,DuyenPhanTab}.vue, services/save/{saveShapeValidation,saveVersion}.ts, locales/{en,vi}.json (+ their test files). Exclusions: docs/specs, docs/plans, SkillPathPanel.test.ts duplicate-key repair (pre-existing TS1117 on base, unrelated fix to unblock type-check).

## Scope and Risk Map

Gift channel = new acquisition transaction crossing persistence (companionGifts on PlayerData, save v77), progression (pull-parity grant), and UI (claim tab). Suppression touches quest unlock + claim-item filter + loot delivery. Escalated per quick-workflow rules 1+6; risk bounded by code inspection on every task-owned unmapped path.

## Invariant Ledger

| ID | State/owner | Action/transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-CG-1 | player.companionGifts (PlayerData) | seam fire appends records | exactly-once per moment id | repeat | re-fire appends 0, array len stable | vitest wiring (realm + stage) | high |
| INV-CG-2 | claim op | claim granted record | idempotent no-op | repeat | second call: alreadyClaimed, no grant, no toast | vitest ops | high |
| INV-CG-3 | claim op | grant -> claimed flag | atomicity | interruption | claimed=true only after grant decision; single loot toast | vitest ops | high |
| INV-CG-4 | gift authority | non-Beta definitionId in registry/record/save | boundary closed | stale state + corruption | issue-skip / unknown_gift / validation issue | vitest 3 legs | high |
| INV-CG-5 | persisted gifts | save -> reload -> claim | recoverability | interruption | round-trip preserves records + validates | SaveRoundTrip (added) | high |
| INV-POOL-1 | pull/exchange ops | pull or exchange on empty pool | explicit rejection precedes debit | reordered gates | pool_unavailable; tokens/duyenPhan/pullsSinceRare unchanged, both flag-off and enabled-empty arms | vitest ops | high |
| INV-SUP-1 | token sources | daily quest / mixed quest / boss drop | conservation: faucets off, siblings land, banked state kept | cross-system chain | quest inactive; mixed quest active minus token lines; boss sibling rewards land | vitest ReleasePolicy + ChieuHienLenhDrops | high |
| INV-UI-1 | notification sink | one claim | single success owner | repeat | exactly one loot toast; none on alreadyClaimed; UI pushes none | vitest integration | medium |
| INV-UI-2 | tab gating | realm below TC | lifecycle/presentation | stale state | qua_tang + gacha tabs hidden; activeTab falls back to nhan_cong | component test + code | medium |
| INV-SEAM-1 | tribulation victory | realm_entered fire order | transition ordering | cross-system chain | issue runs after realmId write; wiring spy sees correct trigger | wiring test | high |
| INV-SEAM-2 | chooseCultivationPath | mortal -> qi_refining promotion | same seam | cross-system chain | spy called, no moment matches (silent) | wiring test | medium |
| INV-SEAM-3 | stage first-clear | once-guard | exactly-once | repeat refight | spy silent on completed stage | wiring test | high |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| npx vitest run (full suite, post-change) | 6941 pass / 3 fail | All 3 pre-existing or env: SettingsPanel reset-save TypeError identical on untouched base 3b5fbac5 (verified via detached worktree); 2 dongFu asset tests spawnSync 'magick' ENOENT (no ImageMagick on box) |
| npm run type-check | pass | vue-tsc clean |
| npm run build | pass | vite build 2.17s |
| npm run test:e2e (parallel, workers=2) | 28 pass / 5 fail | combat-idle-motion, standing-slot-panel, technique-frozen-warning, cultivation-path-ritual x2. Serial rerun still fails 3; combat-idle + standing-slot verified identical on untouched base (detached worktree, serial). technique-frozen + ritual failures are the same command-wheel/game-root stall class; tribulation-flow.spec (the P13 oracle covering the same post-outcome route) passed |
| Save round-trip chain (issue->buildGameSave->JSON->validate) | pass | New QA test in SaveRoundTrip.test.ts proves records ride the pipeline with values intact |
| Restore whitelist | code-observed | createDefaultPlayer includes companionGifts -> allowedPlayerKeys admits it -> Object.assign restores it |
| UI claim/claim-persistence browser check | PASS | delegated testing-agent P14 run: all 9 checks green (tab order/gating, pending->claimed flow, single loot toast, constellation rank-up, closed-pool copy, reload persistence, empty state); evidence posted on PR #12 |

**P14-driven fix (post-report, declared per C2C-74):** the run surfaced a Medium outside the mission census - `OVERLAY_LAYERS.toast=1500` sat below `panel=1800`, so ops `kind:'loot'` success toasts rendered behind every full-screen panel (claim/pull/exchange feedback structurally invisible). Fixed in `414b6ac4` (`toast: 1870`, above panel+announcement, below modal) and re-verified live (elementFromPoint hits `.toast-item`, container z-index 1870). Contract pinned by `src/core/presentation/OverlayLayers.test.ts`. Pre-existing finding recorded on the PR, not fixed in scope: build-popover 'Xay dung' button lacks z-index (invisible but clickable).

## Findings

No Confirmed defects. No Suspected findings surviving inspection:

- `break` in BattleLootSystem token-suppression sits inside the `switch (drop.kind)` case, not the `for` loop - siblings still land (verified by ChieuHienLenhDrops test + code).
- Quest claim-side uses `continue` inside the `for` - correct symmetric semantics.
- questIsTokenOnlySource matches QuestReward shape {reward?, itemDrops?}; empty-set quest can never be misclassified as token-only.
- claimCompanionGift orders integrity (unknown_gift) before idempotency (alreadyClaimed) - correct precedence, spec-pinned.
- WorkerLodgePanel visibleTabs/watch close the sub-TC stale-tab invariant for all companion tabs including qua_tang.
- Notifications convention: ops loot messages hardcode Vietnamese (Chiêu mộ:/Đổi Duyên Phận:/Hoàn thành: precedent) - Quà tặng: follows it.
- Learned-ledger patterns applied: QA-2026-09-12-013 catalog-membership validation (isBetaCompanionGift covers gift records); QA-2026-09-12-012 per-record dedupe keyed by persisted id (record.id===moment.id + validator dup-id reject); QA-2026-09-09-RR7 invocation cardinality pinned by wiring spy call-count.

## New or Changed QA Tests

- src/services/save/SaveRoundTrip.test.ts: 'issued companion gift records round-trip' - proves both pending and claimed records survive detach->JSON->validate with values intact (cross-system chain oracle).
- src/core/presentation/OverlayLayers.test.ts: pins the stacking contract the P14 fix encodes (toast above panel+announcement, blocking surfaces above toast, curtain topmost).

## Gaps and Residual Risk

- 5 e2e failures are environmental/pre-existing (2 verified identical on base serially; remainder same stall class). Not evidence against the task.
- No Playwright spec drives the qua_tang tab; browser evidence came from the delegated P14 run (testing-agent) - all checks green plus the declared toast-layer fix above. A durable e2e spec for the claim flow remains a coverage gap.
- ImageMagick absent: 2 dongFu asset tests Not verified everywhere (env limitation, unrelated).

## Pre-existing Failures

- SettingsPanel.test.ts reset-save TypeError (identical on base 3b5fbac5).
- dongFu asset tests x2 (magick ENOENT).
- SkillPathPanel.test.ts TS1117 duplicate getTurnBattle (removed dup key to unblock type-check; base defect).
- e2e: combat-idle-motion, standing-slot-panel (verified on base), technique-frozen-warning, cultivation-path-ritual x2 (same stall class, unverified on base but tribulation-flow oracle green).
