# QA Fixpoint — r12 — COR (local correctness & regression) audit

**Object under audit:** branch `codex/hoa-cau-fireball-vfx` aggregate state, pinned commit `f04b6fe2` ("qa(r11): adjudication batch"). Method: fresh worktree at the pinned SHA, `node_modules` present, `npm run type-check` (vue-tsc --build, clean) + scoped `npx vitest run` on the real tree (14 files / 577 tests on the autofarm + save-restore + decompose + quest + shape-validation + r11 evidence surface — all green; 41 files / 811 tests on the wider related scope green in the same session). Every changed unit was read end-to-end plus its producers, consumers, validation gates and sibling implementations — not the diff summary.

**Facet:** local correctness — conditions, state transitions, null/undefined, arithmetic, async/races, lifecycle, error paths, edge cases, restore/reset behavior, incomplete migrations, stale fallbacks, regressions.

**New code under test (r11 adjudication batch):** `settleNowMs` clamped `Math.min(lastSavedAt + elapsed*1000, Date.now())`; `settleAutoFarmOffline` writes the anchor BEFORE the payout loop AND bounds the window by `min(caller elapsed, now - lastCheckedMs)`; `QuestManager.restore` clamps future `lastDailyResetAtMs` to now; `drawFromPool` throws on non-finite total; cold-boot restore routes through `calculateOfflineTime`.

**Verdict: 0 Critical / 0 High / 2 Medium (both residual/pre-existing, not introduced by f04b6fe2) / 1 Low / 2 Nit.** All five r11 changes verify clean on every attack line. The Mediums are adjacent crafted-timestamp holes in the same mint class the batch deliberately closed, left open on two seams the fixes did not reach.

## Findings

### R12-COR-1 — `elapsedOfflineSeconds > 60` gate lets a crafted save bypass the new anchor-bound settle: `tickAutoFarm` mints up to 24h at FULL live rate (2× the offline-50% ruling)

**Severity: Medium — flagged PRE-EXISTING / residual, same class as the r11 crafted-timestamp fixes**
**Class:** edge case / broken contract between two accrual channels
**Evidence:** SOURCE_PROOF

`src/core/game/GameManagerSaveRestore.ts:403` — the whole production/decompose/auto-farm settle block runs only when `elapsedOfflineSeconds > 60`. For `elapsed <= 60` only `timeAuthority?.kind === 'live-replacement'` gets the `settleAutoFarmOffline(player, 0)` re-anchor (`:433-437`) — and that kind is never constructed today (see N-01). `reconcileAutoFarmRuntime(offlinePlayer)` then re-arms the farm lease UNCONDITIONALLY (`:444`).

Crafted payload: `lastSavedAt = now - 30s` (elapsed = ~0, passes `isFiniteNumber` at `saveShapeValidation.ts:2215`) + `autoFarmStage.lastCheckedMs = now - 24h` (passes — `lastCheckedMs` requires only a non-negative finite number, `saveShapeValidation.ts:2299`). Restore takes the `elapsed <= 60` route → the anchor-bound settle never runs → reconcile re-acquires the lease → `tickAutoFarm` (`GameManagerAutoFarmOps.ts:344`) pays `min(now - lastCheckedMs, 24h)` cycles at FULL rate — `AUTO_FARM_OFFLINE_EFFICIENCY` is intentionally absent from the tick.

Same gap through the `> 60` route would pay `24h * 0.5` once and consume the anchor. Through the `<= 60` route it pays `24h * 1.0` and launders the offline window into "live" accrual — the exact 2× mint class the batch closed for alchemy (settleNowMs clamp) and future anchors (re-anchor arm). The `<=60` gate skipping the *payout* is correct; skipping the *anchor-consume* is what leaves the hole.

Honest-path note: for a real armed farm `lastCheckedMs ~= lastSavedAt`, so a sub-60s reload pays only the few seconds of true gap at live rate — correct live accrual, ~zero honest impact. The finding is the crafted-anchor route.

**Suggestion:** for `elapsed <= 60` on legacy/cold-boot restores, run the same zero-payout re-anchor the live-replacement arm uses (`settleAutoFarmOffline(player, 0)` re-anchors to `now` when the farm is armed — it already pays nothing on a 0 window), or drop the `kind === 'live-replacement'` condition so every sub-60s armed farm re-anchors; keep the payout settle inside the `> 60` gate unchanged.

### R12-COR-2 — Timed-effect liveness keys on `expiresAtMs` alone while the only temporal coherence bound trusts editable `lastSavedAt` — forged future save marker legitimizes a ~30-day TLT buff; pill regen channel has no duration bound at all

**Severity: Medium — pre-existing, same trust-class the batch attacked**
**Class:** edge case / crafted-payload contract hole
**Evidence:** SOURCE_PROOF

