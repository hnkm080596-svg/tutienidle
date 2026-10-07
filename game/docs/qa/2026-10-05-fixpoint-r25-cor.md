# Fixpoint r25 — COR (correctness/regression) blind audit

- **Scope:** the r24 adjudication batch at `2a3f95a9` (branch `codex/hoa-cau-fireball-vfx`) plus sibling surfaces its classes touch.
- **Batch under audit:** (1) `sanitizeRestoreAuthority` degrades a present-but-corrupt authority to `{kind:'live-replacement', nowMs: Date.now()}` (zero-accrual) instead of `undefined`; (2) `settleNowMs` gained a third `Date.now()` clamp (r24-INT-01); (3) `validateQuestSave` gained `QUEST_LIST_CAP=1024`; (4) `CultivationInsight` comment corrected to ~2.8e17 onset; (5) r24 probe files + `player.restoreFromSave.test.ts` flips.
- **Probe evidence:** `src/services/save/auditR25Cor.probe.test.ts` — 10/10 green under `npx vitest run src/services/save/auditR25Cor.probe.test.ts` (node env, `--disable-console-intercept`). `npm run type-check` clean.
- **Verdict:** PASS WITH EVIDENCE — one **Medium** sibling arm of the exact grant class the batch fixed (absent authority under remote, R25-COR-1), two **Nit** residuals (redundant clamp operand + uncapped sibling lists), one **Nit** dormant arm (quest day-bucket marker). The batch itself is sound: deny direction holds end-to-end, no honest-accrual loss found in the degrade or the third clamp, and the quest cap cannot reject an honest save.

---

## Findings

### R25-COR-1 — Medium (High-arguable): under `remote-authoritative`, a malformed/absent `serverTimeUtc` re-opens the payload-marker mint the batch just closed

**Claim.** The batch fixed *present-but-corrupt* authority stamps (degrade to deny). It did not cover the *absent* arm — and the remote load pipeline produces `serverAuthority === undefined` whenever `serverTimeUtc` is missing or fails `Date.parse`. `useAppLifecycle.ts:458-467` then mints **no** `timeAuthority` (`remoteAuthoritative && loaded.serverAuthority ? coldBoot : undefined`), so both seams run the **legacy client-clock arm**: `calculateOfflineTime({lastOnlineAt: save.player.lastSavedAt}, Date.now(), …)` — accrual bounded only by the payload's own editable marker and the local clock. That is precisely the class B1-D eliminated ("Never the editable client clock" — the comment immediately above the mint) and the class r24 rated High/Medium for present-corrupt stamps.

**Verified reachability (end-to-end):**

1. Every honest load-RPC return stamps `'serverTimeUtc', now()` — confirmed across `202609300001_beta_authority_prepare.sql` (~lines 640-710, every `jsonb_build_object` return incl. SAVE_READY/INCOMPATIBLE/NO_CHARACTER) and the two later boundary migrations (`202610050002`, `202610060001`). Postgres `now()` text always parses (verified: `"2026-10-06 07:46:00.123456+00"` → `Date.parse` OK). So `serverAuthority === undefined` under remote can only mean a **malformed contract**: field dropped (drifted RPC revision, gateway/proxy rewriting), non-string value, or an unparseable string — the same "corrupt upstream" input class the sanitizer denies for a *present* authority.
2. Both producers carry the same arm: `SupabaseCloudSaveService.ts:765-776` (SAVE_READY) and `:460-463` (`adoptCommittedPending`) — `serverNowMs === undefined ? undefined : {…}`. `parseTimestampMs` (:138) maps absent/non-string/NaN to `undefined` with no diagnostic.
3. `CloudSaveCoordinator.load()` (:55-66) is a pure passthrough — no cached-envelope 'ok' path can produce a remote-authoritative load without the field; the only `save`-carrying 'ok' results are the two arms above.
4. The seam consequence (probe A1/A4): crafted `lastSavedAt = now-10d` + `authority = undefined` → `elapsedSeconds = 86400`, `cultivation > 0`; the identical payload under `{kind:'live-replacement'}` → `0/0`. The absent arm is strictly on the grant side of the r24 fix.
5. End-to-end at the manager seam (probe A2): an alchemy job due 30 min after the crafted marker **settles** under `undefined` (marker window `lastSavedAt + 24h`) and survives under `live-replacement` — same payload, opposite outcome, decided entirely by whether upstream delivered a parseable `serverTimeUtc`.
6. Admission-clean marker (probe A3): `lastSavedAt = now-10d` passes `validateGameSaveShape` (only `|x| < 2^52` bounds it). For remote saves the payload is client-authored anyway — a bypassing client sets the marker freely; the authority exists precisely so that this does not matter.

