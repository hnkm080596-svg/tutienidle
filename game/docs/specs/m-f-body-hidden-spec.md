# M-F-BODY-HIDDEN — Hidden perfection-material acquisition channels — Spec

Status: v3 — draft, amended after C2C spec review r84 (findings
P1/P2 resolved inline; pending re-review)
Depends on: M-F-BODY-PERFECTION (BP — MERGED onto `p7/truc-co` at
`f9fc4ee4`, save v80; its contract is live code now:
`data/realm/BodyPerfection.ts` ships `BODY_PERFECTION_REALM_MATERIALS`
(all realm keys, all `[]`), `bodyPerfectionRealmOf`,
`isBodyPerfectionMaterial`, `recordBodyPerfectionMaterialDiscovery`,
the `notifyMaterialGained` funnel, `perfectBodyRealm`); M-F-ESSENCE
(domain material delivery + essence family); M-F-CEILING (release
policy, single-check invariant); dot-pha-loi-kiep §4.1c (hidden-beast
precedent); QI-S save policy (`decisions.md` — version rejection, no
translators). NB-1 ruling (user, 2026-09-23): the 9th Kỳ Kinh node's
hidden material `thien_dia_chi_kieu` on `huyet_mong` stays as-is —
breakthrough-material gating is deferred ("giữ nguyên, sửa sau"), NOT
part of this mission.

Mission-graph scope: how hidden perfection materials REACH the player —
the acquisition/discovery channel registry, the two hidden emission
mechanisms (banded-kill spawn substitution, grotto settle-cycle
emission), their persisted progress counters, the canonical
trigger→acquire→discover pipeline, and the minimum-discoverability /
no-spoil contract. Material identities are authored later; this mission
lands the mechanism wired against the (empty-after-BP) perfection
registry.

