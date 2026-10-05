# Fixpoint R10 — INT (blind adversarial integration)

- **Reviewer**: INT — adversarial integration facet (callers, consumers, event chains, save/load round-trips, offline/online transitions, cross-feature regressions visible only assembled).
- **Target**: `codex/hoa-cau-fireball-vfx` @ `e4df599c` (aggregate state, merge-base `bf95edab`).
- **Scope attack**: idle-insight daily ledger vs offline settle ordering; OFFLINE_EFFICIENCY × unconditional re-anchor; scaleQuestRewardByRealm preview/claim divergence; poolDrawChance rng cadence; statScale ladders on authored specials; ITEM_QUALITY_FLOOR_CEILING on floorless/market paths; ring-split + azure charge on real combat paths.
- **Evidence modes**: EXECUTED_REPRO (new `tests/architecture/fixpointR10IntEvidence.qa.test.ts` — 1 intentional failure + 3 pinning probes, run under vitest, worktree `.agent-worktrees/qa-int-r10`), EXECUTED_VERIFY (source-level invariants executed), SOURCE_PROOF (file:line + trigger sequence), INFERRED (labeled).

## Verdict: PASS WITH GAPS — 1 Medium + 2 Low + 2 Nit confirmed; 1 observation

| ID | Severity | Class | Root | Surface |
|----|----------|-------|------|---------|
| F-INT-01 | Medium | REAL_DEFECT (cross-feature drift) | quest data not updated by band swap | `data/quest/quests.ts` ↔ `data/drop/StageDropTables.ts` |
| F-INT-02 | Low | REAL_DEFECT (dead production surface) | ultimate ring tier gated on a slotRole the preset can never carry | `HoaCauFireballPresentation.ts` + `HoaCauVfxAssets.ts` |
| F-INT-03 | Low | REAL_DEFECT (validation gap, crafted/corrupt saves) | `lastCheckedMs` validated only as non-negative | `saveShapeValidation.ts` + `GameManagerAutoFarmOps.ts` |
| F-INT-04 | Nit | EDGE (honest-path asymmetry) | ≤60 s restores skip settle entirely | `GameManagerSaveRestore.ts:384-418` |
| F-INT-05 | Nit | EDGE (data-only guard gap) | `applyFloorStatScale` lets NaN through | `EnemyStatInput.ts` |
| O-INT-06 | — | OBSERVATION | single shared daily ledger, cap resolved per-mint band | `SkillInsightBalance.ts` |

---

## F-INT-01 — Medium — `collect_foundation_ore_30` demands ore the foundation band no longer drops

- **Class**: REAL_DEFECT — cross-feature regression introduced by the `0848268d` band-swap (foundation pool now pays `foundation_establishment_ore_decade`) without updating the collect quest that feeds on it.
- **Root**: `src/data/quest/quests.ts:234` — `condition: { kind: 'collect', materialId: 'qi_refining_ore_decade', amount: 30 }`, `requiredRealmId: 'foundation_establishment'`, description "Nộp 30 Thập Niên Linh Khoáng thu được **từ yêu thú hậu sơn**".
- **Trigger sequence**: player enters act 3 → foundation stages roll `STAGE_DROP_TABLES` foundation band (`src/data/drop/StageDropTables.ts:88` → only `doan_bao_thach` + `foundation_establishment_ore_decade`) → `notifyMaterialGained('qi_refining_ore_decade')` never fires at foundation → quest progress stalls at whatever the player carried over → completable only by backtracking to qi stages (`StageDropTables.ts:65`). Meanwhile the foundation ore the player *does* amass cannot satisfy it, and enhance consumes that same new ore.
- **Evidence**: EXECUTED_REPRO — `tests/architecture/fixpointR10IntEvidence.qa.test.ts` > `moi collect quest co materialId trong band table cua CHINH realm quest` fails with exactly one entry: `collect_foundation_ore_30 ... but that band drops only [doan_bao_thach, foundation_establishment_ore_decade]`.
- **Corroborating staleness**: `src/data/enemy/FoundationEnemies.ts:23-25` still documents foundation beasts dropping `qi_refining_ore_decade` ("sink thật qua Cường Hóa/Tẩy Luyện + quest collect") — the very consumption path the band swap declared dead.
- **Impact bound**: quest stays completable (qi floors remain open; carried save ore still counts via `progress` + bag check at `QuestSystem.ts:332`), so it is a content-coherence break, not a hard lock. Coordinators may reasonably grade Low.
- **Fix direction**: retarget `materialId` to `foundation_establishment_ore_decade` (or split the quest to accept either ore) + refresh description/comment.

## F-INT-02 — Low — the 3rd fire-circle ring is unreachable outside the dev lab

