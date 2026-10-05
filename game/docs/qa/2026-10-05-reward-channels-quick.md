# QA Review: reward-channels rulings (idle insight cap / offline 50% / quest realm scaling)

- Date: 2026-10-05
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `src/core/reward/SkillInsightBalance.ts`, `src/core/reward/SkillInsightBalance.test.ts`
  - `src/core/game/BattleLootSystem.ts`, `src/core/game/BattleLootSystem.idleInsight.test.ts`
  - `src/core/idle/GameClock.ts`
  - `src/core/game/GameManagerAutoFarmOps.ts`, `src/core/game/GameManager.autoFarmOffline.test.ts`,
    `src/core/game/GameManager.autoFarmAdversarial.test.ts`
  - `src/core/quest/QuestSystem.ts`, `src/core/quest/QuestSystem.test.ts`
  - `src/core/betaScopeQuestDomain.ts`, `src/core/game/GameManagerQuestOps.ts`
  - `src/core/player/Player.ts`
  - `src/services/save/saveShapeValidation.ts`, `src/services/save/saveShapeValidation.test.ts`
  - `docs/balance/2026-10-05-reward-channels.md`

## Scope and Risk Map

Changed-risk-map output: domains `combat-and-tribulation`,
`economy-and-progression`, `save-and-cloud`, `time-and-offline`;
`deepAuditCandidate: true` (two critical state boundaries, 4 domains).
`unmappedPaths`: `betaScopeQuestDomain.ts`, `GameManagerAutoFarmOps.ts`,
`Player.ts`, and the three task test files — manually routed below.

Escalation decision — NOT escalated to deep, bounded by inspection:

- **time-and-offline**: the ruling-B change is one scalar multiplier on an
  already-bounded accrual window inside the single existing offline-settle
  seam (`settleAutoFarmOffline`). No new clock, no new time owner:
  `DEFAULT_MAX_OFFLINE_SECONDS` still caps at 24h before the multiplier;
  the `lastCheckedMs` anchor and `isValidCycleSeconds` guards are
  preserved and re-pinned. The ledger addition is a lazy day-bucket roll
  using the existing `floor(ms/86400000)` convention.
- **save-and-cloud**: the new persisted field follows the repo's own
  migration-lite convention (optional `?`, explicit-`undefined` key in
  `createDefaultPlayer` so the restore whitelist keeps it, `!== undefined`
  shape validation). `buildGameSave` spreads the whole player record —
  the field rides the existing round-trip; no schema version change, no
  cloud path touched.
- **economy-and-progression / combat-and-tribulation**: the insight gate
  sits inside the existing mint block in `processDefeatedEnemies`
  (channel-gated, after the per-enemy authored override and talent
  multipliers). Quest scaling is one pure function at the single claim
  gate plus the read-model's single preview builder.
- Breadth is real but each ruling is one seam with a deterministic,
  executable oracle — every material hypothesis below was resolved by a
  pinned check rather than bounded by argument.