NOT in scope: perfection material identity/name/theme/icon/count
authoring (BP ruling — content pass); any production registry entry
beyond the migrated `huyet_mong` channel (fixture registries only in
tests); `thien_dia_chi_kieu` gating/rate changes (NB-1); new UI surfaces
(the reveal surface is BP's `BodyPerfectionSection`); stage/family drop
table entries for perfection materials (ruling forbids it — hidden means
NOT on normal drop tables); hint/telemetry UI; save migration (QI-S).

## 1. Audit verdict — acquisition-surface census

Verified file-by-file against `origin/p7/truc-co` (`f9fc4ee4`, save
v80 — M-F-BODY-PERFECTION and M-F-ARTIFACT-DEFER landed since the v1
census at `fc78bc23`; the BP seam is merged code, not a pending
contract).
"Hidden" in this codebase means: not on `STAGE_DROP_TABLES`, not on
`FAMILY_DROP_TABLES`, not surfaced in UI (the `enemies-stages.md` §Quái ẩn
convention — "Không spoil vị trí", do not spoil the location).

| Surface | Evidence | Verdict |
|---|---|---|
| Windowed hidden-beast spawn | `core/game/HiddenBeastSystem.ts` — `luyenKhiKillsSinceBeast` counts banded kills; ≥ `HIDDEN_BEAST_KILL_THRESHOLD=1000` opens the window; `maybeReplaceSpawn` substitutes a pool spawn at `HIDDEN_BEAST_SPAWN_CHANCE_PER_SPAWN=0.05` (`StageWaveSystem.ts:252-261`, ACTIVE battles only — `activeStagePlayer` is set only by `startStage`); kill resets via `onEnemyDefeated` (`BattleLootSystem.ts:441-447`, fires for active AND idle kills — auto-farm routes through `processDefeatedEnemies`, `GameManagerAutoFarmOps.ts:351`) | LANDED — this mission generalizes it into the channel mechanism |
| Hidden material drop layer | `signatureDrops` on `Enemy` — `resolveDrops.ts:134-146` rolls each line by `chance`; idle channel skips `chance<1` lines; `requiresModifier` supported; post-resolve `isBreakthroughAcquisitionEnabled(material.breakthroughRealmId)` filter at `BattleLootSystem.ts:549`; `data/enemy/HiddenBeasts.ts:32-40` (`huyet_mong`: `thien_dia_chi_kieu`@5% + `tinh_hoa_pham_the`×12@100%) | LANDED — the emission layer inside `hidden_beast` channels |
| Stage drop tables | `data/drop/StageDropTables.ts` — band guaranteed+pool+currency | EXCLUDED by ruling — perfection materials must never enter normal tables |
| Family drop tables | `data/drop/FamilyDropTables.ts` — `hidden_beast` family row authored empty (`:84`) | EXCLUDED by ruling for perfection materials; unchanged |
| Signature drops on regular enemies | same `signatureDrops` layer | LANDED as an authored content surface — funnel-native, needs no channel mechanism (content pass placement; no guarantee machinery) |
| Grotto production lane | `ProductionSystem.rollRewards:563-598` (Động Thiên identity→age roll) → `grantCycleRewards:457-472` (`bag.add` + `pendingEvents`) → `drainSettlementEvents` → `notifyQuestMaterialGained` at `GameManagerTickOps.ts:166-182`; offline settle routes through the same `grantCycleRewards` (`offlineDeps` `:444-454`, `settleOffline` via `GameManagerSaveRestore.ts:568`) | LANDED — new `grotto` channel kind emits inside `grantCycleRewards` |
| Forest/mine lanes | same engine (`rollRewards:505-561`) | NOT TAKEN — no pinned channel kind this mission |
| Quest `itemDrops` claim | `QuestSystem.claim` material branch (BP: routes through `onMaterialGained` → funnel) | visible authored grant — funnel-native; no channel mechanism needed |
| Companion gifts / mail | `COMPANION_GIFT_MOMENTS` → `issueCompanionGifts` → `claimCompanionGift` (M-F-COMPANION-GIFT) | visible authored grant — funnel-native; no channel mechanism |
| Building output claim | `GameManagerBuildingOps.ts:224-247` — `bag.add` + funnel | visible authored grant — funnel-native |
| Decompose output | `GameManagerTickOps.deliverDecomposeOutput:280` — funnel call added by BP | visible authored surface — funnel-native |
| Exploration / random encounter | none: `sourceType:'exploration'` is only a material classification label; `functionType:'exploration'` on Linh Tuyền is a building tag (`GameManagerBuildingOps`) — no roaming/encounter system exists | ABSENT — no channel kind exists for it |
| Canonical discovery state | `player.bodyPerfection.discoveredMaterials`, `recordBodyPerfectionMaterialDiscovery` set-add writer, `notifyMaterialGained` funnel, `isBodyPerfectionMaterial`/`bodyPerfectionRealmOf` registry reads — merged at `f9fc4ee4` | LANDED — the destination this mission feeds |
| Channel progress state | `luyenKhiKillsSinceBeast` exists but is single-channel-hardcoded; no production-side counter exists | ABSENT — this mission |

## 2. Channel registry — `HIDDEN_MATERIAL_CHANNELS`

`data/drop/HiddenMaterialChannels.ts` — the single authored authority for
hidden-material acquisition channels. Kind-discriminated union, authored
order is resolution order:

```ts
export type HiddenMaterialChannelKind = 'hidden_beast' | 'grotto'

export interface HiddenBeastChannel {
  kind: 'hidden_beast'
  id: string                      // channel + progress-counter key
  bandRealmId: string             // kills counted + spawn substituted in this realm band
  enemyId: string                 // intruder template; its signatureDrops carry the material
  killThreshold: number           // window opens at >= this many banded kills
  spawnChancePerSpawn: number     // substitution chance per eligible ACTIVE spawn
  guaranteedSpawnAfterKills?: number  // hard bound: unconditional substitution while >= this
}

export interface GrottoChannel {
  kind: 'grotto'
  id: string
  bandRealmId: string             // eligibility band: cycles whose collectionRealmId has reached this realm
  materialId: string              // emitted directly into the bag
  chancePerCycle: number          // emission chance per eligible settled grotto cycle
  guaranteedAfterCycles?: number  // hard bound: unconditional emission at >= this eligible cycles
}

export type HiddenMaterialChannel = HiddenBeastChannel | GrottoChannel
```

Production content ships exactly ONE entry — the migrated `huyet_mong`
channel, preserving today's constants verbatim (`killThreshold: 1000`,
`spawnChancePerSpawn: 0.05`, `bandRealmId: 'qi_refining'`, no guarantee —
NB-1 keeps it non-bounded). All perfection channels are deferred content;
tests exercise them via `vi.mock`-injected fixture registries, never
production data (BP C2C r60-f4/r65-f1 convention).