Liveness is `expiresAtMs > now` only: `getActiveCultivationSpeedPercent` (`src/core/economy/TuLinhTranBalance.ts:46-58`) and `GameManagerPersistentEffectOps.ts:281,359` never read `appliedAtMs`. The one coherence check is `appliedAtMs <= player.lastSavedAt` (`saveShapeValidation.ts:1478-1490`, comment F-TC9-1 itself notes "liveness keys on expiresAtMs alone so a future-dated window mints a live buff") — and `lastSavedAt` needs only `isFiniteNumber` (`:2215`).

Crafted: `lastSavedAt = now + 30d` → `appliedAtMs = now + 29d`, `expiresAtMs = appliedAtMs + 24h` satisfies the F-TC8-8 span bound (`expiresAtMs - appliedAtMs <= TU_LINH_TRAN_DURATION_MS`) and the appliedAtMs bound → a `tu_linh_tran` effect live NOW for ~30 days at +25% cultivation speed — paid on every online tick and through `splitCultivationSpeedWindow` on future offline accruals, plus `hasLiveTlt` (`saveShapeValidation.ts:810-812`) accepts the boosted `cultivationPerSecond` snapshot for the whole forged horizon. The writer mints 24h; the crafted save mints 30× that.

Sibling sub-finding (same trust class, no forge needed): the pill-regen channel validates the modifier magnitude (`flat <= mpPerSecond x 1.5`, `:1578-1602`) but explicitly does NOT bound `expiresAtMs - appliedAtMs` (`:1559-1561` — deliberate, stackable refresh legitimately widens it). An honest `lastSavedAt` + `appliedAtMs = now - 1s` + `expiresAtMs = now + 10y` passes validation outright — a permanent authored-rate regen buff. Validation cannot distinguish crafted-10y from legitimately-restacked.

**Suggestion:** bind `appliedAtMs <= lastSavedAt <= now + tolerance` (a future `lastSavedAt` should fail validation, not merely clamp downstream), or add `appliedAtMs <= loadNow` per effect; for regen, cap `expiresAtMs <= appliedAtMs + authoredDuration * maxHonestStacks` or `<= loadNow + authoredDuration` — stacking refreshes from now can never produce a window extending past now by more than one authored duration.

### R12-COR-3 — `DecomposeSystem.restore` merges unconditionally — live `started`/`nextCycleAt` leak into a different-payload restore

**Severity: Low (dormant — the cross-payload restore kind is never constructed)**
**Class:** restore semantics / stale-state leak
**Evidence:** SOURCE_PROOF

`src/core/production/DecomposeSystem.ts:255-261` — `nextCycleAt = max(this.nextCycleAt, restoredDeadline)` and `started = this.started || saved.started`. For a same-payload retry this is harmless (merge of identical values = idempotent, matching the retry-safety design). For a restore carrying a DIFFERENT payload over a live decompose run, live state survives into the new save's world: `started` stays true with a live `nextCycleAt` even if the incoming save never started decomposing. Today unreachable — the only constructed authority kind is 'cold-boot' (fresh boot, empty live state, `useAppLifecycle.ts:458-466`); 'live-replacement' is never built (N-01), so no cross-payload restore path exists. If that path is ever wired (remote save replaces a live session), the merge semantics would need a payload-identity check like the store's `lastRestoredPayloads` / manager's `lastAppliedPayloadHash` guards. Sibling restores do the right thing: `ProductionSystem.restoreStates` (`:129-153`) and `AlchemySystem.restoreJobs` (`:358-366`) REPLACE wholesale.

## Lows / Nits

- **N-01 — `RestoreTimeAuthority` kind 'live-replacement' is never constructed (Nit, dead path).** `saveTypes.ts:264-266` declares it and `GameManagerSaveRestore.ts:376,433` handles it, but the only construction site is `useAppLifecycle.ts:461` (`kind: 'cold-boot'`). The `elapsed=0` re-anchor arm it exists for (`:433-437`) is unreachable — which is precisely why R12-COR-1's hole is open on the `<=60` route. Either wire it (remote live replacement) or extend the re-anchor to all sub-60s restores.
- **N-02 — mid-restore crash + same-payload retry duplicates notification/events cosmetically (Nit).** `restoreFromSave` pushes bag-overflow/auto-dissolve notifications (`GameManagerSaveRestore.ts`) and settles emit `pendingEvents`/`farm_cycle` into `notifications`/EventBus per attempt; the notification queue and event stream are not part of the cleared/replaced state on retry. Payouts stay exactly-once (bags cleared, anchor consumed, hash guards); only duplicate toasts/log lines reach the UI. Cosmetic.

## Verified clean — r11 changes and attack lines checked end-to-end