Manual routing of unmapped paths: `betaScopeQuestDomain.ts` →
economy-and-progression (quest read-model; one-hop consumer
`GameManagerQuestOps.getBetaQuestSurfaceModels` → quest panel preview).
`GameManagerAutoFarmOps.ts` → time-and-offline (offline settle owner).
`Player.ts` → save-and-cloud (persisted-field declaration). Test files →
evidence rows, not reviewed surfaces.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-CAP-1 | `idleSkillInsightDaily.minted` (PlayerData / BattleLootSystem) | idle-channel kill mints insight | Boundedness: idle mint/day ≤ band cap | Value mutation (cap boundary, partial remainder) | `player.skillInsight` delta stops at cap, then 0 | unit + integration (`SkillInsightBalance.test.ts`, `BattleLootSystem.idleInsight.test.ts`) | High — direct economy bound |
| INV-CAP-2 | same ledger | UTC day-bucket rolls | Monotonicity/Recoverability: `minted` never decreases within a day; stale bucket resets | Timing boundary (day+1ms, 3-day stale) | minting resumes after roll; `minted` restarts at 0 | unit pins | High — persisted counter |
| INV-CAP-3 | `skillInsight` total | manual-channel kill mints | Conservation: active channel unaffected | Reorder (manual mint while idle quota spent) | `skillInsight` still grows; `minted` unchanged | integration pin (active channel ungated) | High — ruling scope line |
| INV-CAP-4 | save/load of new field | restore / validate | Recoverability: old saves absent field pass; malformed rejected | Value mutation (non-object, negative, NaN, missing keys) | `validateGameSaveShape` issue paths | `saveShapeValidation.test.ts` block | High — persistence boundary |
| INV-CAP-5 | ledger location choice | autofarm re-arm wipes `autoFarmStage` | Repeat: cap must survive re-arm | Interruption (re-arm mid-day) | ledger lives on PlayerData, NOT on `autoFarmStage` (re-arm would wipe a stage-anchored counter) | code inspection + field placement | High — bypass vector |
| INV-OFF-1 | offline settle payout | `settleAutoFarmOffline` over elapsed | Conservation: exactly 50% of full-rate accrual | Value mutation (240s/400s windows) | `elapsedMs = capped × 0.5`; `minted === 4` for 2 deterministic QI cycles | `autoFarmOffline.test.ts` pins | High — ruling correctness |
| INV-OFF-2 | `lastCheckedMs` anchor | settle with sub-cycle remainder | Exactly-once: halved remainder must not re-mint at full rate | Reorder (settle then live tick) | anchor = `now − halved remainder` (unconditional) | re-pinned adversarial tests | High — silent full-rate leak |
| INV-OFF-3 | settle inputs | NaN / negative `elapsed` | Boundedness: no NaN poison, no backwards anchor | Value mutation (NaN elapsed; lastCheckedMs > now) | NaN → no-op; negative → anchor rebased to now | new NaN pin + re-pinned negative test | Medium — malformed save input |
| INV-QST-1 | claim payout | `claim()` on gated quest | Conservation: spiritStone/cultivation × band factor | Value mutation (×1/×8/×50) | receiver totals | `QuestSystem.test.ts` block | High — economy scale |
| INV-QST-2 | preview read-model | `betaQuestSurfaceFor` on same quest | Synchronization: preview ≡ payout | Cross-system chain (model vs claim) | same helper+resolver; stoneEntry 800 | preview parity pin | High — UI honesty (A9) |
| INV-QST-3 | ungated chain quests | band of `main_08`…`main_13`, `main_15` | Conservation: era-scale must reach gate-free chain members | Cross-system chain (`unlocksAfterQuestId`) | chained claim pays ancestor band; cycle-safe resolver stops | chain-inheritance pins ×3 | High — found + fixed in run (QA-1) |
| INV-QST-4 | insight/itemDrops in quest rewards | claim contents | Conservation: no double-count scaling | Value mutation | `skillInsight` passes through unscaled; drops authored | pinned in band tests | Medium |
| INV-RESTORE | repeated restore of saved anchor/ledger | re-restore same payload | Exactly-once: no re-mint of a settled window (learned QA-2026-09-08-001) | Repeat (restore twice) | anchors/ledger are persisted values; re-restore replays the same settled state — unchanged semantics | existing save/restore suite + unchanged ordering | High — learned pattern, verified unchanged |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | vue-tsc build, no errors |
| `npx vitest run` (scoped: `src/core/game`, `src/core/reward`, `src/core/quest`, `src/core/idle`, `src/services/save`, `src/data`, `src/core/betaScopeQuestDomain.test.ts`) | 232 files / 2,258 tests passed | post-fix state incl. chain-resolution pins |
| `npx vitest run` (full) | 950 files / 8,893 passed (12 expected-fail, 9 skipped) | post-fix aggregate state |
| `npx vitest run src/services/save/saveShapeValidation.test.ts` | 415 passed | new `idleSkillInsightDaily` blocks |
| Quest data map (`data/quest/quests.ts`) | main_01–06 mortal; main_07 + kill_wild_wolf_10 qi-gated; main_14 + 5 foundation standalones gated; main_08–13/main_15/collect rows chain-inherit | all `cadence: 'once'` — daily cadence removed by scope lock; no daily-scaling concern |
| `reward.reward` reader census | exactly 2 readers: `QuestSystem.claim` + `betaScopeQuestDomain.rewardsFor` | no third payout/preview path to desync |
| `buildGameSave` inspection | `{...detachSaveValue(player)}` — ledger rides the spread | whitelist keeps it via explicit `createDefaultPlayer` key |

## Findings

### QA-2026-10-05-1: ungated chain quests under-scaled by realm-band multiplier

- Severity: Medium
- Status: Confirmed → fixed in this diff
- Invariant: INV-QST-3 (conservation — quest payout must reflect the era
  the quest actually belongs to)
- Preconditions: first implementation derived band as
  `requiredRealmId ?? 'mortal'`.