```ts
export const HIDDEN_MATERIAL_CHANNELS = [
  { kind: 'hidden_beast', id: 'huyet_mong', bandRealmId: 'qi_refining',
    enemyId: 'huyet_mong', killThreshold: 1000, spawnChancePerSpawn: 0.05 },
] as const satisfies readonly HiddenMaterialChannel[]

export function hiddenBeastChannels(c = HIDDEN_MATERIAL_CHANNELS): readonly HiddenBeastChannel[]
export function hiddenGrottoChannels(c = HIDDEN_MATERIAL_CHANNELS): readonly GrottoChannel[]

// A channel's emitted material set — the reverse lookup the
// reachability invariant composes. `signatureMaterialIdsOf` is injected
// (data/drop stays catalog-pure; the test wires ENEMIES.signatureDrops).
export function channelEmittedMaterialIds(
  channel: HiddenMaterialChannel,
  signatureMaterialIdsOf: (enemyId: string) => readonly string[],
): readonly string[]

// Perfection materials intentionally reachable ONLY via visible
// authored grants — a CENSUS (C2C r84-P1b), not a bare id list: each
// row pairs the material to an authored grant source that integrity
// proves exists AND delivers the material. Ships []; content fills it.
export type VisibleGrantSourceKind = 'quest' | 'building'
export interface VisibleGrantSource {
  materialId: string
  kind: VisibleGrantSourceKind
  /** Resolved in the owning catalog: 'quest' → QUEST id whose
      `reward.itemDrops` includes materialId; 'building' → building id
      whose `producesMaterialId === materialId`. The union extends when
      content needs another authored grant surface — every new kind
      ships its per-kind resolution rule in the integrity test. */
  grantId: string
}
export const VISIBLE_GRANT_SOURCES: readonly VisibleGrantSource[] = []
```

Registry validation is the validate+assert PAIR convention (BP spec §2.2,
`BodyChapter.ts:333-363` shape) so malformed fixtures stay injectable in
tests without mutating the canonical constant:

```ts
export function validateHiddenMaterialChannels(
  channels: readonly HiddenMaterialChannel[],
): string[]                                     // issues; [] = clean
export function assertHiddenMaterialChannels(
  channels?: readonly HiddenMaterialChannel[],
): void                                         // throws on issues
```

`assertHiddenMaterialChannels()` runs once at module load over the
canonical constant. Pinned shape checks (module-load, no cross-catalog
imports — `data/drop` stays catalog-pure like `data/realm`):

- unique channel `id`s (the id is the persisted counter key);
- `hidden_beast`: `killThreshold` int > 0; `spawnChancePerSpawn ∈ (0,1]`;
  `guaranteedSpawnAfterKills`, when present, int ≥ `killThreshold`
  (equality = unconditional substitution the moment the window opens — a
  legal authored choice);
- `grotto`: `bandRealmId` non-empty string (resolution is an integrity
  arm); `chancePerCycle ∈ (0,1]`; `guaranteedAfterCycles`, when
  present, int > 0;
- one `hidden_beast` channel per `(bandRealmId, enemyId)` pair (a shared
  enemy would make kill-reset ambiguous).

Cross-catalog checks are pinned in the registry integrity TEST (the
`PhysiqueEssence.test.ts` convention — production data files do not
import other catalogs):

- every `bandRealmId` resolves in `REALMS` (both kinds carry it); every
  `enemyId` resolves in `ENEMIES`; every `grotto.materialId` resolves in
  the materials catalog;
- `hidden_beast` channel enemy's `realmId === bandRealmId` (else its kill
  can never reset the counter — the kill hook keys on `enemy.realmId`);
- band-material coherence: every channel-emitted perfection material
  satisfies `bodyPerfectionRealmOf(materialId) === channel.bandRealmId`
  (both kinds — the release-policy band gate then covers the material's
  realm too);
- **anti-frustration arm (BP seam, merged):** for every channel that
  emits a perfection material — for `grotto`, `materialId`; for
  `hidden_beast`, each `signatureDrops` line on `enemyId` whose
  `isBodyPerfectionMaterial(itemId)` — a hard bound MUST be authored
  (`guaranteedSpawnAfterKills`/`guaranteedAfterCycles`), AND every such
  `hidden_beast` signature line must be authored `chance: 1` (the
  deterministic bound lives in the spawn mechanism — §6);
- **unconditional-route arm (C2C r84-P1a):** every perfection-material
  `signatureDrops` line on a channel enemy must be authored
  `requiresModifier === undefined` — a modifier-gated line counts
  toward `channelEmittedMaterialIds` while `resolveDrops` can suppress
  it at kill time, leaving the material unreachable. A
  modifier-conditioned perfection route is only allowed once a
  validated condition-source census exists to prove the condition is
  reachable — none exists today, so the check fails closed;
