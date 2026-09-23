# M-F-COMPANION-GIFT — Beta companion acquisition via authored gifts — Spec

Status: v1 — draft (worker-authored, pending C2C spec review)
Depends on: P7-M9 (companion domain unlock at Truc Cơ —
`isCompanionDomainUnlocked`), P7-M-G (`BETA_COMPANIONS` Beta pool split
from the full catalog), M-F-CEILING (ReleasePolicy release-window
authority + origination-only suppression invariant), M-G (authored
`than_nong`/`khai_minh` definitions).

Mission-graph scope: F13 (ruling §42–45) — no active pull pool in Beta;
Thần Nông / Khai Minh arrive via authored MAIL/GIFT progression rewards;
claim transaction idempotent; pull architecture kept with empty pool as
an explicit valid state; recurring `chieu_hien_lenh` token sources
suppressed.

Not in scope: authored gift-moment *placement* (content pass owns the
final trigger moments — the provisional list below is explicitly marked
DEFERRED), companion coefficient changes (rates, pity, costs,
constellation values all untouched), pull-pool re-enable (the flag is
the switch; flipping it is a ruling, not this mission), UI redesign,
save migration (dev-phase convention: bump = reject, no translator).

## 1. Intent

Beta has **no active pull pool**. The two Beta companions (Thần Nông,
Khai Minh) are granted through a new **companion gift** primitive: an
authored *grant moment* (data) issues a *claimable gift record* onto the
player (canonical state) when its trigger fires, and the player *claims*
it through a UI surface — claim → grant companion → consumed marker,
fully idempotent.

Three linked rulings:

- **Pull/exchange flagged off, architecture kept.** A single
  release-policy predicate (`isCompanionPullPoolEnabled`, Beta: `false`)
  closes the acquisition pool. The ops contract treats an empty
  acquirable pool as an explicit valid state — ops reject
  `pool_unavailable` before touching currency, never reaching the
  `pickDefinitionOfGrade` empty-grade throw (the existing crash slot).
  Surfaces stay visible and *say why* in release-policy reason style —
  no hidden dead buttons.
- **Gift primitive.** `player.companionGifts` (persisted record slice) +
  `COMPANION_GIFT_MOMENTS` (authored trigger registry) +
  `issueCompanionGifts` (idempotent domain fire) +
  `claimCompanionGift` (idempotent ops transaction) + a `qua_tang` tab
  beside the gacha tabs.
- **Token income suppressed at origination only.** The recurring
  `chieu_hien_lenh` sources — the `daily_chieu_hien_lenh` quest and the
  chapter-3 floor-10 boss `signatureDrop` — consult
  `isCompanionPullTokenSourceSuppressed` (ReleasePolicy) at reward
  origination. Banked tokens / Duyên Phận / pity are untouched and never
  re-checked at restore, per the M-F-CEILING single-check invariant.

## 2. Canonical state

`PlayerData` gains one persisted field (required; `createDefaultPlayer`
initializes `[]` — Pinia `toRefs` convention means undeclared fields are
not reactive):

```ts
// data/companion/Companions.ts — beside CompanionInstance (shared
// persisted-state shape consumed by PlayerData, save validation,
// core domain, ops, and UI):
export interface CompanionGiftRecord {
  id: string              // == issuing moment id (dedupe + provenance in one key)
  definitionId: string    // resolves in the full COMPANIONS catalog
  claimed: boolean        // consumed marker — one-way false -> true
}

// on PlayerData (core/player/Player.ts, beside companions/duyenPhan):
companionGifts: CompanionGiftRecord[]
```

Authored trigger registry (new file
`data/companion/CompanionGiftMoments.ts`):

```ts
export type CompanionGiftTrigger =
  | { kind: 'realm_entered'; realmId: string }
  | { kind: 'stage_completed'; stageId: string }

export interface CompanionGiftMoment {
  id: string                        // stable unique id; becomes record.id
  trigger: CompanionGiftTrigger
  definitionId: string
}

export const COMPANION_GIFT_MOMENTS: readonly CompanionGiftMoment[] = [
  // DEFERRED (M-F-CONTENT-TC): provisional placements pin the seams;
  // the content pass owns the final authored moments.
  { id: 'gift_than_nong_foundation_entry',
    trigger: { kind: 'realm_entered', realmId: 'foundation_establishment' },
    definitionId: 'than_nong' },
  { id: 'gift_khai_minh_foundation_floor_10',
    trigger: { kind: 'stage_completed', stageId: 'foundation_floor_10' },
    definitionId: 'khai_minh' },
]
```

