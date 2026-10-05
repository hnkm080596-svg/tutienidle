# Fixpoint r10 — AUT (authority / ownership / single-source-of-truth) audit

- Date: 2026-10-05
- Target: branch `codex/hoa-cau-fireball-vfx` pinned at `e4df599c` (aggregate state, real code only)
- Facet: authority, ownership, single-source-of-truth, dependency direction, duplicated state, domain-API bypass, cross-system side effects, Vue/Pinia/Phaser boundaries, lifecycle ownership, hidden coupling, save-schema ownership.
- Write boundary respected: docs-only; no production edits.

## Verdict

PASS WITH GAPS — the changed surfaces hold up well under an authority audit.
All headline mechanisms are single-sourced and correctly owned; findings are 1 Medium
(pre-existing) plus Low/Nit items. No Critical/High.

## Findings

### F-AUT-1 — `elapsedOfflineSeconds` bypasses the declared single source for offline elapsed time — Medium (pre-existing)

- `src/core/game/GameManagerSaveRestore.ts:371-381`
- `src/core/idle/GameClock.ts:55-86`

`calculateOfflineTime` is documented as "NGUON DUY NHAT cho viec tinh
offline-seconds trong toan bo game" (the ONLY source for offline-seconds in the
game). The restore path re-implements the rule inline:

```ts
const elapsedOfflineSeconds =
  timeAuthority?.kind === 'live-replacement' ? 0
    : timeAuthority?.kind === 'cold-boot'
      ? Math.max(0, (timeAuthority.untilMs - timeAuthority.sinceMs) / 1000)
      : Math.max(0, (Date.now() - (save.player.lastSavedAt ?? Date.now())) / 1000)
```

Mechanism: the legacy branch duplicates "now − lastSavedAt" + the zero clamp
(`Math.max(0, …)`); the cold-boot branch legitimately cannot use the helper
(its window is server-authorized `untilMs − sinceMs`, not `now − lastSavedAt`),
but the legacy branch can (`calculateOfflineTime({lastOnlineAt: lastSavedAt},
Date.now(), Infinity)`). Every downstream settle inherits whichever rule this
branch computes: production (`:388`), decompose (`:404`), auto-farm (`:413`),
alchemy (`:433`).

Consequence today is bounded — each consumer clamps its own window (24 h
`DEFAULT_MAX_OFFLINE_SECONDS` inside `settleAutoFarmOffline`, 10 h
`PRODUCTION_OFFLINE_CAP_SECONDS` inside production/decompose) — but the two
elapsed rules can silently drift: a future skew-correction or guard added to
`calculateOfflineTime` will not apply to any restore settle.

Status: pre-existing (blame lands on `dcabd316` / extraction `3f497f84`, before
this branch). Recorded per P5 pre-existing rule; not a branch blocker.

### F-AUT-2 — UTC day-bucket rule implemented privately in two domains — Low

- `src/core/reward/SkillInsightBalance.ts:52,74` (`IDLE_INSIGHT_DAY_MS` + inline
  `Math.floor(nowMs / IDLE_INSIGHT_DAY_MS)`)
- `src/core/quest/QuestSystem.ts:25,220-222` (`MS_PER_DAY` + `dayBucket(ms)`)

Same rule — "UTC day index = floor(ms / 86_400_000)" — now lives in two private
copies; the new ledger comment even says "identical to QuestSystem.dayBucket /
lastDailyResetAtMs". Both are module-private so no divergence exists today, but
this is exactly the A9 shape: one convention, two implementations, no shared
owner. If either side ever changes bucket semantics (timezone, epoch, DST-ish
concerns), the quest daily reset and the idle-insight daily cap roll on
different days with no compile error to catch it.

### F-AUT-3 — `OFFLINE_EFFICIENCY` lives in the timing authority and its name over-claims its scope — Low

- `src/core/idle/GameClock.ts:46-53`
- sole consumer: `src/core/game/GameManagerAutoFarmOps.ts:257`

The 50 % pay rate is an economy/reward rule, not a time rule; it sits inside
GameClock, which owns elapsed-time math (A2/A4 residence). More importantly,
the identifier `OFFLINE_EFFICIENCY` reads as a global offline accrual factor,
while the ruling is "auto-farm channel only" — cultivation, production,
decompose, and alchemy settle at full rate deliberately. A future author
importing `OFFLINE_EFFICIENCY` into another offline settle would silently halve
a channel the ruling left at full rate. A scoped name
(`AUTO_FARM_OFFLINE_EFFICIENCY`) or residence in the auto-farm/balance module
would encode the ruling in the type surface.

