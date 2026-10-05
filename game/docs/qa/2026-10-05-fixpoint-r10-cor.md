# QA Fixpoint — r10 — COR (local correctness & regression) audit

**Object under audit:** branch `codex/hoa-cau-fireball-vfx` aggregate state, pinned commit `e4df599c`. Method: fresh worktree on detached HEAD, `node_modules` symlinked in, `npm run type-check` + scoped `npx vitest run` executed on the real tree (see evidence). 166 files differ from merge-base `bf95edab` (~9851 insertions). Every focus surface was read end-to-end at the pinned SHA — producers, consumers, and save/schema edges — not the diff summary.

**Facet:** incorrect conditions, invalid state transitions, null/undefined handling, calculation errors, async/race, lifecycle/cleanup, stale state, broken error paths, edge cases, migration gaps, stale fallbacks, missing regression coverage.

**Verdict: 0 Critical / 0 High / 1 Medium / 2 Low / 2 Nit**

## Findings

### R10-COR-1 — Authored `EnemyReward.skillInsight` override is dead code (incomplete band-system migration); authored `spiritStone`/`techniqueMastery` on `Enemy.rewards` are also orphaned from the mint path

**Severity: Medium**
**Class:** stale fallback / incomplete migration / broken contract
**Evidence:** SOURCE_PROOF + git lineage

**Mechanism.** `Enemy.rewards: EnemyReward` (`src/core/enemy/Enemy.ts:78`) documents `skillInsight?: number` at `:39-45` as a per-enemy override — "undefined thì suy ra từ techniqueMastery qua getSkillInsightReward()". `getSkillInsightReward` (`src/core/reward/SkillInsightBalance.ts:25-28`) still checks `reward.skillInsight !== undefined` first. But the only caller, `BattleLootSystem.ts:345`, passes `rewards` built at `:322-325` as a FRESH `{ spiritStone, techniqueMastery }` object derived from `resolveDrops` output — `enemy.rewards.skillInsight` is never copied in, so the override branch is unreachable.

Git lineage makes this a migration gap, not a design decision: `f10edc11` ("BattleLootSystem consumes DropResult") replaced `rewards = { ...enemy.rewards, spiritStone: …, techniqueInsight: … }` (spread preserved authored fields) with the drops-derived literal. Authored `skillInsight`, `spiritStone`, and `techniqueMastery` on `Enemy.rewards` all silently lost their kill-mint effect at that commit.

**Concrete trigger path.** Any enemy definition that authors `rewards.skillInsight` (e.g. `0` to suppress the band mint, or a fixed bounty) — the authored value is ignored; mint is always `round(drops.techniqueMastery × 0.018)` × realm multipliers.

**Expected vs actual.** Expected: authored `skillInsight` overrides the derived value, per the documented contract and `getSkillInsightReward`'s signature (`Pick<EnemyReward,'techniqueMastery'|'skillInsight'>`). Actual: the field is dead — both suppressing (`0`) and boosting (`N`) writes are silently ignored.

**Live impact today.** None on minted amounts: `co_thu` (the only enemy authoring `skillInsight: 0`, `src/data/enemy/HiddenBeasts.ts:73-77`) is `undefeatable`, so no kill path ever runs it; `huyet_mong` authors `rewards: {techniqueMastery: 500, spiritStone: 150}` (`:30-33`) which likewise never pays — its kill mints the host stage's band values instead (it substitutes into a stage wave via `StageWaveSystem.maybeReplaceSpawn` → same `resolveDrops` stage table). `enemy.rewards.techniqueMastery` retains ONE live consumer: `ArtifactProgression.ts:69` (`max(1, floor(tm × 0.25))` artifact EXP).

**Residual risk.** Any future authored `skillInsight` is silently ignored — the data shape still accepts it, the type still advertises it, and no validation or test catches the gap. Two coherent repairs: wire `enemy.rewards.skillInsight` into the mint object (preserve authored 0 as a real suppression channel), or retire the field + the dead branch and delete the contract comment. Coordinator ruling needed on which semantic was intended.

### R10-COR-2 — FOUNDATION `floorStatScales` ladder is non-monotonic: floor 8 (1.15) sits below floor 7 (1.2)