- Reproduction: data map — `main_08_viem_ho_coc` (40 stone), `main_10`,
  `main_12`, `main_13`, `collect_tu_linh_thao_1`,
  `collect_qi_refining_ore_decade_1` have NO `requiredRealmId` yet can only
  unlock after `main_07`'s qi_refining gate; `main_15` likewise follows
  `main_14`'s foundation gate. Flat-fallback would pay them ×1 while
  equally-era quests pay ×8/×50.
- Expected: era-consistent payout (qi ×8, foundation ×50).
- Actual (pre-fix): ×1 for 6+ quests.
- Evidence: quest file data map + `isUnlocked` convention (chain
  admission via `unlocksAfterQuestId` is the codebase's own era
  mechanism for chain members).
- Fix: `questRewardBandRealmId(quest, registry)` walks the unlock chain
  to the nearest realm-gated ancestor (cycle-safe `seen` set; unresolvable
  → mortal). Used by both claim and preview.
- Test file: `QuestSystem.test.ts` (chained claim ×8 integration pin;
  resolver contract pin — transitive walk, orphan→mortal, partial
  registry→mortal; cycle-stop pin).
- Owner subsystem: `src/core/quest/`
- Blast radius: only payout amounts of ungated chained quests; gated
  quests and unchained quests unchanged.

### QA-2026-10-05-2: `||` fallback in cap-table lookup could mask an authored 0 cap

- Severity: Nit
- Status: fixed during OCR pass (before this report)
- Evidence: `TABLE[id] || DEFAULT` treats an authored `0` as missing;
  corrected to `TABLE[id ?? ''] ?? DEFAULT`.
- No runtime behavior change today (no authored 0 cap); hardened against
  a future intentional zero band.

## New or Changed QA Tests

- `SkillInsightBalance.test.ts` — ledger creation/shape, cap-boundary
  partial mint then 0, day rollover, stale-ledger roll, per-band caps +
  default.
- `BattleLootSystem.idleInsight.test.ts` — real kill-path pins: cap hit
  pays 0 on subsequent kills, active channel ungated, yesterday-ledger
  rolls, multi-entity mint.
- `GameManager.autoFarmOffline.test.ts` — rewritten for ×0.5: 240s→120s
  window, halved remainder anchor, NaN-elapsed no-op, `minted === 4`
  exact-50% counter pin.
- `GameManager.autoFarmAdversarial.test.ts` — re-pinned for halved
  remainder + negative-elapsed re-anchor.
- `QuestSystem.test.ts` — realm-band describe: ×1/×8/×50 claims,
  chain-inherited claim, resolver contract + cycle pins, preview parity.
- `saveShapeValidation.test.ts` — `idleSkillInsightDaily` reject/accept
  blocks (10 malformed rows + valid/absent/zero).

## Gaps and Residual Risk

- Ledger field laxity (Low, deferred): `minted: 1.5` / fractional
  `dayBucket` pass `requireNonNegativeNumber` — self-heals on next roll;
  same laxity as sibling persisted counters.
- Shared daily pool across bands (design note, not a defect): the cap is
  ONE daily insight pool per channel-day; hitting the qi cap then farming
  a foundation stage does not mint foundation insight until rollover.
  Matches ruling intent ("cap 1 ngày" on the channel).
- Offline mints consume the same daily pool: a 24h offline day can spend
  the whole cap before live play. Ruling-consistent (the cap is on the
  channel, not the online session).
- Insight-talent holders reach the cap sooner (cap denominates received
  insight, talents raise rate not pool) — documented, authored reading.
- No Playwright/runtime UI pass: all changed surfaces are headless domain
  logic with deterministic oracles; no Vue/Pinia/Phaser lifecycle or
  rendered-state change → lowest conclusive layer is Vitest.
- Non-ASCII in test names follows repo convention (P15 covers comments
  only; comments verified ASCII-only).

## Pre-existing Failures

`BattleLootSystem.dropResult.test.ts` — 6 failures
(`createInstance` not called: the mortal-pool ~15% `poolDrawChance`
miss-weight landed by sibling PR #150 suppresses the test's equipment
draws). Reproduced on a clean checkout of `origin/codex/hoa-cau-fireball-vfx`
@ 953d31e2 WITHOUT this task's diff — pre-existing sibling breakage,
not caused by the audited change. Routed to the coordinator for a
fix-back on the sibling's scope.

Post-rebase verification on the final pushed state (1dbb433d onto
953d31e2): `npm run type-check` clean; scoped vitest
(game/reward/quest/idle/save/drop/data) 238 files / 2,307 passed with
ONLY the 6 pre-existing sibling failures; every task-owned pin green.