- `grotto` channels additionally REQUIRE `isBodyPerfectionMaterial(
  materialId)` — the grotto lane exists solely for perfection materials
  (C2C flag F3 if arbitrary hidden materials should be allowed);
- tag completeness (the `BreakthroughScopedResources` census pattern):
  every perfection material emitted by any channel carries
  `material.breakthroughRealmId === bodyPerfectionRealmOf(materialId)` so
  the origination-time release gate can't drift from the registry;
- **inverse reachability (completeness, C2C r82-H1 + r84-P1):** the
  suite composes `channelEmittedMaterialIds` over every channel and
  asserts every material id authored in `BODY_PERFECTION_REALM_MATERIALS`
  appears in ≥1 channel's emitted set OR has ≥1 `VISIBLE_GRANT_SOURCES`
  row — a required material with no acquisition route can never
  satisfy `canPerfectBodyRealm`, so "quests may grant it" is a
  censused, validated row, not prose. Every census row must VERIFY:
  `materialId` is a perfection material present in the realm table
  (no stale/orphan rows), the `grantId` resolves in its owning catalog
  AND actually delivers `materialId` (`quest` → `reward.itemDrops`
  contains it; `building` → `producesMaterialId` equals it), and no
  channel-emitted id appears in `VISIBLE_GRANT_SOURCES` (a
  channel-covered material needs no exemption).

## 3. Channel kind `hidden_beast` — generalized spawn substitution

`core/game/HiddenBeastSystem.ts` becomes channel-driven; the system keeps
its name (the domain concept is unchanged — "quái ẩn"):

```ts
export interface HiddenBeastSystemDeps {
  getEnemyTemplate: (id: string) => Enemy | undefined
  channels?: readonly HiddenBeastChannel[]   // default hiddenBeastChannels()
}
```

- `onEnemyDefeated(player, enemyId, enemyRealmId)` — called from
  `BattleLootSystem.ts:441` on every defeated enemy (active AND idle
  auto-farm kills): for each channel where `bandRealmId === enemyRealmId`
  — `enemyId === channel.enemyId` → `player.hiddenBeastKills[channel.id]
  = 0`; otherwise `+= 1`. (Per-channel reset only on THAT channel's
  enemy; a kill of channel A's beast is just another banded kill for
  channel B.)
- `isWindowOpen(player, channel)` — `hiddenBeastKills[channel.id] ??
  0 >= channel.killThreshold`.
- `maybeReplaceSpawn(player, stageRealmId, rng)` — call site
  `StageWaveSystem.ts:253` unchanged (active stage spawns only — idle
  picks have no `activeStagePlayer`; the idle exclusion is the existing
  anti-farm posture and stays). Iterate `deps.channels` in authored
  order; first channel satisfying `bandRealmId === stageRealmId &&
  isRealmAvailable(bandRealmId) && window open` is the candidate:
  `kills >= guaranteedSpawnAfterKills` (when authored) → substitute
  unconditionally; else `rollChance(spawnChancePerSpawn, rng)` →
  substitute on hit. First hit returns the enemy template; no hit →
  normal pool spawn proceeds. `isRealmAvailable` is the origination-time
  release-policy arm (single-check invariant): a channel banded above the
  release ceiling never substitutes — identical to today for the authored
  LQ channel (`isRealmAvailable('qi_refining')` is always true in the
  beta window).
- The enemy carries the material on its authored `signatureDrops` —
  emission rides `resolveDrops` → `grantResolvedDrops` → `bag.add` → the
  funnel; `isBreakthroughAcquisitionEnabled(material.breakthroughRealmId)`
  suppression at `BattleLootSystem.ts:549` already applies to those lines
  (post-resolve filter, rng order untouched — NB-1 keeps
  `thien_dia_chi_kieu` at 0.05 so it lands only in ACTIVE kills; the
  `chance<1` idle-skip at `resolveDrops.ts:139-141` is unchanged).
- The exported constants `HIDDEN_BEAST_KILL_THRESHOLD` /
  `HIDDEN_BEAST_SPAWN_CHANCE_PER_SPAWN` / `HIDDEN_BEAST_ENEMY_ID` are
  deleted — the registry entry is their single authority (consumers:
  `HiddenBeastSystem.ts` only; tests re-pin values from the registry).
- Behavior-identity invariant: with the shipped registry (one LQ
  channel), `maybeReplaceSpawn`/`onEnemyDefeated` are observationally
  identical to today's system — the only change is the persisted counter
  field name.

