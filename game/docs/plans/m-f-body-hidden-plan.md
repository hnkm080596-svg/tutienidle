# M-F-BODY-HIDDEN — Hidden perfection-material acquisition channels — plan

Spec: `game/docs/specs/m-f-body-hidden-spec.md` (v1 — pending C2C spec
review). Implements the acquisition/discovery surface layer for per-realm
body perfection materials: the `HIDDEN_MATERIAL_CHANNELS` registry, the
generalized `hidden_beast` spawn-substitution mechanism (migrating the
`huyet_mong` precedent 1:1), the `grotto` settle-cycle emission mechanism
inside `grantCycleRewards`, and the two persisted progress counters — all
riding the canonical `materialBag.add` + `notifyMaterialGained` funnel so
BP's discovery writer stays the only discovery authority. Scope limits
per spec: no authored perfection entries/channels (fixture registries in
tests only), no `thien_dia_chi_kieu` change (NB-1), no UI, no hint layer,
no migration (QI-S — version rejection).

Dependency note (spec preamble): `isBodyPerfectionMaterial` /
`bodyPerfectionRealmOf` / `recordBodyPerfectionMaterialDiscovery` /
`notifyMaterialGained` are the BP seam. If PR #14 has landed on
`p7/truc-co` when Phase 2 opens, implement against it after rebase;
if not, implement the channel registry + systems + save shape against
the non-BP names (`notifyQuestMaterialGained`, drop-path funnel) and mark
the two BP-touchpoints (`isBodyPerfectionMaterial` references in the
integrity test, funnel rename) as BP-conditional — the coordinator owns
the merge-order call.

Phase 1 delivered docs only; Phase 2 begins after C2C spec + plan
gates pass.

## Step 0 — seam census (done during spec)

- `core/game/HiddenBeastSystem.ts` — generalizes: deps gain
  `channels?: readonly HiddenBeastChannel[]` (default
  `hiddenBeastChannels()`); `isWindowOpen(player, channel)` reads
  `player.hiddenBeastKills[channel.id]`; `maybeReplaceSpawn` iterates
  authored channels (`bandRealmId === stageRealmId` +
  `isRealmAvailable(bandRealmId)` + window open → guaranteed bound or
  `rollChance(spawnChancePerSpawn)`); `onEnemyDefeated` per-channel
  increment/reset. Constants `HIDDEN_BEAST_*` deleted — registry is the
  authority. Call sites `StageWaveSystem.ts:253` +
  `BattleLootSystem.ts:442` unchanged.
- `core/player/Player.ts` — `luyenKhiKillsSinceBeast: number` (:161,
  default `:439`) replaced by `hiddenBeastKills: Record<string, number>`
  (default `{}`).
- `core/production/ProductionTypes.ts` — `ProductionSiteState` gains
  `hiddenChannelCycles?: Record<string, number>`.
- `core/production/ProductionSystem.ts` — deps gain
  `hiddenGrottoChannels?: readonly GrottoChannel[]` (default
  `hiddenGrottoChannels()`); `grantCycleRewards` (:457) gains the
  post-table channel block: grotto site → per-channel counter++ on the
  site state → bound/roll on a dedicated `mulberry32(cycle.rollSeed ^
  GROTTO_CHANNEL_SEED_TAG)` stream → `isBreakthroughAcquisitionEnabled(
  material.breakthroughRealmId)` gate → append `{materialId, amount: 1,
  detail: 'hidden_channel'}` riding the existing `bag.add`/`pendingEvents`
  loop → reset counter on emission only. `restoreStates` (:127) whitelist
  + `snapshotState` (:141) copy carry the field.
- `data/drop/HiddenMaterialChannels.ts` (new) — kind union, canonical
  `HIDDEN_MATERIAL_CHANNELS` (one migrated `huyet_mong` entry), typed
  filters, `validate`/`assert` pair, `GROTTO_CHANNEL_SEED_TAG`.
- `core/game/GameManager.ts` — `productionSystem` deps (:406-412) gain
  the grotto-channel view; `hiddenBeastSystem` deps (:709-711) gain the
  channel list.
- `services/save/saveVersion.ts` — `CURRENT → CURRENT+1` on the merged
  base at implementation start (base reads 78 at spec time; verify then)
  + changelog comment.
- `services/save/saveShapeValidation.ts` — `luyenKhiKillsSinceBeast`
  require (:756) → `hiddenBeastKills` object+nonneg-int values;
  `validateProductionSitesSave` (:1274-1333) gains optional
  `hiddenChannelCycles` check beside `assignedWorkers`.
- `services/save/saveTypes.ts:143` — comment names the new field.
- `GameManagerTickOps.ts:166-182` — no change: `drainSettlementEvents`
  already funnels every settle event through `notifyQuestMaterialGained`
  (→ `notifyMaterialGained` post-BP); channel emissions ride it.