- **Class**: REAL_DEFECT — dead production surface (render branch + authored atlas shipped but unreachable).
- **Root**: `src/game/support/skill-vfx/HoaCauFireballPresentation.ts:146-147` — `ringCount = cast.slotRole === 'ultimate' ? 3 : cast.empowered ? 2 : 1`.
- **Trigger sequence**: `isHoaCauFireballCast` requires `presetId === 'hoa_cau_comet'` (line 34-36) → the only carrier is `hoa_cau_thuat`, the fire **basic** (`SPELL_KIT_IDS.fire[0]`, `PhapTuSkills.ts:87/254`) → spell-path `resolveSpecialUltimate` returns `{ special }` only (`CultivationPathRegistry.ts:427-440`; `SPELL_KIT_IDS` is a 2-slot pair — the legacy ult is retired) → `actor.ultimate` is undefined for the path → `castSlotRole` (`SkillPresentationFacts.ts:163-171`) can never return `'ultimate'` for this preset → `ringCount` is ∈ {1,2} on every real cast; `HOA_CAU_VFX_ASSETS.fireCircleOuter` is preloaded each combat (`hoaCauCombatDescriptors()` at `CombatPreload.ts:205`) but never drawn. Only `HoaCauLabPlayback.play(..., slotRole)` reaches it.
- **Evidence**: EXECUTED_VERIFY — pinning probes in the same test file: every `hoa_cau_comet` skill sits in kit-basic position; all spell kit pairs have length 2.
- **Fix direction**: either delete the outer ring + its render branch (if ult art intentionally lab-only), or re-key the third tier to something reachable (e.g. `empowered && slotRole === 'special'`-style) — decision belongs to the author; flagging dead weight + misleading tier semantics.

## F-INT-03 — Low — `autoFarmStage.lastCheckedMs` has no plausibility bound

- **Class**: REAL_DEFECT — validation gap; reachable only with crafted/corrupt saves (honest saves always carry `lastCheckedMs` ≈ save time).
- **Root**: `saveShapeValidation.ts:2299` validates `lastCheckedMs` as a non-negative number only — no upper bound, no relation to `lastSavedAt`.
- **Trigger A (overpay)**: save with `lastCheckedMs = 0` (or `now - 24h`) → `tickAutoFarm` clamps `elapsedMs` to `DEFAULT_MAX_OFFLINE_SECONDS` and mints **a full 24 h at live rate** (`GameManagerAutoFarmOps.ts:320-335`) — exactly double the `OFFLINE_EFFICIENCY` window the offline settle pays for the same duration. EXECUTED_REPRO: probe `tickAutoFarm voi lastCheckedMs 24h truoc tra FULL rate` mints `864 × 2 = 1728` insight on the qi-band dummy stage where `settleAutoFarmOffline` would pay 864.
- **Trigger B (silent freeze)**: `lastCheckedMs` future-dated (clock skew across machines, or crafted) → `elapsedMs < 0` → `completedCycles <= 0` early-returns (`:323`) **without re-anchoring** — the farm pays nothing until wall clock passes the stamp; the `< 0` guard at `:311` only fires on a *negative timestamp itself*, not a future one.
- **Fix direction**: validate `lastCheckedMs <= lastSavedAt(+slack)` at the boundary, or clamp `elapsedMs` lower bound to 0 in the tick and re-anchor when negative.

## F-INT-04 — Nit — ≤60 s restores skip settle → the gap mints at full live rate

- **Class**: EDGE asymmetry, honest path, bounded.
- **Root**: `GameManagerSaveRestore.ts:384` gates the whole offline settle on `elapsedOfflineSeconds > 60`; the live-replacement `else if` (`:414-418`) calls `settleAutoFarmOffline(player, 0)` only for live-replacement restores.
- **Sequence**: cold-boot restore with a ≤60 s gap → no settle → `lastCheckedMs` keeps its saved (stale) value → the next `tickAutoFarm` pays the entire gap **plus** the accrued sub-cycle remainder at 100 % — i.e. ≤60 s + <1 cycle of full-rate mint where the same window at >60 s would pay 50 %. At most ~one-cycle extra per restore.
- **Fix direction**: none required unless the ruling intends the efficiency to bind from 0 s; then drop the threshold for auto-farm or always run the 0-cycle anchor.

## F-INT-05 — Nit — `applyFloorStatScale` admits NaN statScale silently

- **Class**: EDGE — data-guard gap (authored ladders verified finite-positive; custom/future stage data could slip).
- **Root**: `EnemyStatInput.ts` — `applyFloorStatScale` throws on `scale <= 0` and early-returns on `=== 1`; `NaN` passes both guards and multiplies into `maxHp/might/defense/accuracyRating` → `currentHp: NaN` entities (degenerate/unkillable) on any spawn path wrapped by `StageWaveSystem` floorScale.
- **Fix direction**: `Number.isFinite(scale)` guard (fail-closed to 1 or throw).

## O-INT-06 — observation — one ledger, per-mint band resolution