## 4. Channel kind `grotto` — settle-cycle emission

The Động Thiên lane emits hidden materials inside the ONE cycle-
completion seam, `ProductionSystem.grantCycleRewards` (`:457-472`) —
reached by online `tickWorkers`/`advanceWorkerLanes` AND offline
`settleProductionOffline` identically (the `offlineDeps` injection at
`:444-454` routes to the same method).

- `ProductionSystemDeps` gains `hiddenGrottoChannels?: readonly
  GrottoChannel[]` (default `hiddenGrottoChannels()` — `[]` in
  production until content lands).
- `ProductionSiteState` gains `hiddenChannelCycles?: Record<string,
  number>` — per-channel count of settled cycles at this site since the
  channel last emitted; carried by `restoreStates`' whitelist and
  `snapshotState`'s copy like `assignedWorkers`/`workerCycles`
  (`:127-135`, `:141-146`).
- **Eligibility axis (C2C r82-H2):** a grotto channel applies to every
  `grotto` site of the bound territory, but evaluates ONLY on cycles
  whose snapshot collection realm has reached its band —
  `getRealmIndex(cycle.collectionRealmId) >=
  getRealmIndex(channel.bandRealmId)` (reach-based, not exact-match:
  channels never expire as the player advances, so late perfection
  stays farmable from later realms — BP's late-perfection ruling;
  unknown realm ids fail closed on both sides). A Mortal/LQ cycle never
  advances a TC/KD channel's counter, and counters are per-site (the
  map lives on `ProductionSiteState`) — a second territory later can
  add a `territoryId` selector if content needs site-scoped channels.
- In `grantCycleRewards`, AFTER the existing table-reward loop, when
  `definition.kind === 'grotto'`: for each ELIGIBLE grotto channel —
  `cycles[id] = (cycles[id] ?? 0) + 1`; emission when
  `guaranteedAfterCycles !== undefined && cycles[id] >=
  guaranteedAfterCycles` OR `rollChance(chancePerCycle)` on the CHANNEL
  stream (below). On emission: `isBreakthroughAcquisitionEnabled(
  registry.get(materialId).breakthroughRealmId)` at origination (the
  same tag/predicate the loot path consults at `BattleLootSystem.ts:549`;
  untagged materials always pass) — a suppressed emission does NOT reset
  the counter (the faucet stays primed at the bound until the realm
  opens); a non-suppressed emission appends `{ materialId, amount: 1,
  detail: 'hidden_channel' }` to the cycle's resolved rewards — it then
  rides the EXISTING `registry.has` → `bag.add` → `pendingEvents` loop
  byte-identically.
- Counter reset fires on EMISSION, not delivery (precedent: the beast
  counter resets on the kill regardless of what dropped) — a
  full-stack-overflowed emission is lost like any loot and the window
  re-counts; BP's `delivered > 0` rule correctly withholds discovery for
  what never entered the bag (C2C flag F6 — reset-on-delivery is the
  alternative semantics).