- One companion per moment; two companions from one trigger = two
  moments sharing the trigger.
- Issued records survive authored-moment deletion: save validation
  checks record shape only, never `id ∈ COMPANION_GIFT_MOMENTS` — a
  removed moment must not invalidate a save carrying its claimed
  record.
- `record.id === moment.id` folds provenance into the dedupe key
  (C2C flag F6: alternative is a separate `sourceMomentId` field if
  one moment ever needs to issue >1 gift record).

## 3. Pull-pool flag + empty-pool contract

`ReleasePolicy.ts` gains the acquisition flag and the token-source
census (CEILING authority — same module that owns the other Beta
suppression gates):

```ts
// Beta ruling §42–45: no active pull pool. Re-enable = flip the
// predicate + re-author the pool; architecture stays.
export function isCompanionPullPoolEnabled(): boolean {
  return false
}

// Recurring pull-token material ids the pool flag suppresses at
// origination. Census mirrors data/breakthrough/BreakthroughScopedResources:
// an integrity test asserts it equals the COMPANION_PULL_TOKEN_ID set.
export const COMPANION_PULL_TOKEN_MATERIAL_IDS: readonly string[] = [
  'chieu_hien_lenh',
]

export function isCompanionPullTokenSourceSuppressed(itemId: string): boolean {
  return !isCompanionPullPoolEnabled() && COMPANION_PULL_TOKEN_MATERIAL_IDS.includes(itemId)
}
```

`CompanionAvailability.ts` gains the acquirable-pool read (the one
authoritative pool view — ops and UI mirror it):

```ts
export function companionAcquirablePool(): readonly CompanionDefinition[] {
  return isCompanionPullPoolEnabled() ? BETA_COMPANIONS : []
}
```

Ops contract (both unions gain `'pool_unavailable'`):

- `pullCompanion()`: order becomes `no_active_player → realm_locked →
  pool_unavailable → missing_token → debit+roll`. The pool check reads
  `companionAcquirablePool().length === 0` — so flag-off AND a future
  empty-authored-pool are the same explicit rejection, and the op never
  debits a token into a dead pool. `pickDefinitionOfGrade`'s throw stays
  unreachable-by-construction.
- `exchangeCompanion()`: `realm_locked → pool_unavailable →
  unknown_definition → constellation_maxed → insufficient_duyen_phan`.
  The pool check runs before the catalog lookup so a rejected exchange
  reports the state ("pool closed"), not a phantom "unknown companion".
- `isCompanionDomainUnlocked` (Trúc Cơ) is unchanged and is NOT the pool
  flag: the companion domain stays unlocked while the pool is off — the
  Beta state — so the gacha surfaces remain reachable to explain the
  state, and banked `companionPullsSinceRare`/`duyenPhan` stay
  meaningful (preserved for re-enable).

## 4. Token-source suppression (origination only)

Two recurring token sources exist; both consult
`isCompanionPullTokenSourceSuppressed` at origination, exactly like the
M-F-CEILING breakthrough suppression:

- **Quest** (`core/quest/QuestSystem.ts`): `isUnlocked(quest, player)`
  gains `&& !questRewardsSuppressedPullToken(quest)` where
  `questRewardsSuppressedPullToken` = `quest.reward.itemDrops?.some(d =>
  d.kind === 'material' && isCompanionPullTokenSourceSuppressed(d.itemId))`.
  Detection is reward-driven (a quest "is a token source" iff it grants
  a censused token material), so `daily_chieu_hien_lenh` never
  activates, the R8.1 inverse pass deactivates any stale active, and
  the daily-quest list query (L275) excludes it — one consult covers
  all three readers. Belt-and-suspenders inside `claim`: the material
  `itemDrops` branch gains `if
  (isCompanionPullTokenSourceSuppressed(drop.itemId)) continue` beside
  the existing `isBreakthroughAcquisitionEnabled` filter (covers a
  completed-not-yet-claimed quest in the window before reconcile).