### F-AUT-4 — `applyFloorStatScale` rejects `<= 0` but lets `NaN` through — Low (nit)

- `src/core/enemy/EnemyStatInput.ts:347-350`
- consumer: `src/core/game/StageWaveSystem.ts:255-267`

`if (scale <= 0) throw` — `NaN <= 0` is `false`, so `scale = NaN` slips the
guard, `NaN === 1` is `false`, and the helper returns all-NaN stats: a
NaN-stat enemy spawns silently instead of failing at the boundary the check
was written to own. Reachable only through a hand-authored `Stage.statScale`
literal — `defineChapterStages` (`src/data/stage/ChapterStages.ts:130-132`)
already validates `Number.isFinite` and `> 0` — so blast radius is authoring
surface only, but the helper's "must be > 0" contract does not in fact exclude
NaN.

### F-AUT-5 — `poolDrawChance > 1` fails open (ungated) instead of failing loudly — Low (nit)

- `src/core/drop/resolveDrops.ts:112-114`
- pin: `src/data/drop/DropTables.test.ts` (authored range ∈ (0, 1])

`poolMissWeight` treats `undefined`, `>= 1`, or `NaN` as "ungated". An authored
`poolDrawChance: 1.5` would therefore silently disable the miss band rather
than throw. The shipped tables are pinned to (0,1] by the shape test, so this
is a latent contract hole only — but the function's documented contract
("absent/>=1 means ungated") encodes the fail-open, meaning a typo reads as
intent.

### F-AUT-6 — Daily insight cap is "ceiling of the band last touched", not a per-band quota — Nit (informational)

- `src/core/reward/SkillInsightBalance.ts:82-87`

`ledger.minted` is one counter shared across realm bands; each mint clamps
against the cap looked up by the *current* kill's `enemyRealmId`. Farming QI
(cap 30 000) then switching to TC (cap 40 000) lets the same day's total reach
40 000 — i.e. the effective daily ceiling = max cap among bands touched that
day, not a per-band budget. Always bounded by `CAP_DEFAULT` (40 000), and the
comment ("clamps at the killed enemy's realm-band quota") accurately describes
the behavior — recorded so a "per-band quota" reading cannot silently anchor a
future design on the wrong semantics.

## Verified clean (evidence, no defect found)

1. **`idleSkillInsightDaily` ownership is single-sourced.** Declared once on
   `PlayerData` (`src/core/player/Player.ts:259`) with an explicit
   `idleSkillInsightDaily: undefined` in `createDefaultPlayer()` (`:423`), so
   the restore whitelist (`stores/player.ts:333` builds the key set from
   `createDefaultPlayer()` keys) keeps it, and
   `buildGameSave`'s `...detachSaveValue(player)` spread round-trips it
   (`SaveSystem.ts:341-345`). The ONLY writer is `settleIdleSkillInsightMint`
   (`SkillInsightBalance.ts:68-89`), called only from
   `BattleLootSystem.processDefeatedEnemies` inside
   `skillInsightGained > 0 && this.player && this.channel === 'idle'`
   (`BattleLootSystem.ts:356-363`). Deliberately NOT placed on `autoFarmStage`,
   so re-arming the farm cannot wipe the day counter — correct call.
2. **Channel truth is single-sourced.** `BattleLootSystem.channel` is a private
   field (`:158`), `setChannel` is called only by `rollAutoFarmCycleReward`
   (`GameManagerAutoFarmOps.ts:359/397`) inside try/finally, so 'idle' cannot
   leak into a live battle; `beginBattle` intentionally does not reset it. The
   new `Date.now()` read happens only inside the idle gate — the active
   channel never touches wall clock (`:353-355` comment + short-circuit).
3. **`OFFLINE_EFFICIENCY` applied exactly once** (`GameManagerAutoFarmOps.ts:257`),
   before flooring into cycles; the re-anchor on the 0-cycle path carries the
   halved remainder — the ruling is implemented uniformly (window halved, not
   just cycle count). Other offline channels are intentionally un-halved with
   their own caps: cultivation via `calculateOfflineTime` + per-segment window
   (`stores/player.ts:275-306`), production/decompose at 10 h
   (`PRODUCTION_OFFLINE_CAP_SECONDS`, `ProductionBalance.ts`), alchemy by job
   deadline.