- Docs: `docs/systems/enemies-stages.md` §Quái ẩn +
  `docs/systems/drops-loot.md` §7 reference the generalized channel
  registry (mechanism description only — still no location spoil).

## Step 1 — TDD failing tests first

1. `data/drop/HiddenMaterialChannels.test.ts` (new): canonical registry
   validates clean (`assertHiddenMaterialChannels()` does not throw;
   the shipped `huyet_mong` entry holds threshold 1000 / chance 0.05 /
   band `qi_refining`); malformed fixtures reject — duplicate ids,
   `killThreshold <= 0`, chance out of `(0,1]`, `guaranteed <
   killThreshold`, two `hidden_beast` channels sharing `(band, enemy)`.
   Integrity arms (cross-catalog, fixture-injected): `bandRealmId` ∉
   `REALMS`, `enemyId` ∉ `ENEMIES`, `materialId` ∉ materials catalog;
   channel enemy `realmId !== bandRealmId`; a perfection channel fixture
   WITHOUT a bound rejects; a perfection `signatureDrops` line at
   `chance < 1` rejects; `bodyPerfectionRealmOf(m) !== bandRealmId`
   rejects; `breakthroughRealmId` mismatch rejects; grotto channel on a
   non-perfection material rejects. (BP-conditional arms run when the BP
   seam is present; see dependency note.)
2. `core/game/HiddenBeastSystem.test.ts` (rewrite around channels):
   shipped-registry parity — window closed below 1000/open at 1000; 5%
   substitution on scripted rng; non-LQ band never substitutes; kill
   resets only the killed channel's counter; `huyet_mong` template
   resolves. Fixture channels — two channels same band: authored order
   decides; second-channel kills don't count for first; killing A's
   beast increments B's counter; `guaranteedSpawnAfterKills` forces
   substitution at the bound without a roll; beyond-ceiling `bandRealmId`
   fixture never substitutes (`isRealmAvailable` dormancy); channel
   enemy resolving to undefined is skipped safely.
3. `core/production/ProductionSystem.test.ts` (extend): grotto channel
   fixture — emission at scripted-rng hit appends the material to the
   cycle's grants and pushes a `pendingEvents` entry; `detail` tag
   `'hidden_channel'`; `guaranteedAfterCycles` emits unconditionally at
   the bound cycle (no roll consumed); emission resets the counter;
   chance-miss increments; a `breakthroughRealmId` beyond the ceiling
   suppresses the emission AND leaves the counter at the bound (retry
   next cycle); empty channels consume zero channel draws — a fixed-seed
   cycle rolls identical table rewards with and without a fixture
   channel attached (stream isolation); `rollRewards` output itself is
   unchanged (table-only contract); `restoreStates`/`getAllStates`
   round-trip `hiddenChannelCycles`; offline `settleProductionOffline`
   emits identically (same `grantCycleRewards` seam).
4. `BattleLootSystem` drop tests (extend): unchanged expectations —
   signature-drop landings still funnel via `onMaterialCollected`/the
   BP funnel; post-resolve `isBreakthroughAcquisitionEnabled` filter
   untouched (this mission adds no drop-path code; these tests prove no
   drift).
5. `GameManager` integration (extend or new
   `HiddenChannels.integration.test.ts`): `tickWorkers` settling a
   fixture grotto channel emits → `drainSettlementEvents` →
   `notifyQuestMaterialGained` spy receives `(materialId, 1)`; a
   delivered perfection-material fixture records
   `discoveredMaterials` via the funnel (post-BP arm) — second identical
   emission delivers again with no duplicate discovery.
6. `services/save` tests (extend `SaveRoundTrip.test.ts`):
   `hiddenBeastKills` map round-trips; `hiddenChannelCycles` inside
   `productionSites` round-trips; malformed map values reject; missing
   `hiddenBeastKills` rejects; prior-version payload rejected (pin the
   bumped number at implementation start); `luyenKhiKillsSinceBeast`
   key in a stale payload is tolerated out (whitelist convention).
7. `GameManager.stageLease.test.ts` / `HiddenBeastDrops.test.ts` /
   `battleLootTestSetup.ts` — harness updates only:
   `new HiddenBeastSystem({ getEnemyTemplate })` still compiles
   (channels default); drop-invariant tests unchanged (content data
   identical).
8. Registry-vs-loot invariant (new arm in
   `data/drop/HiddenMaterialChannels.test.ts` or
   `EnemyDropSinkInvariant.test.ts`): no `signatureDrops`/pool/guaranteed
   line on an enemy that is NOT a `hidden_beast` channel's `enemyId`
   carries a `isBodyPerfectionMaterial` id — hidden means unreachable
   via normal loot (BP-conditional arm).

