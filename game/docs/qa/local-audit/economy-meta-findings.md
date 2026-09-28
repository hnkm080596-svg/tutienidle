# Local Audit — Slice: economy-meta

**Scope:** `game/src/core/{economy,inventory,item,equipment,artifact,alchemy,pill,material,drop,production,profession,companion,building,quest,reward,idle,events,notification,game,dev,player,world-map}` + related wiring.

**Auditor:** local primary agent (second subagent's run was cut by rate limit; this slice was completed by the primary). **Audit-only** — no production files modified.

---

### EM-01 — MEDIUM — Spirit-spring accrual is priced at the claim-time realm rate for the entire elapsed window

- **Severity:** Medium
- **Location:** `game/src/core/building/BuildingSystem.ts:343-366` (`getStoredAmount`), `:324-335` (`getEffectiveCapacity`), `:56-76` (`getSpiritSpringTargetRatePerMinute` — ~3× step per realm tier: mortal 5.5/min, qi_refining 31/min, foundation 93/min); caller `game/src/core/game/GameManagerBuildingOps.ts:224-230` passes `player.realmId` = **current** realm.
- **Root cause:** The accrued yield for the whole `[lastCollectedAt, currentTime]` window is computed with the rate/capacity of the realm the player is in **at claim time**. Realm only ever increases, so any breakthrough inside the window retroactively reprices the entire backlog at the new tier — and capacity is likewise evaluated at the new realm, so the old tier's cap doesn't constrain it.
- **Repro:** Mortal player leaves `gathering_outpost` unclaimed ~10h (at cap), breaks through to `qi_refining`, claims → payout = 10h × 31/min ≈ 18,600 stones (capacity sized at the new realm, ~10h×31/min) instead of the 10h × 5.5/min ≈ 3,300 actually produced — a ~5.6× over-grant per breakthrough. UI `getBuildingStoredAmount` (`GameManagerBuildingOps.ts:249-262`) shows the same inflated number, so it is claimable, not just displayed.
- **Impact:** Bounded over-grant (≤ one breakthrough per window; ×~3 per tier step) on the offline spirit-stone engine; the intended "5% of online farm" anchor (`:40-45`) is violated across breakthroughs.

---

### EM-02 — MEDIUM — Offline cultivation grant uses the save-time `cultivationPerSecond` snapshot including the transient Tu Linh Tran buff — an expired buff still applies to the whole offline window

- **Severity:** Medium
- **Location:** `game/src/core/cultivation/CultivationTick.ts:29-47` — `player.cultivationPerSecond` is recomputed per tick as `base × talents × ramp × (1 + tuLinhPercent)` where `tuLinhPercent` comes from deadline-checked timed effects; `game/src/stores/player.ts:252-256` — `restoreFromSave` feeds `save.player.cultivationPerSecond` into `calculateOfflineProgress(offlineSeconds, …)` for the entire offline window (cap 24h, `game/src/core/idle/GameClock.ts:44,68`).
- **Root cause:** The buff (`TU_LINH_TRAN_DURATION_MS` = 24h, +25%, `game/src/core/economy/TuLinhTranBalance.ts:8-10`) is expiry-checked while online (`getActiveCultivationSpeedPercent`, `:39-46`) but the offline grant uses the last-saved rate for the whole window — the snapshot does not know the buff's `expiresAtMs`. The ramp/talent factors are legitimately permanent; the timed buff is not.
- **Repro:** Buff has 1h remaining; player quits; returns after 20h → grant = boostedRate × 20h instead of 1h boosted + 19h base — ~+4.75h of base cultivation gifted per occurrence (worse with stacked group effects, `sum` at `:43-45`).
- **Impact:** Bounded but repeatable over-grant on the largest single income line; also asymmetric — a buff bought then quit immediately correctly covers its own 24h, so the defect is specifically the expiry-tail case.

---

### EM-03 — LOW — Alchemy settle evaluates talent-driven success/yield bonuses at settle time, not start time — breaks the §8.2 snapshot contract retroactively

- **Severity:** Low
- **Location:** `game/src/core/alchemy/AlchemySystem.ts:325-333` (params `successBonusPercentPoints`, `pillYieldMultiplier` supplied per-tick), `:365-377` (applied at settle); same parameters on `settleOffline` `:408-422`.
- **Root cause:** The plan's snapshot contract (§8.2, enforced for `recipe/herbVariant/roomLevelAtStart`) is not extended to talent/policy inputs: a job started before a yield/success talent or buff was acquired still pays the boosted rate when it settles. `settleOffline` evaluates login-time talent state against jobs that completed hours earlier.
- **Repro:** Start a job with 90% success; acquire the yield/success bonus before it completes → settle pays as if the bonus existed at start. Offline: job completed 10h ago settles with today's talent snapshot.
- **Impact:** Small magnitude exploit/correction drift; either evaluate bonuses at `startJob` (snapshot onto `ActiveAlchemyJob`) or document settle-time semantics.

---

### EM-04 — LOW — Daily reset only clears quests unlocked TODAY — stale progress survives and merges when a daily re-unlocks later

- **Severity:** Low
- **Location:** `game/src/core/quest/QuestSystem.ts:325-334` (`checkAndResetDaily` computes `dailyQuestIds` = dailies passing `isUnlocked` today) → `game/src/core/quest/QuestManager.ts:110-116` (`resetDaily` keeps `active` entries whose questId is NOT in that set).
- **Root cause:** Progress entries for dailies whose gate is unsatisfied *today* (registry change, gate flip — realm gates are monotonic so this is mostly data-change surface) are retained; when the quest unlocks again on a later day, the retained progress merges into the new day instead of resetting.
- **Repro:** A daily whose `isUnlocked` depends on a non-monotonic gate (e.g. building level drop via save edit, or registry gate authored on a mutable field): unlock day 1, progress 8/10; gate unsatisfied day 2 (not reset); satisfied day 3 → resumes at 8/10.
- **Impact:** Narrow today (gates are effectively monotonic); flagged because the reset semantic "fresh progress each day" silently depends on the unlock set.

---

## Notes reviewed and cleared (no findings)

- `VendorSystem.sellMaterial` — atomic preflight (`canAcceptAmount` before debit, `:169-180`), grade gate (`:42-56`), sole-recipe-ingredient guard (`:92-101`), integer/zero amount rejection.
- `MaterialBag`/`PillBag` — NaN/Infinity guards, `remove` refuses insufficient/negative, overflow receipts surfaced.
- `AlchemySystem.startJob` — full validation before any mutation (atomic reserve, `:280-295`); spirit-stone cost computed once and returned for the caller to deduct identically (`GameManagerAlchemyOps.ts:123-129`); unresolved recipe/pill at settle emits a failure event rather than silently dropping the job (`:347-363`).
- `EquipmentSystem.enhance` — all costs checked before any debit (`:518-531`), pity streak + always-succeed policy (`:538-547`), modifier reapply on success.
- `BuildingSystem.build/upgrade` — cost checked before debit; `quoteUpgrade` shares upgrade's rules read-side.
- `ProductionOffline`/`WorkerLaneAdvance` — offline settle shares the same allocator + lane-advance mechanism as online tick; forfeits over-budget completions deliberately.
- `QuestManager.restore` — defense-in-depth normalization; `checkAndResetDaily` uses UTC day-buckets deliberately.
- `GameClock` — pure `calculateOfflineTime` with clamps; monotonic `Math.max` on timestamps.