- **RNG isolation:** channel draws run on a dedicated stream seeded from
  `cycle.rollSeed` (e.g. `mulberry32(cycle.rollSeed ^
  GROTTO_CHANNEL_SEED_TAG)`, `TAG` a pinned constant) — NEVER the
  `rollRewards` stream, so `rollRewards` output (and thus every settled
  cycle's table rewards) is bit-identical with and without authored
  channels, and today's shipped data (zero grotto channels → zero draws)
  preserves every seeded roll exactly.
- `rollRewards(cycle)` keeps its table-only contract — channel emission
  is appended inside `grantCycleRewards` only, so the public prediction
  seam (`rollRewards` on a copy predicts the domain grant) is unchanged
  for table rewards; tests assert channel emission separately.
- Emitted events drain through `drainSettlementEvents` →
  `GameManagerTickOps.ts:166-182` → `notifyQuestMaterialGained` /
  `notifyMaterialGained` (BP rename) → `questSystem.onMaterialCollected`
  + `recordBodyPerfectionMaterialDiscovery` — the funnel fires on
  `delivered = amount - overflow` (>0 for a fresh material under normal
  stack limits). Offline settle lands in `pendingEvents` identically and
  drains on the next tick — same funnel, same discovery.

## 5. Trigger → acquire → discover pipeline

| Kind | Trigger | Acquire | Discover |
|---|---|---|---|
| `hidden_beast` | banded kill (active or auto-farm) → counter ≥ threshold | active-stage spawn substituted → intruder killed → `signatureDrops` roll → `resolveDrops` → `bag.add` → funnel | `recordBodyPerfectionMaterialDiscovery` inside funnel (BP) |
| `grotto` | grotto worker cycle settles (online tick or offline settle) | channel roll/guarantee → emission appended to `grantCycleRewards` rewards → `bag.add` + `pendingEvents` → drain → funnel | same |

- **One delivery seam:** every channel lands via `materialBag.add` +
  `notifyMaterialGained(materialId, delivered)` (post-BP name of the
  `notifyQuestMaterialGained` funnel). No channel touches
  `player.bodyPerfection`, calls `recordBodyPerfectionMaterialDiscovery`
  directly, or writes inventory outside `bag.add`. C2C flag F1: the
  mandate names `grantDomainMaterial`; no such symbol exists on base or
  the BP branch — the canonical seam IS the `bag.add` + funnel pair every
  material landing shares post-BP; if the intent was a dedicated
  `grantDomainMaterial` op, say so.
- **Release policy** at origination only (single-check invariant):
  `hidden_beast` gates on `isRealmAvailable(bandRealmId)` at
  substitution; both kinds gate on
  `isBreakthroughAcquisitionEnabled(material.breakthroughRealmId)` at
  emission/landing. Restore/settle rehydration never re-checks and never
  deletes persisted counters — a save holding high counters keeps them;
  the bound resumes on the next eligible trigger.
- **Idempotent discovery:** re-acquisition after first discovery is a
  normal material grant — the funnel's discovery arm returns `false`
  (set-add no-op), no duplicate event, no re-surfacing, channels never
  self-disable or one-shot (a consumed/dropped material is re-farmable).

## 6. Anti-frustration contract — minimum discoverability, no spoil

- **Hard bound required for perfection channels (C2C r82-M1 — precise
  semantics):** every channel emitting a perfection material authors
  `guaranteedSpawnAfterKills` / `guaranteedAfterCycles` — a finite
  deterministic bound MEASURED IN THE CHANNEL'S OWN UNITS (enforced by
  the integrity test, §2): for `hidden_beast`, in banded kills —
  reaching the bound makes the NEXT ELIGIBLE ACTIVE SPAWN substitute
  unconditionally (substitution is active-stage-only, so idle kills
  advance the counter without producing spawns; the bound is in
  kill-count units, not elapsed time or real acquisition latency); for
  `grotto`, in eligible settled cycles. Geometric chance alone is not a
  guarantee. Values are authored by the content pass.
- **Hidden-beast perfection channels must make the bound cover the drop
  layer:** every perfection-material `signatureDrops` line on a channel
  enemy is authored `chance: 1`, so the spawn bound IS the acquisition
  bound — `guaranteedSpawnAfterKills` banded kills guarantees the beast
  at its next eligible active spawn, `chance:1` guarantees the drop on
  its defeat (C2C flag F4 — a probabilistic drop layer would reduce
  the guarantee to an expected value, not a bound).