## Step 2 — channel registry data module

- `data/drop/HiddenMaterialChannels.ts`: `HiddenMaterialChannelKind`
  union, `HiddenBeastChannel`/`GrottoChannel` interfaces,
  `HIDDEN_MATERIAL_CHANNELS` (migrated `huyet_mong` entry verbatim),
  `hiddenBeastChannels`/`hiddenGrottoChannels` typed filters,
  `GROTTO_CHANNEL_SEED_TAG` pinned constant,
  `validateHiddenMaterialChannels` + `assertHiddenMaterialChannels`
  (module-load assert on the canonical constant; shape checks only —
  no catalog imports per `data/` purity convention).

## Step 3 — hidden_beast mechanism + player counter

- `core/player/Player.ts`: `hiddenBeastKills: Record<string, number>`
  replaces `luyenKhiKillsSinceBeast` (field + `createDefaultPlayer`).
- `core/game/HiddenBeastSystem.ts`: deps `channels` (default
  `hiddenBeastChannels()`); `isWindowOpen(player, channel)`;
  `maybeReplaceSpawn` authored-order iterate + `isRealmAvailable` arm +
  guarantee arm; `onEnemyDefeated` per-channel map update; delete the
  `HIDDEN_BEAST_*` exports; module comment updated to reference the
  channel registry.
- `core/game/GameManager.ts`: pass `hiddenBeastChannels()` into
  `hiddenBeastSystem` deps (:709).

## Step 4 — grotto mechanism

- `core/production/ProductionTypes.ts`: `hiddenChannelCycles?` field.
- `core/production/ProductionSystem.ts`: deps `hiddenGrottoChannels`
  (default `hiddenGrottoChannels()`); `grantCycleRewards` channel block
  per spec §4 (counter++ → bound-or-chance on the dedicated stream →
  `isBreakthroughAcquisitionEnabled` gate → append reward → reset on
  emission only); `restoreStates`/`snapshotState` carry the field.
- `core/game/GameManager.ts`: pass `hiddenGrottoChannels()` into
  `productionSystem` deps (:406).

## Step 5 — save contract

- `saveVersion.ts`: base+1 at implementation start + changelog comment.
- `saveShapeValidation.ts`: `hiddenBeastKills` shape (object, values
  finite non-negative) replacing the scalar check; `hiddenChannelCycles`
  optional map check inside `validateProductionSitesSave`.
- `saveTypes.ts`: comment update.
- Confirm: restore writes counters verbatim (player blob replace +
  `restoreStates` whitelist); no discovery/roll/emission fires on
  restore; `preflightSaveRegistryReferences` unchanged.

## Step 6 — docs + fixture hygiene

- `enemies-stages.md` §Quái ẩn + `drops-loot.md` §7: mechanism now
  channel-registry-driven; naming only, still no location spoil.
- `hiddenBeastKills`/`hiddenChannelCycles` comments ASCII (P15); no
  i18n keys (no UI).

## Step 7 — gates

- P3: quick `npm run type-check` + `npx vitest run <hidden|drop|
  production|save|battle scopes>`; escalate `npm run verify` (full) —
  save-schema + `PlayerData`/`ProductionSiteState` + progression-adjacent
  state touch triggers full mode.
- E3 simplify → P18 OCR (delegation mode: `ocr delegate preview -f json`
  + `ocr delegate rule <paths>`) → P4 adversarial QA quick
  (progression/persistence/economy vectors; deep if quick flags breadth)
  → P5 sequential ≥3 passes with per-pass evidence blocks → commit +
  push + PR base `p7/truc-co`.
- P13 runtime: drive an LQ stage from the implementation worktree —
  `huyet_mong` substitution still fires (or counter advances) through the
  real spawn path; grotto cycles settle with zero drift; no console
  errors.
- P15 ASCII scan on new comments; no i18n keys needed (no UI).
- Report to coordinator: branch, files, per-gate evidence, limitations.

## Per-delta acceptance map

| Delta | Spec § | Plan step | Acceptance test |
|---|---|---|---|
| 1 — channel registry + validation | §2 | 1.1, 2 | registry suite |
| 2 — hidden_beast generalization + counter | §3 | 1.2, 1.7, 3 | system suite + parity |
| 3 — grotto emission + counter | §4 | 1.3, 4 | production suite |
| 4 — funnel/discovery routing | §5 | 1.4, 1.5 | integration suite |
| 5 — anti-frustration + no-spoil contract | §6 | 1.1 (bound/chance/coherence arms), 6 | integrity suite |
| 6 — save schema + rejection | §7 | 1.6, 5 | save suite |
| shipped-content parity | §8 | 1.2, 1.3, 1.4 | parity arms |
| docs | §6 | 6 | manual |
