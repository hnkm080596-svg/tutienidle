# QA Fixpoint — r11 — COR (local correctness & regression) audit

**Object under audit:** branch `codex/hoa-cau-fireball-vfx` aggregate state, pinned commit `5805d962` ("qa(r10): adjudicated fixes"). Method: fresh worktree at the pinned SHA, `node_modules` symlinked in, `npm run type-check` (vue-tsc --build, clean) + scoped `npx vitest run` executed on the real tree (17 files / 120 tests on the drop+equipment+reward+autofarm+quest surface; 38 files / 876 tests on the save-restore+quest+player+services/save surface — all green). Every changed file was read end-to-end plus its producers, consumers, validation gates and sibling implementations — not the diff summary.

**Facet:** off-by-ones, wrong operators, inverted conditions, arithmetic errors, wrong constants, broken translations, dead code that still mutates, always-false conditions, unreachable branches, wrong data fields read/written, off-by-one loops.

**New code under test (r10 adjudication batch):** `EnemyReward.skillInsight` removal + `getSkillInsightReward` mastery-only; SaveRestore legacy elapsed via `calculateOfflineTime` (Infinity cap); `collect_foundation_ore_30` → `foundation_establishment_ore_decade`; `OFFLINE_EFFICIENCY` → `AUTO_FARM_OFFLINE_EFFICIENCY`; `applyFloorStatScale` `!(scale > 0)` NaN guard; `poolMissWeight` throw outside [0,1]; `itemQualityCeilingForFloor` non-finite throw; realm.ts comment corrections; shared `utcDayBucket`; `tickAutoFarm` future-dated re-anchor.

**Verdict: 0 Critical / 0 High / 1 Medium (pre-existing, not introduced by 5805d962) / 4 Low / 3 Nit.** The commit's own changes verify clean on every attack line; the Medium is an adjacent crafted-timestamp hole in the same function the commit touched, identical under the old formula.

## Findings

### R11-COR-1 — Crafted finite future-dated `player.lastSavedAt` mints instant alchemy completions through an ungated `settleNowMs` (pre-existing; same class as the r10 INT-04 re-anchor fix)

**Severity: Medium — flagged PRE-EXISTING / out-of-commit-scope per protocol**
**Class:** edge case / broken error path / crafted-payload contract hole
**Evidence:** SOURCE_PROOF

`src/core/game/GameManagerSaveRestore.ts:368-383` — for the legacy (no `timeAuthority`) branch, a crafted `save.player.lastSavedAt` in the future yields `elapsedOfflineSeconds = 0` (`calculateOfflineTime` clamps `currentTime = max(lastOnlineAt, now)` → elapsed 0 — identical to the old `Math.max(0, now − last)` branch), so the `> 60` gate at `:389` correctly skips the production/decompose/auto-farm settles. But `settleNowMs = lastSavedAt + elapsed×1000 = lastSavedAt` — a **future** timestamp — is then passed unconditionally into `alchemySystem.settleOffline(...)` at `:447`. `AlchemySystem.settleOffline` → `tick(nowMs)` (`src/core/alchemy/AlchemySystem.ts:554-557`) completes every job with `completesAtMs <= nowMs`: all pending alchemy jobs finish instantly — a save-edit pill mint.

Reachability: `validateGameSaveShape` requires only `isFiniteNumber(player.lastSavedAt)` (`src/services/save/saveShapeValidation.ts:2215`) — no `<= now` bound, so a finite future value survives `loadGame()/importSaveRaw()` (`SaveSystem.ts:516,750`) and the whole `restoreFromSave` chain passes `timeAuthority` as optional (`SaveSystem.ts:293-297`), landing on the legacy branch. Amplifier: the same inflated `lastSavedAt` also *loosens* the "impossible timestamp" validators `startedAtMs/appliedAtMs/expiresAtMs > lastSavedAt` (`saveShapeValidation.ts:811,1484-1489,3334,3567`) — every persisted timestamp reads as in-the-past against it.