- **`settleNowMs` clamp — clean, correct direction.** `GameManagerSaveRestore.ts:396-399`: `min(lastSavedAt + elapsed*1000, Date.now())`. Honest saves: `lastSavedAt + elapsed == now` → no clamp effect. Crafted future `lastSavedAt`: `elapsed = 0` (calculateOfflineTime's `currentTime = max(lastOnlineAt, now)`) → `settleNowMs = now` → the unconditional `alchemySystem.settleOffline(..., settleNowMs)` (`:454`) can no longer complete future-dated jobs early — closes R11-COR-1's mint. Crafted past-dated `lastSavedAt` yields a backwards `offlineSinceMs = lastSavedAt` (`:400`) → production/decompose windows `[lastSavedAt, now]` are the honest span — underpay-safe direction only.
- **Anchor-before-loop + anchor-bounded settle — clean.** `GameManagerAutoFarmOps.ts:256-293`: non-finite/negative/future `lastCheckedMs` re-anchors to `now` first; `effectiveSeconds = min(capped, anchorGap)`; `lastCheckedMs = now - (elapsedMs - completedCycles*cycleMs)` lands BEFORE the reward loop → a mid-loop throw consumes the anchor → a same-payload retry mints ~0 (pinned by `fixpointR11IntEvidence.qa.test.ts`). **Honest invariant verified:** `buildGameSave` stamps `player.lastSavedAt = Date.now()` itself at save time (`SaveSystem.ts:344`), so every honest save has `lastCheckedMs <= lastSavedAt` → `anchorGap >= elapsed` → the bound never underpays an honest window; `lastCheckedMs > lastSavedAt` is only reachable via crafted payload → pays ~0, correct fail-closed. **No caller relies on elapsed > anchorGap**: the only `elapsed < gap` case is the retry, which is the design. `elapsed=0` (live-replacement arm) → `elapsedMs=0`, `completedCycles=0`, anchor = `now` — pure re-anchor, no cycles.
- **Armed-mid-session attack line — clean.** `lastCheckedMs < lastSavedAt` (armed long before save): `anchorGap` covers the whole window → full caller `elapsed` paid at 50% — unchanged semantics. `lastCheckedMs > lastSavedAt`: crafted-only → bounded to ~0.
- **`QuestManager.restore` future-clamp — clean.** `QuestManager.ts:181-188`: `min(lastDailyResetAtMs, Date.now())` — a crafted future stamp can no longer freeze daily resets (`dayBucket(now) <= dayBucket(future)` forever); clamp-to-now reads as "just reset" (honest direction) while `0` would have granted a free reset. `checkAndResetDaily` (`QuestSystem.ts:470-488`) consumes it correctly; `utcDayBucket` shared with the insight ledger — no future-bucket hole (`settleIdleSkillInsightMint` rolls `dayBucket !== today`, minted value is client data, capped daily).
- **`drawFromPool` non-finite throw — clean.** `resolveDrops.ts:81-86` fires before the fall-through (which previously paid the LAST entry on NaN). Reachable via authored data? No — every pool weight is a static literal in `StageDropTables`/`FamilyDropTables`; no save path mutates them, so the throw is unreachable through validated loads and correctly fail-closed for hand-authored data. `total <= 0 → undefined` preserved; `poolDrawChance === 0 → Infinity` miss weight → always-miss — consistent.
- **Cold-boot via `calculateOfflineTime` — clean.** `GameManagerSaveRestore.ts:375-386`: cold-boot computes elapsed from the server window `{sinceMs, untilMs}` (Infinity cap — each channel applies its own cap downstream), legacy computes `{lastOnlineAt: lastSavedAt ?? now}` to `now` — same single arithmetic owner, same `max(0, ...)` direction; the honest equivalence `until - since == now - lastSavedAt` holds when server and payload epochs agree. Cold-boot IS reachable (`remoteAuthoritative && loaded.serverAuthority`, `useAppLifecycle.ts:459-466`). A client clock behind server yields `lastSavedAt + elapsed > now` → `settleNowMs` clamped → pays to now only (authorized), jobs finish via live tick — underpay-safe.
- **Retry idempotency sweep — clean modulo N-02.** Exactly-once model verified: bags cleared + `ProductionSystem.restoreStates`/`AlchemySystem.restoreJobs` REPLACE → re-settle repays into wiped containers; `player.skillInsight`/`idleSkillInsightDaily` survive on the live player but the post-fix retry settle mints ~0 → no double; `settleIdleSkillInsightMint` daily-ledger dedups at mint level. Decompose merge is same-payload-idempotent (R12-COR-3 for the cross-payload residual).
- **Stale-`now` attack line — clean.** All clamps derive `now = Date.now()` at restore time; `vi.useFakeTimers` tests share the same fake clock for both save and restore markers (the r11 evidence tests pin exactly this); a REPLAYED restore sees the store/manager hash guards skip re-apply. No `Date.now()` is captured once and compared against a later `now` anywhere in the changed surface.
- **Boundedness — clean.** `completedCycles` bounded by `min(capped, gap)*0.5/cycleMs` <= 24h/cycle; decompose `settleOffline` `while` loop bounded by the `nextCycleAt` rebase + cycle count; `totalExtraRolls` sums authored literals (1/3). No unbounded iteration reachable.

## Files changed by this audit

- `game/docs/qa/2026-10-05-fixpoint-r12-cor.md` (this file) — the only write, per read-only audit scope.