- **Boss drop** (`core/game/BattleLootSystem.ts` material branch,
  ~:546): `if (isCompanionPullTokenSourceSuppressed(drop.itemId)) break`
  beside the breakthrough check — post-resolve suppression, rng order
  untouched, same convention.

Banked `chieu_hien_lenh` in the material bag, `duyenPhan`, and
`companionPullsSinceRare` are NOT stripped anywhere — suppression is at
origination, never at restore/delivery (single-check invariant). Token
architecture (`COMPANION_PULL_TOKEN_ID`, `EXCHANGE_COST`, rates, pity)
stays for future re-enable.

## 5. Gift fire seams

`issueCompanionGifts` (new `core/companion/CompanionGifts.ts`) is the
single domain fire — pure on PlayerData, moments injected for
testability like `pullCompanion`'s pool:

```ts
// Appends {id: moment.id, definitionId, claimed: false} for every
// moment matching the trigger whose id is absent — write-if-absent
// makes repeated fires no-ops. Returns the appended records.
export function issueCompanionGifts(
  player: PlayerData,
  trigger: CompanionGiftTrigger,
  moments: readonly CompanionGiftMoment[] = COMPANION_GIFT_MOMENTS,
): CompanionGiftRecord[]
```

Three call sites cover the trigger union (all post-write, idempotent
anyway):

- `stage_completed`: `GameManagerBattleRewardOps.grantTurnBattleRewards`
  (~:168) calls `issueCompanionGifts(playerData,
  {kind:'stage_completed', stageId: stage.id})` inside the
  first-completion once-guard right after
  `playerData.completedStageIds.push(stage.id)` — the precise
  first-completion event; a refight win on an already-completed stage
  never re-enters the guard.
- `realm_entered`: `realmAdvanceOps.applyCompanionGiftRealmTransition(
  player)` (naming mirrors `applyTechniqueRealmTransition` /
  `applySwordPathRealmTransition`) delegates to
  `issueCompanionGifts(player, {kind:'realm_entered', realmId:
  player.realmId})`, called post-write at BOTH realm-write seams:
  `TribulationOutcomeService.resolveVictory` ~:240 beside
  `grantCultivationPathRealmReward` (needs the NEW realmId), and
  `chooseCultivationPath`'s mortal→qi_refining promotion
  (realmAdvanceOps ~:321, beside `markQuestRealmTransition`) — the
  trigger type must not silently miss one of the two write seams even
  though the provisional moments only target Trúc Cơ.
- No arrival toast in v1 (C2C flag F5): issue-time notification would
  need a notification sink plumbed into both seams; the `qua_tang` tab
  surfaces pending gifts instead. Claim-time grants do push the usual
  `kind:'loot'` notification.

## 6. Claim transaction

`GameManagerCompanionOps.claimCompanionGift(giftId)` — companion
acquisition authority, same DI/deps as the sibling ops (resolves
`definition` via the full `COMPANIONS` catalog — gifts may grant any
authored companion, not only Beta):

```ts
export type ClaimCompanionGiftResult =
  | { ok: true; alreadyClaimed: false; definition: CompanionDefinition;
      kind: 'new' | 'constellation_up' | 'constellation_maxed';
      constellationRankAfter?: number; duyenPhan: number }
  | { ok: true; alreadyClaimed: true; definition: CompanionDefinition }
  | { ok: false; reason: 'unknown_gift' | 'realm_locked' | 'no_active_player' }
```

Order:

1. `no_active_player` → `realm_locked` (`isCompanionDomainUnlocked` —
   same domain gate as siblings).
2. Record lookup by `giftId`; absent, or `definitionId` unresolvable in
   `COMPANIONS` → `unknown_gift` (defensive — save validation already
   rejects unresolvable ids).
3. `record.claimed === true` → `{ok:true, alreadyClaimed:true,
   definition}` — pure read: NO grant, NO duyenPhan, NO state writes
   (re-claim returns prior state — the idempotency contract).