Not a regression of this commit — the pre-5805d962 formula produced the identical `settleNowMs`. But it is the same crafted-timestamp mint class the batch deliberately closed for auto-farm (`tickAutoFarm` `lastCheckedMs > now` re-anchor, INT-04), left open on the alchemy channel because that settle runs outside the elapsed gate.

**Suggestion:** bound the settle window end to the wall clock — `settleNowMs = Math.min(lastSavedAt + elapsed×1000, Date.now())` for the legacy branch (cold-boot's server-stamped bound stays), or extend shape validation with `lastSavedAt <= loadedAt + tolerance`; short of that, gate `alchemySystem.settleOffline` on the same elapsed window the other settles use.

### R11-COR-2 — `tickAutoFarm`'s new `lastCheckedMs > now` re-anchor arm has no regression pin

**Severity: Low**
**Class:** missing regression coverage
**Evidence:** SOURCE_PROOF

`src/core/game/GameManagerAutoFarmOps.ts:311-315` adds a third re-anchor condition (`lastCheckedMs > now`). The arm is reachable through shape-valid saves (`autoFarmStage.lastCheckedMs` requires only a non-negative number — `fixpointR10IntEvidence.qa.test.ts:138-140` authors exactly this state by direct mutation), i.e. it is a live user-facing path, not dead defense. `GameManager.autoFarmOffline.test.ts` / `.autoFarmAdversarial.test.ts` / `.autoFarmRestore.test.ts` pin stale-past and NaN anchors only — no spec asserts the future-dated re-anchor or its accrual resume.

### R11-COR-3 — `applyFloorStatScale` admits `scale = Infinity` — the NaN guard's contract is "reject invalid", but non-finite positive slips through

**Severity: Low (pre-existing semantics; unreachable via validated data)**
**Class:** edge case / incomplete guard
**Evidence:** SOURCE_PROOF

`src/core/enemy/EnemyStatInput.ts:348-351` — `!(scale > 0)` correctly rejects NaN and `<= 0`, but `Infinity > 0` is true, so `scale = Infinity` proceeds past `scale === 1` into `stats × Infinity` → `maxHp/might/defense/accuracyRating = Infinity`. The old `scale <= 0` guard admitted Infinity identically — no regression — but the new guard comment claims invalid-scale rejection while the hole persists. Unreachable via authored data (`defineChapterStages` enforces 10 positive-finite `floorStatScales`, `src/data/stage/ChapterStages.ts:130`); only a hand-built `Stage` reaches it. **Suggestion:** `!Number.isFinite(scale) || scale <= 0` (or `!(scale > 0) || !Number.isFinite(scale)` — NaN already covered) for a single-expression finite-positive contract.

### R11-COR-4 — `poolDrawChance` is writable on `FamilyDropTable` but silently ignored — the new throw can't fire on an unread field

**Severity: Low (pre-existing contract hole)**
**Class:** dead data that still advertises a contract / always-silent branch
**Evidence:** SOURCE_PROOF

`DropTable.poolDrawChance?: number` (`src/core/drop/DropTable.ts:64`) is inherited by `FamilyDropTable` (`:67`), but `resolveDrops` reads only `input.stageTable?.poolDrawChance` (`resolveDrops.ts:199`). An author setting `poolDrawChance` on a family table gets no gate, no validation, and — post-commit — no throw either: the fail-closed guard at `:119-121` can only fire on the stage field. Dead-advertised surface; today no family table authors it, so zero live impact. **Suggestion:** remove the field from the family type (`Omit<DropTable,'poolDrawChance'>` semantics) or honor/read it deliberately.

### R11-COR-5 — Drop-table floor and quality-ceiling floor resolve differently for `floor`-less stages; the "same floor" invariant holds only by `defineChapterStages` normalization

**Severity: Low (pre-existing; unreachable via live data)**
**Class:** contract gap / inconsistent resolution
**Evidence:** SOURCE_PROOF

`BattleLootSystem.ts:291` calls `stageDropTableFor(realmId, stage?.floor)` — the table resolves `floor ?? 1` internally (`StageDropTables.ts:101`), while `grantResolvedDrops` computes the ceiling floor as `stage.floor ?? stage.requiredRealmLevel ?? 1` (`:384`). For a stage with `floor` undefined but `requiredRealmLevel = N`, the drop **table** resolves floor 1 and the quality **ceiling** resolves floor N — the comment's "ceiling and table always resolve the same floor" fails. All live stages come from `defineChapterStages`, which stamps `floor` on every entry (`ChapterStages.ts:148-159`), so the gap needs a hand-authored/debug stage to fire. **Suggestion:** pass the already-resolved `stage.floor ?? stage.requiredRealmLevel` into `stageDropTableFor` so both read one expression.

## Lows / Nits

- **N-01 — `fixpointR10IntEvidence.qa.test.ts` now misdescribes itself (Nit, stale comments).** Header (`:4-7`) says the probes "pin the current aggregate behavior, including the parts that are currently WRONG… Failing assertions below are the repro"; INT-01's comment (`:82-84`) says "CURRENT FAIL: collect_foundation_ore_30 requires qi_refining_ore_decade" — post-fix all probes pass on the corrected state. Header/describe also keep the retired `OFFLINE_EFFICIENCY` name (`:17`, `:120`). Cosmetic only; consider retitling to "regression pins".
- **N-02 — `FoundationEnemies.ts:24-25` comment still claims foundation beasts drop `qi_refining_ore_decade` (Nit, stale comment, pre-existing).** The live band pays `foundation_establishment_ore_decade` (`StageDropTables.ts:88`); the comment contradicts shipped data — already cited as corroborating staleness in r10-int, still unfixed.
- **N-03 — `collect_foundation_ore_30` progress counter is material-agnostic (Nit, inherent).** `onMaterialCollected` increments a bare count (`QuestSystem.ts:550-560`), so pre-swap progress earned on `qi_refining_ore_decade` carries into the retargeted quest; `claim` correctly debits the NEW material (`:383`). Unavoidable without a progress migration; the residual effect is at most a partial head start on an honest quest.
- **N-04 — `scaleQuestRewardByRealm` scales `spiritStone`/`cultivation` but passes `skillInsight` unscaled (Nit, undocumented asymmetry).** `QuestSystem.ts:197-203` — presumably deliberate (quest insight amounts are already authored tier-escalating: 400 → 40_000), but the exemption carries no comment. Pre-existing, unchanged by this commit.

## Verified clean — attack lines and commit claims checked end-to-end

- **`EnemyReward.skillInsight` removal — clean.** Zero remaining `skillInsight` keys inside any `EnemyReward` literal or `enemy.rewards` read (all `rewards:` literals in `src/data/enemy/{MortalEnemies,FoundationEnemies,HiddenBeasts}.ts` and `BattleLootSystem.ts:322` carry only `techniqueMastery`/`spiritStone`); `getSkillInsightReward`'s sole caller (`BattleLootSystem.ts:345`) feeds the drop-derived literal, so mastery-only derivation is the only path — the removal fixes real dead surface, matching r10-COR-1's ruling. Every remaining `skillInsight` ref is `PlayerData.skillInsight` (currency pool, `Player.ts:193`) or `Reward.skillInsight` (quest channel, `Reward.ts:5`) — live, unrelated fields. `vue-tsc --build` clean: no orphaned literal or member access survives.
- **Infinity-cap elapsed — clean for all reachable inputs.** For finite `lastSavedAt`, `calculateOfflineTime({lastOnlineAt}, now, +Inf)` reduces to `min(max(0, max(last,now)−last)/1000, Inf)` = the old `Math.max(0, (now−last)/1000)` — including future-dated (→0) and `?? Date.now()` self-cases. `settleNowMs`, `offlineSinceMs`, the `>60s` gate and every consumer (`productionSystem.settleOffline`, `decomposeSystem.settleOffline`, `settleAutoFarmOffline`'s own 24h self-clamp at `:242`, `alchemySystem.settleOffline`) see identical values. Non-finite `lastSavedAt` is rejected upstream (`saveShapeValidation.ts:2215`); the residual `+Infinity → NaN vs old 0` divergence is unreachable through validated loads.
- **`poolDrawChance` throw — clean.** Sole authored value is `0.15` (mortal band, `StageDropTables.ts:44`) inside `[0,1]`; `DropTables.test.ts:48-53` pins `(0,1]` for every band that sets it; throw unreachable via authored data and correctly covers NaN/`<0`/`>1`/`±Infinity`. `poolDrawChance === 0` → `Infinity` miss weight → always-miss (`drawFromPool` falls through, `missWeight > 0` → `undefined`), including the `rng()===0` `NaN` roll — consistent fail-closed.
- **`utcDayBucket` — clean.** Identical `Math.floor(ms / 86_400_000)` formula to both replaced implementations — exact-midnight boundary (`ms % 86_400_000 === 0` rolls to the new day) and negative-ms buckets are behavior-preserving. No third production day-bucket remains (`TU_LINH_TRAN_DURATION_MS` is a duration, not a bucket; remaining `DAY_MS` copies are test-side replicas of the same convention).
- **`tickAutoFarm` future-dated re-anchor — clean.** `lastCheckedMs > now` ⟺ negative elapsed: the pre-fix code computed `Math.floor(negative / cycleMs) <= 0` → early return — it could never settle cycles in that state, so the re-anchor's predicate is strictly disjoint from the settle predicate; no accrued cycle can be lost (legit clock-skew/multi-device cases only resume accrual earlier instead of idling until the forged timestamp).
- **`applyFloorStatScale` NaN guard — clean.** `!(scale > 0)` ≡ `scale <= 0` for every non-NaN input; authored `statScale` is validated positive-finite at `defineChapterStages` (`ChapterStages.ts:127-131`) — guard unreachable via data, correct when smuggled.
- **`itemQualityCeilingForFloor` throw — clean.** Callers pass normalized authored floors (`stage.floor ?? stage.requiredRealmLevel ?? 1`, finite 1..10); `undefined` still returns `undefined` (ungated) unchanged.
- **`AUTO_FARM_OFFLINE_EFFICIENCY` rename — clean.** Zero code references to the bare old identifier; cultivation/production/decompose settle paths never imported it; remaining mentions are two comments in the r10 evidence test (see N-01).
- **`realm.ts` comment corrections — clean.** `70×18 + sum(0..17)=153` → `1260+153 = 1413` min ≈ 23.6h; `550×18+153` → `9900+153 = 10053` min ≈ 6.98 days — arithmetic verified against `getRequiredCultivation`'s `base + level − 1` per-level series.
- **Quest ore swap — clean.** `foundation_establishment_ore_decade` is a real generated registry id (`buildProfessionMaterialId('ore','foundation_establishment','decade')`, `foundation_establishment ∈ REALM_TIERS`); it is dropped by the foundation band the quest's realm gates to (`StageDropTables.ts:88`, w15, 1–2 per draw), and `onMaterialCollected` → `materialBag.has` → `claim`'s `remove` is coherent end-to-end (`QuestSystem.ts:335,383,550-560`). `collect_qi_refining_ore_decade_1` correctly still targets `qi_refining_ore_decade` (qi band, `:65`, w30). No pin/test/data still binds `collect_foundation_ore_30` to qi ore — `betaScopeLockV2.test.ts:374` is a synthetic policy literal, `EnemyDropSinkInvariant.test.ts:123` asserts sink coverage of the still-live qi ore.
- **Verification run:** `npm run type-check` (vue-tsc --build) — clean; `npx vitest run` scoped — 55 test files / 996 tests green on the touched surfaces (list in header).