**Impact bound:** ≤24h cultivation (player seam's `DEFAULT_MAX_OFFLINE_SECONDS`) plus the per-channel caps (autoFarm 24h·0.5 + anchor-gap, production 10h budget, decompose cap floor + 5000-cycle bound, alchemy persisted deadlines) — a bounded grant, silent (no diagnostic anywhere on the collapse path).

**Why Medium, not High:** reachability is one notch below the r24 corrupt-stamp class — that one needed only an out-of-domain *parseable* stamp (the parseable band `[2^52, 8.64e15]` accepts e.g. Postgres year-200000), while this needs the field absent/unparseable (contract drift or response corruption). Same payout properties otherwise. Adjudication could reasonably grade it High by parity with R24-COR-1.

**Suggested direction (for adjudication, not a fix from QA):** fail closed when `remoteAuthoritative && loaded.status === 'ok' && loaded.serverAuthority === undefined` — reject to the recovery surface (the response is provably outside the stamped contract), or degrade to `live-replacement` anchored at client now, matching r24's deny semantics. The live-replacement resume mint at `App.vue:663` already tolerates `?? Date.now()` because its kind is accrual-free; the cold-boot mint cannot take that shortcut.

---

### R25-COR-2 — Nit: `Date.now()` third operand of `settleNowMs` is redundant on the absent arm (harmless; correct where it matters)

`GameManagerSaveRestore.ts ~:414`: `settleNowMs = Math.min(lastSavedAt + elapsed*1000, authorityNowMs, Date.now())`.

- **Absent arm:** `authorityNowMs = restoreAuthorityNowMs(undefined) = Date.now()` — call #1; the third operand is `Date.now()` call #2, ≥ call #1 by ~0ms. It can never tighten the min. Probe S2 pins `restoreAuthorityNowMs(undefined) === Date.now()`. Redundant, not wrong.
- **Cold-boot forward-skew arm (the real purpose, r24-INT-01):** verified end-to-end (probe S1) — `untilMs = now+1h`, `since = lastSavedAt = now-2h` → `settleNowMs = now`; a job due `now+30min` (inside the approved span) survives pending instead of settling early — defer-not-lose — while the player seam still pays the full approved `elapsedSeconds = 10800`. The pre-fix `min(L+E, until)` would have stamped `now+1h` into persisted heads, tripping the next save's `startedAtMs <= lastSavedAt` pin.
- **Rewound-clock edge (checked, deny-only):** client `Date.now()` behind `lastSavedAt` → `elapsed = max(0, negative) = 0` → `settleNowMs = now < lastSavedAt` → zero-width windows everywhere; cultivation 0. Underpay direction only (probe S2).

### R25-COR-3 — Nit: sibling id lists have no count cap (cap asymmetry with `QUEST_LIST_CAP`)

`QUEST_LIST_CAP=1024` now bounds `quests.active/completedOnceIds/questFlags` (probe Q1: 1025-entry lists all rejected at the cap; probe Q2: the entire authored roster — 21 quests — validates clean, so no honest save can trip it; the write path never runs `validateGameSaveShape`, so no self-brick).

The sibling lists remain uncapped (probe Q3):

- `player.completedStageIds`, `player.perfectClearStageIds`: `validateStringEntries` only; unknown ids skip both the realm-claim walk (`STAGE_BY_ID` miss) and the chain-coherence walk (`zones.find` miss). `perfectClear ⊆ completed` is the only constraint — satisfied by mirroring the same crafted ids.
- `player.purchasedNodeIds` + `player.nodeLevels`: crafted `nodeLevels['craft_i'] = 1` skips every pin (`PROGRESSION_NODE_BY_ID` miss → `continue`), satisfying the `nodeLevels[id] >= 1` mirror requirement.

2048-entry crafted sets pass admission clean (`result.ok === true`). Payload bytes bound the practical count (~5MB localStorage / transport envelope), so impact is padding cost — O(n) parse + per-entry map walks (`zones.find` × `stageIds.includes` per stage entry) — a boot-time slowdown vector on hostile payloads, not a mint: unknown ids unlock nothing real. Symmetric `*_LIST_CAP` constants would close the asymmetry the quest fix established.

### R25-COR-4 — Nit (dormant arm): `quests.lastDailyResetAtMs` is a payload-editable day-bucket marker consumed under the client clock

- `GameManagerSaveRestore` restores quests with `Date.now()` (field-epoch — adjudicated r16-INT-04); `QuestManager.restore` clamps only the *future* direction (`min(stamp, nowMs)`).
- Admission bounds the stamp to `|x| < 2^52` — no `<= lastSavedAt` pin. A crafted deep-past stamp survives restore verbatim (probe D1).
- `QuestSystem.checkAndResetDaily` compares UTC day buckets: crafted past → reset fires early → `lastDailyResetAtMs` re-stamps to now. The payoff would be re-earning daily quests ahead of schedule — same "payload marker drives a grant" family as R25-COR-1, though a forward client-clock achieves the same without any save edit (calendar ops are inherently client-local).
- **Dormant today:** all 21 authored quests are `cadence: 'once'` — the reset clears nothing (probe D1 asserts `QUESTS.every(cadence !== 'daily')`). Records the arm before a daily quest ships; worth a `<= lastSavedAt`-style admission pin or a day-bucket floor at that point.

---

## Checked and rejected / already adjudicated

| Surface | Result |
|---|---|
| `sinceMs` fallback to `save.player.lastSavedAt` when `cutoffMs` absent (pre-checkpoint rows) | Documented compat arm (r24 adjudication); `progression_cutoff_at` is server-stamped monotonic-max on every write since migration `202609300001` — the arm only affects rows predating it. Payload-marker window start, but `until` stays server-owned and per-channel caps hold. No action. |
| Resume mint `App.vue:663` `{kind:'live-replacement', nowMs: serverAuthority?.serverNowMs ?? Date.now()}` | Second production authority mint; kind-blind stamps are harmless (zero-accrual regardless); corrupt `nowMs` would re-enter the sanitizer at the seams anyway. Consistent. |
| `buildings[].lastCollectedAt` offline accrual on payload marker + client clock | Adjudicated: r12-AUT-1 (future→now clamp), r16-INT-02 (field-epoch chosen deliberately — `Date.now()/1000`), r22-AUT (double-capped `min(elapsed,10h)` then `min(stored,capacity)`). |
| `autoFarm.lastCheckedMs` | `min(min(elapsed,86400), now-lastCheckedMs)` + `>now→now` re-anchor (r15-COR-E); unconditional re-anchor on the `elapsed<=60` arm (r12-COR). Bounded by real gap. |
| `tribulation.cooldownUntil` pin `<= lastSavedAt + 300s` | Crafted-future pairs are deny-direction (freeze); admission pin verified. |
| `alchemySystem.settleOffline` unconditional (not gated by `>60`) | Deadline-bounded: `tick(settleNowMs)` delivers only `completesAtMs <= settleNowMs`; `settleNowMs <= Date.now()` post-r24. No early pay. |
| `refinementPoints`/`lastRefinementRegenAtMs` | Removed from PlayerData at v46 — dead keys, whitelisted out at restore. |
| `EarlyGameSession.restoreCheckpoint` | Simulation harness; calls `restoreGameSession` with no authority by design (not the production path). |
| Payload-identity caches authority-agnostic | R24-INT-03 / COR-2 — already excepted (bounded split-settle on mid-restore throw). |
| Kind-blind drop granularity (corrupt stamp discards honest siblings) | r24 recorded residual — deny-consistent, design choice. |
| Insight drain + comment fix | Pure comment change; drain bit-identical (r24 probes C1-C4 already pin). Re-verified no other caller. |
| `quests` write-path validation | Write path does not run `validateGameSaveShape` — cap cannot self-brick honest saves (probe Q2). |

---

## Learned-defect loop

| Lesson | Class | Detector escape | Pin proposed |
|--------|-------|-----------------|--------------|
| "Absent" and "malformed" collapse to the same `undefined` upstream of the sanitizer | contract-boundary ambiguity | r24 covered *present*-corrupt at the seam; the collapse happens two layers earlier (service guard) where the seams can't see it | probe A4 mirrors the producers; candidate fix: fail-closed when `remoteAuthoritative && ok && serverAuthority === undefined` |
| Redundant clamp operands can hide which arm a bound exists for | redundant bound | `min(a, Date.now(), Date.now())` looks uniform but only binds on one arm | probe S2 documents per-arm purpose |
| Count caps must be applied per-list, not assumed from one fix | asymmetric bounds | quest cap closed one list while three sibling id lists stay uncapped | probe Q3 pins the asymmetry; symmetric `*_LIST_CAP` constants |
| Persisted markers that skip the `<= lastSavedAt` pin remain grant arms regardless of authority | epoch/calendar residual | `lastDailyResetAtMs` is a day-bucket field — epoch pins never applied | probe D1; dormant until a 'daily' quest ships — pin before then |

**COR auditor sign-off: r25 — PASS WITH EVIDENCE.** Findings: Medium ×1 (R25-COR-1, deferred to adjudication), Nit ×3 (R25-COR-2/3/4 — recorded, no fix required). The r24 degrade is verified deny-consistent end-to-end with no honest-accrual regression found.