- `idleSkillInsightDaily` is a **single** player ledger; the cap is resolved per mint from the killed enemy's `realmId` (`BattleLootSystem.ts:357`, `SkillInsightBalance.ts:82-84`). A day mixing qi kills (cap 30 000) then foundation kills (cap 40 000) lands up to 40 000 — the *last* mint's band sets the ceiling over the *shared* counter. Reads as intended ("daily realm-band quota on the player") but if the design meant per-band buckets, the counter straddles. No code change implied; flagged for adjudication.

---

## Verified-clean attack lines (evidence in place, no defect)

- **Offline settle runs through the idle channel** — `rollAutoFarmCycleReward` wraps `setChannel('idle')` in try/`finally setChannel('active')` (`GameManagerAutoFarmOps.ts:357-398`); `settleIdleSkillInsightMint` gates on `this.channel === 'idle'` (`BattleLootSystem.ts:356`) → the daily cap does bind offline mints.
- **Double-pay re-anchor verified** — unconditional `lastCheckedMs = now - (elapsedMs - completedCycles·cycleMs)` on the halved window (`:272`); `Number.isFinite(elapsed)` bail precedes it (`:240`); executed probes confirm 240 s→1 cycle+20 s carry, 10 s→5 s halved carry, NaN no-poison (existing `GameManager.autoFarmOffline.test.ts` suite + new probes).
- **Settle idempotence across crash**: settle mutates only the in-memory restored player before any save write; a dead process loses mint+ledger together → next boot replays the same window cleanly — no double-pay.
- **Quest preview ↔ claim parity** — the only production surface caller (`GameManagerQuestOps`) passes `questRegistry` to both `getBetaQuestSurfaceModels` and `claim` → both run the same `scaleQuestRewardByRealm(questRewardBandRealmId(...))`; locked-chain preview carries gates only (no reward numbers to diverge); registry-miss/cycle → `'mortal'` (factor 1, bounded).
- **poolDrawChance rng cadence** — every pool draw consumes exactly one `rng()` call, miss folded inside the same draw (`resolveDrops.ts drawFromPool`); `1 + extraRolls` draws identical count regardless of hit/miss; signature/guaranteed lines run before pool draws unchanged.
- **statScale composition** — applied after elite/boss/hidden-beast transforms on every `pickEnemyForSpawn`/`pickEnemyForTurnSpawn` path (incl. boss gate floor 10, tinh_anh stack, hidden substitution which beta stages never declare → unreachable by data, not by luck). `applyBossMultiplier` composes before the floor scale — multiplicative, intended.
- **Gear ceiling** — `itemQualityCeilingForFloor` feeds `createEquipmentInstance` `maxQuality` on the only production mint path (`grantResolvedDrops`, `BattleLootSystem.ts:541-569`); `obtainEquipment`/`createEquipmentInstance` without `maxQuality` are lab-only. `applyQualityBonusSteps` after the base cap is authored intent. Stage-less kills (debug `startBattleWithPlayer`, non-stage trials) resolve `floor=undefined → uncapped` — unreachable in shipped beta flows.
- **Affix tier weights** — `weightedRandom` consumes exactly one rng call (same cadence as the old `randomInt` pick); all authored affix tiers ∈ 1-5 → no zero-weight silent-first-entry case today.
- **Azure/ring assets on disk** — `charge-azure`, `projectile-empowered`, all three `circle/` atlas+png pairs exist under `public/assets/vfx/hoa-cau-thuat/`; preload descriptor enumeration (`hoaCauCombatDescriptors`) is bundle-parity-tested; missing-sheet fallback is the standard `__MISSING`-texture degrade (cosmetic, no crash).
- **Ferocious reskins** — `duskmane-spirit-wolf[-ferocious]`, `redscarf-blade-bandit[-ferocious]` registered in `MONSTER_ART` with sheet+avatar on disk; attack clip omitted → resolver falls to standby (omit-don't-declare convention, same as `streamgrudge-nymph`); longest-prefix `ENEMY_RESKIN_MAP` ordering verified safe (`ferocious_*` resolves before its base).
- **Idle settle does not leak spawned enemies** — each killed entity is `enemySystem.despawn`ed at `BattleLootSystem.ts:495` inside the same loop; registry stays bounded across 24 h catch-ups.

## Environment / reproducibility notes

- Worktree `.agent-worktrees/qa-int-r10` needed a `node_modules` symlink (`game/node_modules` → main checkout) to run vitest; evidence file lives at `game/tests/architecture/fixpointR10IntEvidence.qa.test.ts` and is committed with this report.
- Probe run: `npx vitest run tests/architecture/fixpointR10IntEvidence.qa.test.ts` → 1 failed (intentional, INT-01) / 3 passed.
- Limitations: browser runtime not exercised (INT facet covers assembled logic; Phaser visuals verified at source/asset level only). Save-schema gaps were evaluated against honest + crafted inputs separately; nothing shown reachable without a malformed save.