4. Grant per the ONE duplicate rule (A9 — pull parity, not the
   exchange's spend-gate reject):
   unowned → `player.companions.push(createCompanionInstance(definition))`,
   `kind:'new'`;
   owned → `applyConstellationRank(owned)` → write back `ranked.instance`,
   `kind:'constellation_up'`;
   `ranked.maxed` → `player.duyenPhan += DUPLICATE_MAXED_DUYEN_PHAN` (5),
   `kind:'constellation_maxed'` — a claim never rejects on a maxed
   constellation, it converts like a pull does.
5. `record.claimed = true` written AFTER the grant decision — the
   consume mark lands only on a completed grant.
6. `kind:'loot'` notification (`Quà tặng: <name>`); return ok.

Decision-at-claim semantic (pinned): the grant resolves against owned
state at claim time, not at issue time — a gift claimed after the
companion was acquired by another route resolves as the duplicate rule,
not a second instance (1-instance-per-definition invariant preserved).

## 7. UI surfaces

All presentation only — components render ops results and the persisted
slice, never re-derive grants.

- `WorkerLodgePanel.vue`: `TABS` gains `{ id: 'qua_tang', label:
  t('workerLodge.tabs.quaTang') }` inside the existing
  `isCompanionDomainUnlocked` gate (gift records are TC-domain state);
  `v-else-if="activeTab === 'qua_tang'"` → `<QuaTangTab />`. The
  nhan_cong fallback watch needs no change.
- `worker-lodge/QuaTangTab.vue` (new, mirrors ChieuMoTab structure):
  pending list (unclaimed records — definition name + grade label +
  claim `GameButton`), claimed list dimmed with `quaTang.claimed`
  marker, `quaTang.empty` empty state. Claim →
  `companionOps.claimCompanionGift(id)` → warning notification on
  `{ok:false}` (errors map `quaTang.errors.*`) else success notification
  reusing `chieuMo.result.*` outcome copy + `bumpState()`.
- `ChieuMoTab.vue`: `poolEnabled` computed via
  `companionAcquirablePool().length > 0`; when off, the pull button is
  disabled AND a `.chieu-mo__unavailable` block renders
  `t('chieuMo.unavailable')` — release-policy reason style, naming the
  Quà Tặng route (copy C2C flag F2). Status bar (tokens/duyenPhan/pity)
  stays visible — banked state is honest. `pullErrorMessage` gains the
  `'pool_unavailable'` arm → same copy.
- `DuyenPhanTab.vue`: `groups` reads `companionAcquirablePool()` instead
  of `BETA_COMPANIONS` directly; when the pool is empty the grade rows
  are replaced by `t('duyenPhan.unavailable')` (not merely zero rows —
  the surface must say why); `exchangeErrorMessage` gains the
  `'pool_unavailable'` arm.
- i18n (P16, en + vi): `workerLodge.tabs.quaTang`, `chieuMo.unavailable`
  + `chieuMo.errors.poolUnavailable`, `duyenPhan.unavailable` +
  `duyenPhan.errors.poolUnavailable`, new `quaTang.*` namespace
  (`pending`/`history`/`claim`/`claimed`/`empty`/`errors.*`).
  `companion.empty` copy untouched (still routes to Chiêu Hiền Quán —
  the gift tab lives there; noted limitation, polish belongs to the
  content pass).

## 8. Save contract

- `CURRENT_SAVE_VERSION 75 → 76` + changelog comment per convention;
  old saves rejected (no migration, no translator).
- `createDefaultPlayer()` gains `companionGifts: []`.
- `saveShapeValidation.ts`: `requireArray(player, 'companionGifts',
  'player', issues)` + new `validateCompanionGiftEntries` beside
  `validateCompanionEntries`: `id` nonempty + unique,
  `definitionId` resolvable in `COMPANIONS` (fail loud like companion
  entries — an unresolvable record is dead state), `claimed` via
  `requireBoolean`. Record `id` is NOT validated against
  `COMPANION_GIFT_MOMENTS` (records outlive authored moments).
- Restore needs no field-level work — `player` restores as a blob; the
  slice rides with it.

## 9. Consistency invariants

- `companionGifts` ids unique; at most one record per moment id ever
  exists (write-if-absent fire).
- `claimed` is one-way `false → true`; a claimed record never re-grants
  and never un-marks.
- Issue and claim are both idempotent: moment re-fire appends nothing;
  re-claim returns `alreadyClaimed` with zero state deltas.
- `player.companions` keeps 1-instance-per-definition; gift grants obey
  the same duplicate rule as pull/exchange grants.
- Ops never debit `chieu_hien_lenh`/`duyenPhan` when the pool is
  unavailable; `rollCompanionPull` is unreachable with an empty pool.
- Recurring token origination is fully suppressed while the flag is
  off; banked tokens/duyenPhan/pity persist (nothing strips them).
- Companion coefficients unchanged: `COMPANIONS`, `BETA_COMPANION_IDS`,
  `COMPANION_BASE_RATES`, `PITY_*`, `DUPLICATE_MAXED_DUYEN_PHAN`,
  `EXCHANGE_COST`, exp/feed curves — all untouched (diff-scoped).

## 10. Out of scope (restated)

- Final authored trigger moments (content pass — the two provisional
  entries pin seam coverage, marked DEFERRED).
- Coefficients/balance; pull-pool re-enable; UI redesign; migration.
- Arrival toast / mail chrome (F5), gift-of-materials/currency payloads
  (F1).

## 11. C2C flags

| # | Flag |
|---|---|
| F1 | Slice shape: pinned `companionGifts` (companion-scoped, smallest coherent) vs generic `claimableRewards` envelope if non-companion payloads are anticipated this phase. |
| F2 | Unavailable copy wording — pinned: release-reason style `Chưa mở trong bản hiện tại` + Quà Tặng pointer on both gacha tabs. |
| F3 | Gift surface placement — pinned: `qua_tang` tab inside WorkerLodgePanel (the building already hosts the acquisition surfaces) vs a CompanionPanel section. |
| F4 | Provisional moments — than_nong @ `realm_entered foundation_establishment`; khai_minh @ `stage_completed foundation_floor_10` (the ex-token-drop boss). Both DEFERRED to the content pass; review = seam coverage, not placement. |
| F5 | No issue-time toast in v1 (would need a notification sink at both fire seams) vs plumbing one for discoverability. |
| F6 | `record.id === moment.id` (provenance folded into the dedupe key) vs separate `sourceMomentId` field for future multi-record moments. |

## 12. Acceptance

| # | Acceptance |
|---|---|
| A1 | `pullCompanion`/`exchangeCompanion` reject `{ok:false,reason:'pool_unavailable'}` BEFORE any currency check/debit while the flag is off; banked tokens, duyenPhan, pity untouched; pull architecture intact. |
| A2 | Empty pool is an explicit valid state: ops never reach `rollCompanionPull`/`pickDefinitionOfGrade` with an empty pool (flag-off and empty-authored-pool share the path); both gacha tabs render the release-style unavailable reason instead of dead controls. |
| A3 | `issueCompanionGifts` appends pending records for matching moments only, write-if-absent — repeated fires with the same trigger are pure no-ops; the moment registry validates (unique ids, definitionId ∈ COMPANIONS, stage/realm refs resolve). |
| A4 | Claim grants per the pull duplicate rule (new → fresh instance; owned → constellation_up; maxed → +5 duyenPhan), marks `claimed`, notifies; double-claim returns `alreadyClaimed` with zero balance/state deltas; unknown/realm/no-player reject without mutation. |
| A5 | `realm_entered` seam fires at the tribulation advance (post realmId write) and at the initiation promotion; `stage_completed` seam fires inside the first-completion once-guard only. |
| A6 | `daily_chieu_hien_lenh` never activates (quest unlock consult), a stale active deactivates on reconcile, claim-item filter drops the token, floor-10 boss signatureDrop suppressed at settle — non-token rewards on the same sources unaffected. |
| A7 | Save 75→76; v75 payloads rejected; `companionGifts` shape/unique/catalog-ref validated; records round-trip; moment-id drift tolerated. |
| A8 | Companion coefficients unchanged — catalog, Beta ids, rates, pity, exchange costs, constellation value all untouched. |
