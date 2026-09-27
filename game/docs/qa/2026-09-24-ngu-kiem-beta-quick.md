# QA Quick Review — Ngu Kiem Beta (hidden_sword_pathway evolution redesign)

- Scope: branch `devin/1790284398-ngu-kiem-beta` vs `be1bdf8d` (40 files, 39 reviewable; spec doc excluded by OCR policy).
- Mode: quick. Risk mapper: combat-and-tribulation, economy-and-progression, ui-input-lifecycle; `deepAuditCandidate=true` (3 domains).
- Escalation reasoning: all 14 `unmappedPaths` route cleanly by inspection (progression ops → economy-and-progression; battle/skilldef → combat-and-tribulation; panels/locales → ui-input-lifecycle). Economy/progression risk is bounded: evolution spine = 3 single-level nodes, insight sinks 0/3/3, no new currency, no clock/offline change, no save-shape or version change. Vue/Pinia lifecycle risk is bounded: one computed name + one render tag + one button-condition fix; no new listeners/timers. Mandatory deep triggers not met.

## Invariant ledger

| ID | Boundary | Invariant | Oracle | Result |
| --- | --- | --- | --- | --- |
| INV-NK-1 | Plan lane `ops_result_sum{field:'landed'}` | Counts exactly landed prior hit ops | `opLanded` requires `status==='resolved'`; deal_damage with `landed===false` → 0 (SkillExecutor.ts:490-496, 883-886) | No defect (source-verified) |
| INV-NK-2 | `onCastResolved` → `gainKiemY(+1)` | Exactly-once per resolved cast | Single call site TurnBattleSystem.ts:2321, runs for both manual and auto lanes; provider returns `[]` so no extra impacts | Pinned (GameManager.nguKiemDao.test.ts) |
| INV-NK-3 | Ritual `grantedNodeIds` grant | Atomic preflight + idempotent grant inside commit | `nodeRegistry.has` preflight before commit; `grantSkillCore` guards level<1 and `purchasedNodeIds.includes` | Pinned (GameManager.kiemTuNguWay.test.ts) |
| INV-NK-4 | Respec vs evolution spine | Evolution nodes survive respec; not a build toggle | `RESPEC_PRESERVED_NODE_IDS` covers all 3 ids; preview + apply both honor; devResetBranch deliberately strips (dev tool) | Pinned (GameManagerProgressionOps.clawback.test.ts, GameManager.kiemTuNguWay.test.ts) |
| INV-NK-5 | Execute-branch double-count | Both `then`/`else` opIds enter `priorInstanceOpIds` | Non-taken arm never resolves → `opLanded`=0 → sum unaffected (SkillExecutor.ts) | No defect (source-verified) |
| INV-NK-6 | Kiem The persistence | Never persisted, never a buff/stat | No PlayerData/save writes; accumulator is plan-local `priorInstanceOpIds` + engine-local `landedPriorInstances`; `swordPath` key set unchanged | Pinned (invariants.test.ts key-equality + grep) |
| INV-NK-7 | `resolveNguKiemSkillName` newest-layer order | Name = last owned evolutionId node in registry order | Only `ngu_kiem_{khoi,lien,phong}` carry `evolutionId` (phong has none — sealed); KiemTuNodes array order = spine order | No defect (source-verified) |
| INV-NK-8 | Miss semantics | Miss adds no stack, never resets | `priorLanded` only increments on `!dodged`; provider gets `landedArgs=[0,1,1]` under forced miss | Pinned (invariants.test.ts wrapped-provider test) |
| INV-NK-9 | Cast-local reset | New cast starts at zero stacks | Counter declared per cast before target loop in both TBS lanes | Pinned (invariants.test.ts 3-step cast test) |
| INV-NK-10 | Clawback removal | No dangling grant records | `kiemYGrant`/`kiemDaoGrant`/`cascadeUnlock` fields deleted from `NodeEffect`; record fields deleted; no producers remain (type-checked) | No defect |
| INV-NK-11 | `ngu_kiem_phong` sealed node | Never purchasable in beta ceiling | realm prereq `golden_core` exceeds `foundation_establishment` ceiling; `effect:{}` so even grant-forced ownership resolves nothing | No defect (source-verified) |
| INV-NK-12 | `Ngự Kiếm · ?` display | phong never becomes the displayed name | Collector/name resolver both gate on `effect.evolutionId !== undefined`; phong lacks it | No defect |
| INV-NK-13 | NodeInspector upgrade button | Single-level owned evolution shows status only | `v-else-if="level < maxLevel"` replaces `!isMaxed`; equivalent for maxLevel>1, correct for maxLevel=1 | Pinned (component behavior change, unit-verified) |
| INV-NK-14 | Kiếm Ý/Đạo economy | Forge/cap/merge unchanged, realm caps LQ2/TC3 | `forgeCost`/`kiemDaoCap`/`applyBreakthroughMerge` untouched; caps re-pinned | Pinned (invariants.test.ts) |

## Findings

None Confirmed. None Suspected beyond recorded gaps.

## Coverage gaps (recorded, non-blocking)

1. **Plan-lane momentum end-to-end**: `momentumPerLandedInstance` is verified at the contract/adapter level (verbatim copy + `priorInstanceOpIds`/`ops_result_sum` construction) plus `ops_result_sum` executor semantics by source inspection; no live routed-battle executes a Lien-owning provider through the plan lane (plan lane requires a runtime-bound battle). Engine lane has live evidence (3-sword [D, D·1.15, D·1.30] and miss/cast-local tests).
2. **UI e2e**: evolution name/tag display verified by unit-level contract (`resolveNguKiemSkillName`, `evolutionName` derivation, i18n key present in both locales); no browser e2e over the skill-path panel.

## Verdict

PASS WITH EVIDENCE (engine-lane runtime evidence + source-verified plan-lane semantics + pinned progression/respec/ritual invariants; two recorded coverage gaps).