**Severity: Low**
**Class:** data anomaly — possibly authored lull, reads like a transposition
**Evidence:** SOURCE_PROOF

`src/data/stage/Stages.ts:148` — `floorStatScales: [0.6, 1.0, 1.05, 1.15, 1.15, 1.15, 1.2, 1.15, 1.3, 1.7]`. Index 7 (floor 8) = 1.15 < index 6 (floor 7) = 1.2. `statScale` multiplies hp/might/defense/accuracy at spawn (`applyFloorStatScale`), so floor 8's wall is ~4% weaker than floor 7's on every scaled stat — a deeper floor is measurably easier than its predecessor.

The mortal (`[1.0, 1.2, 1.4, 1.5, 1.6, 1.65, 1.75, 1.9, 1.95, 2.0]`) and qi (`[1.0, 1.0, 1.3, 1.55, 1.85, 2.15, 2.45, 2.7, 3.0, 3.6]`) ladders are strictly non-decreasing; foundation is the sole dip. Could be an authored breather before the f9/f10 wall (1.3/1.7) — or the 1.15 belongs at index 5 and index 7 should be higher. Flag for ruling; the value is not pinned by `StatWall.test.ts` (which asserts f3=1.3 and f10=3.6 on the qi chapter only).

### R10-COR-3 — Idle insight daily ledger is ONE shared counter while the cap is resolved per enemy realm — mint order across bands can starve a band

**Severity: Low** (design ambiguity — needs ruling, may be intended)
**Class:** edge case / contract ambiguity
**Evidence:** SOURCE_PROOF

`settleIdleSkillInsightMint` (`SkillInsightBalance.ts:68-88`) keeps a single `player.idleSkillInsightDaily.minted` shared across realms, but picks the cap by `enemyRealmId` at mint time: `min(requested, cap(enemy.realmId) − minted)`. Sequence: idle-farm a foundation stage → minted 35,000 (cap 40k); switch to a qi stage → qi cap is 30,000 < minted → every qi kill mints 0 for the rest of the UTC day. Conversely qi-then-foundation pays fully. The code behaves as "one daily pool, sized by whichever band the killed enemy belongs to" — NOT "each realm band carries its own quota". If the ruling ("cap cam ngo auto-farm 1 ngay") meant one daily pool, this is correct and this finding is informational only; if it meant per-band quotas, the ledger needs per-realm buckets. Flag for ruling.

### R10-COR-4 — realm.ts pacing comments drifted 18 minutes on both retuned realms (stale arithmetic, values themselves correct)

**Severity: Nit**
**Class:** stale comment
**Evidence:** SOURCE_PROOF + arithmetic

`src/data/realms/realm.ts:54` claims `70*18 + sum(0..17) = 1431 min` and `:65` claims `550*18 + sum(0..17) = 10071 min`. `getRequiredCultivation` (`realmSystem.ts:63`) computes `(base + max(1,level) − 1)` per level — the per-level series is `base+0 … base+17`, i.e. sum(0..17)=153. Actual totals: 70×18+153 = **1413** min and 550×18+153 = **10053** min — both comments are 18 min high (they wrote sum(1..18)). Purely cosmetic — the gates themselves are correct.

### R10-COR-5 — `itemQualityCeilingForFloor(NaN)` falls through every band and returns `'tien'` — fail-open on malformed floor

**Severity: Nit**
**Class:** edge case (defensive-behavior note only)
**Evidence:** SOURCE_PROOF

`ItemQualityBalance.ts:110-122`: `NaN <= maxFloor` is false for every band including `Infinity`, so a NaN/undefined-ish floor slips past the loop to the `return 'tien'` tail — the most permissive ceiling. Authored stages always carry integer floors (`defineChapterStages` stamps `index+1`), and callers pass `stage.floor ?? requiredRealmLevel ?? 1`, so this is unreachable through authored data; flagged only because the error direction is fail-open.

## Verified clean (with mechanism notes)