4. **Quest realm scaling shares one predicate.** Claim calls
   `scaleQuestRewardByRealm(quest.reward.reward, questRewardBandRealmId(quest, registry))`
   (`QuestSystem.ts:371-377`); the beta preview calls the same helper + resolver
   on the same registry (`betaScopeQuestDomain.ts:147-153`, deps wired at
   `GameManagerQuestOps.ts:119`). The scaler returns a NEW object
   (`QuestSystem.ts:194-200`); `Reward` carries exactly
   `{spiritStone, cultivation, skillInsight}` — `itemDrops` sits on the sibling
   `QuestReward` wrapper and is untouched, so nothing is dropped. The
   chain-walk (`questRewardBandRealmId`, `:157-178`) is cycle-safe
   (seen-set), registry-partial-safe (`has` before `get`), and fails closed to
   'mortal' on an unresolvable chain.
5. **`poolDrawChance` covers every draw path.** The miss weight folds into the
   SAME single `rng()` per draw (`resolveDrops.ts:85-99`), preserving the
   documented rng-consumption order (`:136-153`). Only `StageDropTable` may
   carry `poolDrawChance` (`DropTable.ts`), the merged stage+family bag shares
   the gate, guaranteed/signature compartments are deliberately outside it,
   and both production draws (`BattleLootSystem`) and the economy preview
   (`dropSampling.sampleDropExpectation`) route through `resolveDrops` — no
   bypass. `GameManagerStageOps.poolItems` is a read-model (strips `weight`
   for display), not a draw path.
6. **`statScale` has one consumer and validated authoring.** `StageWaveSystem`
   wraps EVERY spawn return path in `applyFloorScale` (`:255-267`) — normals,
   tinh_anh elite, floor-10 boss, hidden beast, template substitution — with
   `stage.statScale ?? 1`, applied AFTER tag/boss transforms on fresh stats
   objects (no registry-template mutation). `defineChapterStages` validates
   length/positivity/finiteness at authoring; `StatWall.test.ts` reads live
   data rather than a duplicated threshold table.
7. **Save-schema block round-trips and rejects malformed.**
   `saveShapeValidation.ts:2321-2343`: `!== undefined` gate → `isObject` →
   `requireNonNegativeNumber` on `dayBucket` + `minted`; tests pin both reject
   shapes (7, 'x', null, {}, bad fields, NaN) and accept shapes (absent,
   `{21000,12345}`, `{0,0}`). Old saves absent the field migrate-lite via
   `createDefaultPlayer()` → lazy `??=` creation at first mint.
8. **Art wiring is single-sourced and consistent.** Ring tier resolves once
   from presentation facts (`slotRole`/`empowered`,
   `SkillPresentationFacts.ts:145-147`) and is consumed once
   (`HoaCauFireballPresentation.ts:146-153`); charge/projectile azure variant
   selection uses the same `empowered` flag (`:155-178`). Manifest
   (`public/assets/enemies/animated/manifest.json`), `MONSTER_ART` variant
   ranges, and `ENEMY_RESKIN_MAP` agree for all four new variants
   (bandit/duskmane × normal/ferocious), each with `avatar.png` + `sheet-1` +
   `atlas.json`; the wiring is pinned by `tests/architecture/hoaCau*Art.test.ts`
   and `enemyArtReskin.test.ts`.

## Scoped verification evidence

```
npx vitest run src/core/reward/SkillInsightBalance.test.ts \
  src/core/game/BattleLootSystem.idleInsight.test.ts \
  src/data/drop/DropTables.test.ts \
  tests/architecture/hoaCauTripleCircleArt.test.ts \
  tests/architecture/hoaCauVfxAssets.test.ts \
  tests/architecture/enemyArtReskin.test.ts
  → 6 files / 29 tests passed

npx vitest run src/services/save/saveShapeValidation.test.ts \
  src/core/quest src/core/game/GameManagerAutoFarmOps.test.ts
  → 4 files / 448 tests passed

npx vitest run src/data/stage/ChapterStages.test.ts \
  src/core/simulation/earlygame/StatWall.test.ts
  → 2 files / 28 tests passed
```