- **No spoil:** zero UI surface for channels, counters, windows, or
  locations — the `enemies-stages.md` §Quái ẩn convention ("Không spoil
  vị trí") applies to every channel; no hint system, no telemetry, no
  progress bars. The BP `BodyPerfectionSection` partial-reveal (only
  DISCOVERED materials are named) is the whole discoverability surface
  (C2C flag F7 — no ruling in-repo requires a hint/telemetry layer).
- The `huyet_mong` channel ships WITHOUT a bound (NB-1 — its 5% drop
  stays; it is not a perfection channel so the requirement doesn't
  apply).

## 7. Save contract (QI-S)

- `PlayerData.hiddenBeastKills: Record<string, number>` — new required
  field beside `bossKillCount`; `createDefaultPlayer` initializes `{}`.
  **Removes** `luyenKhiKillsSinceBeast` — field deletion is legal under
  version rejection (no migration). Validation: `saveShapeValidation`
  replaces `requireNonNegativeNumber(player,'luyenKhiKillsSinceBeast')`
  (`:756`) with object + per-value non-negative-finite-number checks;
  unknown channel ids tolerated (dead counters for shifted catalogs —
  same tolerance class as restored unknown siteIds).
- `ProductionSiteState.hiddenChannelCycles?: Record<string, number>` —
  optional (absent = empty); validated in `validateProductionSitesSave`
  (object + non-negative-int values); serialized via `getAllStates`;
  whitelisted in `restoreStates`; copied in `snapshotState`.
- `saveVersion.ts`: `CURRENT_SAVE_VERSION + 1` over the merged base AT
  IMPLEMENTATION START — the base now reads **v80** (`f9fc4ee4`, BP
  landed v80; ARTIFACT-DEFER took v79), so this mission expects **v81**
  — re-read at phase-2 rebase, never pin a literal. Old versions
  rejected — version rejection is the mechanism (QI-S); no translators,
  no recompute-on-load.
- `saveTypes.ts` doc comment updates (`:143` names the removed field).
- No `preflightSaveRegistryReferences` addition needed: counters are
  uninterpreted numbers; a crafted high counter only opens a window —
  the emitted material's own realm/release gates still apply.

## 8. Consistency invariants

- One channel authority (`HIDDEN_MATERIAL_CHANNELS`); systems consume
  typed filtered views (`hiddenBeastChannels`/`hiddenGrottoChannels`),
  never the raw union — A9.
- One delivery seam (`bag.add` + `notifyMaterialGained`); zero direct
  `bodyPerfection` writes, zero parallel inventory writes — BP's
  canonical discovery writer is the ONLY discovery authority (A2/A9).
- `resolveDrops` rng consumption order byte-identical (signature layer
  untouched); `rollRewards` stream untouched (channel draws on the
  dedicated stream); production behavior with shipped registries
  (zero grotto channels, one LQ channel) is bit-identical to today.
- Counter domains stay in their owners (A3): kill counters on
  `PlayerData` (the battle domain writes them via `onEnemyDefeated`),
  cycle counters on `ProductionSiteState` (the production domain writes
  them inside `grantCycleRewards`) — `ProductionSystem` never sees
  `PlayerData`.
- `huyet_mong` unchanged as content: `thien_dia_chi_kieu` @5% active-only
  (NB-1), `tinh_hoa_pham_the` ×12 @100%, window 1000, chance 0.05,
  active-spawn-only, reset-on-kill.
- Perfection materials reachable ONLY through channels or censused
  visible grants (`VISIBLE_GRANT_SOURCES`): the `EnemyDropSinkInvariant`
  test and the band tables continue to exclude them; the integrity test
  asserts no `signatureDrops`/`pool`/`guaranteed` line on a NON-channel
  enemy carries a `isBodyPerfectionMaterial` id — "hidden" means
  unreachable via normal loot.
- Counters persist through save/load and offline settle; persisted
  progress is authoritative (S1/S2). `restoreStates()` / state
  rehydration performs NO rolls, no emission, no counter writes, no
  discovery — pure value replacement. `settleProductionOffline` (the
  elapsed-offline catch-up `GameManagerSaveRestore` runs afterwards) is
  reward ORIGINATION, not restore: it MAY roll and emit through the
  normal `grantCycleRewards` path, and any discovery it produces rides
  `pendingEvents` to the next `drainSettlementEvents` tick — identical
  to online settle. Tests assert these as two separate operations
  (C2C r82-M2).

## 9. Out of scope

- Perfection material identities, names, themes, icons, counts — and
  every authored perfection channel entry (fixture registries only in
  tests; production ships `huyet_mong` only).
- `thien_dia_chi_kieu` gating/rate/bound changes (NB-1 — "giữ nguyên,
  sửa sau"; the breakthrough-gating decision belongs to a later ruling).
- New hidden-surface kinds (forest/mine lanes, quest-triggered hidden
  grants, exploration/encounter mechanics) — the union extends when a
  ruling asks for them.
- Hint/telemetry/progress UI; any UI at all (BP's section is the
  surface).
- A `grantDomainMaterial` op (C2C flag F1); change to
  `EssenceSubstitutionEconomy` sim or other non-production harnesses.
- Balance numbers, channel-count economics, expected-time-to-discovery
  tuning (authored values land with content).

## 10. Acceptance

- All §2–§7 seams land; zero behavior drift for shipped content (proved
  by the huyet_mong-parity and empty-grotto-channel tests).
- `npm run type-check` + scoped `npx vitest run` green (P3 quick);
  `npm run verify` full — save-schema + `PlayerData`/`ProductionSiteState`
  shape touch triggers full mode.
- P18 OCR clean; P4 adversarial QA quick verdict recorded; P5 sequential
  ≥3 passes with per-pass evidence blocks.
- Runtime evidence (P13): the shipped huyet_mong path exercised through
  the real stage loop unchanged (channel-driven substitution produces
  the beast spawn + signature drops at the same rates); production
  grotto shows no channel emission (empty channels) while table rewards
  roll identically — driven in the implementation worktree before
  merge-ready. Positive-path channel flows run on `vi.mock` fixture
  registries (C2C r60-f4 convention).
- Tests pin: channel registry validation (shape + cross-catalog +
  perfection-channel bounds + band/material coherence + tag census);
  huyet_mong parity (window opens at 1000, 5% substitution, reset on
  kill, idle kills count, idle spawns never substitute, signature drops
  unchanged); multi-channel ordering (authored order, per-channel
  counters, A-reset doesn't touch B); guaranteed substitution at bound;
  `isRealmAvailable` dormancy on a beyond-ceiling band channel; grotto
  emission (eligibility — a cycle whose collectionRealmId has not
  reached the channel band never advances its counter; chance via
  scripted rng, guaranteed at bound, reset on emission,
  suppressed-by-release-policy leaves counter primed, emission rides
  pendingEvents → funnel → discovery set-add); bound semantics —
  reaching `guaranteedSpawnAfterKills` guarantees the next eligible
  ACTIVE spawn (counter keeps advancing through idle kills, no spawn
  produced until an active one rolls); inverse reachability — a
  required material absent from every channel AND from
  `VISIBLE_GRANT_SOURCES` fails; a census row whose `grantId` doesn't
  resolve or doesn't deliver the material fails; a modifier-gated
  (`requiresModifier`) perfection signature line fails; counter
  persistence + save round-trip + old-version rejection;
  `restoreStates` performs no rolls/emission/discovery while
  `settleProductionOffline` emits into `pendingEvents` drained by the
  next tick; `rollRewards` stream parity with and without fixture
  channels; re-acquisition delivers without re-discovery (funnel
  no-ops).
- Negative-path-only for the shipped all-empty grotto registry — the
  positive grotto emission suite runs on injected fixture channels
  (BP C2C r65-f1 convention).

## 11. C2C flags

- **F1** — the mandate says "route through `grantDomainMaterial` /
  release-policy where applicable"; no `grantDomainMaterial` exists on
  base or BP — the canonical seam is `materialBag.add` +
  `notifyMaterialGained` (BP §3.1). If a dedicated op was intended, this
  mission can introduce it as the channel emission wrapper — otherwise
  the bag+funnel pair stands as the delivery contract.
- **F2** — `hiddenBeastKills: Record<channelId, number>` replaces
  `luyenKhiKillsSinceBeast` (field removal under save rejection).
  Alternative: keep the scalar for the shipped channel and add a map
  only for new channels — rejected: two counter authorities for one
  mechanism (A9).
- **F3** — `grotto` channels are pinned to perfection materials only
  (`isBodyPerfectionMaterial(materialId)` required in the integrity
  test). Relax if content wants arbitrary hidden grotto finds.
- **F4** — `chance: 1` required on perfection `signatureDrops` of
  channel enemies (makes the spawn bound the acquisition bound). A
  probabilistic drop layer would need its own bound machinery —
  rejected as speculative scope unless content asks.
- **F5** — band-material coherence for channel-emitted perfection
  materials (`bodyPerfectionRealmOf(m) === channel.bandRealmId`, both
  kinds) — keeps the band gate equivalent to the material-realm gate.
  Relax if content wants cross-band emission (the material's own
  `breakthroughRealmId` gate still applies at the drop/emission
  filter).
- **F6** — counter resets on emission, not delivery (precedent
  semantics; overflow loss behaves like any lost loot).
- **F7** — no hint/telemetry layer: the no-spoil convention is read as
  absolute; the only player-facing discoverability is BP's
  partial-reveal section. Flag if the mandate wanted a hint surface.
- **F8** — hidden_beast substitution remains ACTIVE-spawn-only
  (unchanged posture: idle kills count the counter, idle spawns never
  substitute, `chance<1` signature drops never land idle). Flag if
  auto-farm should see hidden spawns.
- **F9** — grotto eligibility is reach-based (`collectionRealmId >=
  bandRealmId`), not exact-match: channels never expire, so a TC
  player keeps farming mortal/LQ channels for late perfection (BP's
  late-perfection ruling makes exact-match hostile). A
  site/territory selector was the alternative axis — not taken: the
  bound territory owns one grotto site and counters are per-site;
  `territoryId` remains a later extension point if content needs it.
- **F10** — `VISIBLE_GRANT_SOURCES` kinds are pinned to the two
  VERIFIED grant catalogs (`quest.reward.itemDrops`, building
  `producesMaterialId`); decompose/stage/realm-entry grant kinds extend
  the union when content needs them — each ships its resolution rule.