- **`resolveDrops` miss band** (`resolveDrops.ts:74-127`): `poolMissWeight = hitWeight × (1/p − 1)` gives `P(miss) = 1 − p` on the MERGED pool (stage+family share the gate — verified `FamilyDropTables` boar→`base_quan` entries ride inside the 0.15 gate as designed). `p ≤ 0` → `Infinity` miss weight → always-miss; `p ≥ 1`/`undefined`/NaN → ungated; `missWeight=0` → historical last-entry float fallback preserved. rng consumption order documented and consistent (miss band folds into the same draw call — no positional shift). `toResolved` rolls `amount` ranges inline immediately after selection.
- **`settleAutoFarmOffline`** (`GameManagerAutoFarmOps.ts:228-273`): `elapsed = min(max(0, elapsed), 24h) × 0.5` applied before `floor`/cycleMs → cycle rewards AND the carried remainder are uniformly halved; the re-anchor `Date.now() − (elapsedMs − cycles×cycleMs)` runs unconditionally (0-cycle path can't leave raw remainder to mint at live rate); NaN guard precedes the anchor so a corrupt `lastCheckedMs` can't poison it; `isValidCycleSeconds` gates ≥1 finite. `tickAutoFarm` mirrors: non-finite/negative `lastCheckedMs` self-heals, elapsed clamps to the same 24h cap → bounded loop, no per-tick re-pay. `rollAutoFarmCycleReward` restores `channel` to `'active'` in `finally`.
- **`idleSkillInsightDaily` ledger + save edge**: optional `{dayBucket, minted}` validated finite ≥0 (`saveShapeValidation`), lazy day-bucket roll at mint, absent field migrates lazily — no save-version bump needed. Clamp math `min(requested, max(0, cap − minted))` can't mint negative; idle-channel gate (`BattleLootSystem.ts:356-363`) holds — active channel skips ledger entirely.
- **Quest realm-band scaling parity**: claim (`QuestSystem.ts:373-376`) and beta preview (`betaScopeQuestDomain.ts:144-153`) both call `scaleQuestRewardByRealm(quest.reward.reward, questRewardBandRealmId(quest, registry))` — identical helper + resolver. Chain walk is cycle-safe (`seen` set), defaults 'mortal' on ungated/unchained/broken chains; `scaleQuestRewardByRealm` floors spiritStone+cultivation, passes skillInsight through unscaled (data re-anchored — no double-count), `Reward` carries exactly those 3 fields (nothing dropped).
- **`getRequiredCultivation` gates**: base-formula branch `(base + max(1,level) − 1) × 60 × basePerSec`; qi=70/foundation=550 bases verified against the real function (level-1 costs = base minutes exactly). XOR data contract throws loudly when neither formula field exists.
- **`stoneCostRealmFactor` fan-out**: `EconomyRealmPace` {1:1, 2:8, 3:50, >3: `50×3^(t−3)`} consumed consistently at enhance fee (`EquipmentOperationCostCatalog:79`), site upgrade (`ProductionCatalog:64`), alchemy recipes, quest scaling, `TuLinhTranBalance` — one authority, no divergent copy.
- **Tribulation defeat stone loss ×5**: `TribulationChapters.ts` qi 250 / foundation 1000 (was 50/200); `TribulationOutcomeService:439-444` clamps `min(owned, stoneLoss)` via MaterialBag partial-delivery — can over-penalize intent but never over-remove or go negative.
- **`applyFloorStatScale` + spawn wrapping**: fresh stats objects (template registry never mutated), applied AFTER tag/boss transforms on every spawn path including hidden substitution (`StageWaveSystem.ts:314-320`), `scale ≤ 0` throws loudly, `1` is identity. `floorStatScales` validated positive-finite at `defineChapterStages`; `stage.statScale` undefined → 1.
- **`ITEM_QUALITY_FLOOR_CEILING` + `AFFIX_TIER_ROLL_WEIGHT`**: ceiling bands {≤3:huyen, ≤6:dia, ≤9:thien, ∞:tien}; `rollItemQuality` filters the order to ≤maxRank and renormalizes (odds don't pile onto the ceiling). `AFFIX_TIER_ROLL_WEIGHT` 7/5/3/2/1 covers all authored affix tiers (data carries only tiers 1-5); `weightedRandom` throws loudly on empty entries.
- **`EquipmentBag` auto-dissolve**: add → dedupe → push → >500 → `autoDissolveOverflow` sorts (grade, quality, forgeUses asc), skips equipped/locked/favorite; the newly added worst item self-dissolves correctly; `ESSENCE_RANGE` covers all 5 qualities; rewards flow through one `grantAutoDissolveRewards` path (material bag add + delivered-not-requested toast + overflow event).
- **`DecomposeSystem` workers**: `updateCapacity` clamps stored workers down on CHQ downgrade; `restore` merges the deadline via `max()` (repeat-application can't double-settle a window) and clamps workers to live capacity; `settleOffline` bounds the window at `max(nextCycleAt−cycle, offlineSince, now−10h)` and advances `nextCycleAt` per settled cycle (idempotent); scope-hidden flag fails closed on get/set/tick/settle while persisting raw settings.
- **Worker pool split**: `resolveProductionWorkerCapacity` is the ONE rule — decompose claims first, production gets the remainder; consumed identically by online tick (`GameManagerTickOps:162-166`), restore settle (`GameManagerSaveRestore:394`), and the UI read model. `betaEffectiveWorkerCapacity` = 3 flat while `manualWorkforce` is scope-hidden.
- **VFX: triple-circle ring split** (`HoaCauFireballPresentation.ts:142-154`): `slotRole === 'ultimate'` → 3 rings, `empowered` → 2, else 1 — matches asset doc (inner every cast / middle joins empowered / outer ultimate-only); per-ring sprites keyed by asset slot so a higher-tier cast can't leave a stale ring visible (`cancel()` clears all; `render()` hides unshown sprites). Frame `min(63, floor(progress×64))` clamps to authored lastFrame 62 (trailing blank unreachable); `hoaCauTiming` phase-scales off `impactMs` with `min(1, …)` cap and NaN→reference fallback; `resolve()` ignores unsealed/mismatched refs; impact cues draw only on landed targets (miss → `impactElapsedMs = null`, no visual).
- **VFX: charge/azure + projectile variants**: `cast.empowered` selects `chargeEmpowered`/`phoenixProjectileEmpowered` atlases — separate texture keys per variant, no runtime tint; lab `castTier` maps tier→(empowered, slotRole) coherently (3 → empowered+ultimate).
- **MonsterArt bandit/duskmane sets**: `redscarf-blade-bandit(-ferocious)` + `duskmane-spirit-wolf(-ferocious)` atlases verified on disk — 17 idle + 1 death frames on sheet-1 matching declared `idle:[1,17,1], death:[1,1,1]`; no attack clip is legal (`CombatAnimationCatalogue.attack` optional — playback falls through to the shared lunge / recipe timing path); reskin map keys sorted longest-first for prefix matching.

## Executed verification

- `npm run type-check` — clean (0 errors) on the pinned tree.
- `npx vitest run` over the audit scope — `src/core/drop/`, `src/core/production/`, `src/core/simulation/earlygame/StatWall.test.ts`, `tests/architecture/enemyArtReskin.test.ts` (23 files / 184 tests green), then `src/core/game/`, `src/core/quest/`, `src/core/reward/`, `src/core/equipment/`, `src/core/tribulation/`, `src/services/save/` (210 files / 2217 tests + 4 expected-fail, green).
- Disk census of `public/assets/enemies/animated/{redscarf-blade-bandit,duskmane-spirit-wolf}[-ferocious]` atlases (frame counts above).

## Limitations / out-of-scope

- No Phaser-runtime render of the fireball/circle/ring phases (source-level VFX contract only; the dev lab exists for visual confirmation).
- Balance intent not audited: whether 11,000 ling-thach-3 for a foundation site L2→L3 upgrade (`100×2.2 × 50`) is reachable in beta is an economy question — the arithmetic matches the stated retune rule.
- `DecomposeSystem.updateCapacity(NaN)` yields NaN capacity → `setSetting` clamps workers to NaN → cycles no-op (fail-soft, not runaway); capacity is save-validated upstream, unreachable through authored data.
- `tickAutoFarm` with a persisted FUTURE `lastCheckedMs` (clock moved backward) stalls accrual until real time catches up — self-correcting, device-clock manipulation only.
