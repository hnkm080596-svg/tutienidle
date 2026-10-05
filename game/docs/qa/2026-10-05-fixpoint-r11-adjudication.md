# QA Fixpoint r11 — adjudication (pin 5805d962)

Three blind auditors (COR / AUT / INT) on `codex/hoa-cau-fireball-vfx` @ `5805d962`.
Verdicts: COR PASS WITH GAPS (1 Medium), AUT PASS WITH EVIDENCE (0 Med, 2 Low), INT PASS WITH GAPS (0 Med, 2 Low, 1 Nit).

## Fixed

| Finding | Sev | Fix |
|---|---|---|
| COR-1 crafted FUTURE `player.lastSavedAt` → `settleNowMs` future-dated → unconditional `alchemySystem.settleOffline` mints pending jobs | Medium | `settleNowMs = Math.min(lastSavedAt + elapsed*1000, Date.now())` in GameManagerSaveRestore.ts — honest saves unaffected (identity holds when within window) |
| COR-2 (pin) tickAutoFarm future-dated `lastCheckedMs` re-anchor lacked a test | Low | pin added in GameManager.autoFarmAdversarial.test.ts |
| AUT-1 = INT-11-01 forged-future `quests.lastDailyResetAtMs` freezes daily reset forever | Low | restore clamps to `Math.min(value, Date.now())` in QuestManager.ts — "just reset" direction denies both freeze and free-reset; dormant today (dailyQuest flag off) |
| AUT-3 cold-boot restore branch still computed elapsed inline | Nit | routes through shared `calculateOfflineTime` |
| AUT nit — `drawFromPool` NaN weights failed OPEN paying the last pool entry | Nit | `!Number.isFinite(total)` → throw |
| INT-11-02 `settleAutoFarmOffline` not atomic: loot paid per cycle, anchor written after loop → mid-loop crash + same-payload restore retry re-paid the whole window | Low | two-part fix: anchor written BEFORE the payout loop AND the payable window is bounded by the farm's own anchor (`min(authorized elapsed, now - lastCheckedMs)`) so a retry settles ~0 cycles — underpay on crash, never double-pay. Honest windows unchanged (saved anchor ≤ lastSavedAt ⇒ anchor gap ≥ elapsed). |
| INT-3 comment claimed drop-table floor and quality ceiling "always resolve the same floor" — false for stages missing `floor` | Nit | comment corrected to state the authored-data-only divergence |

## Rejected / excepted

- **COR-4** `poolDrawChance` "dead" on family tables — invalid: the field only exists on `StageDropTable`; `FamilyDropTable` cannot carry it.
- **AUT-2** forged-PAST `lastCheckedMs` mints up to 24h at live rate via tick (vs 50% offline) — excepted: crafted-save tampering is server-authority scope (B1-D); bounded by the 24h cap; consistent with prior adjudications of this class.
- AUT nit — `itemQualityCeilingForFloor` tail `return 'tien'` is the legitimate over-top-band cap for `floor > maxFloor`, not dead code.

## Verification

- type-check clean
- scoped vitest: 45 files / 913 tests + re-pinned evidence probes (fixpointR11Aut/Int) green; P15 ASCII ratchet clean after transliterating auditor-authored comments.

## Wave outcome

Medium+ fix landed → r12 confirmation trio dispatched on the new tip.
