# M-F-COMPANION-GIFT — Beta companion acquisition via authored gifts — plan

Spec: `game/docs/specs/m-f-companion-gift-spec.md` (v3 — C2C round-49
+ round-53 findings applied; pending C2C plan review). Implements F13 (ruling §42–45): no active pull pool in
Beta — Thần Nông/Khai Minh arrive via authored gift moments (claimable
records + idempotent claim); pull/exchange architecture kept behind
`isCompanionPullPoolEnabled` with the empty pool as an explicit valid
state; recurring `chieu_hien_lenh` sources suppressed at origination via
ReleasePolicy. Scope limits per ruling: no authored moment placement
beyond the DEFERRED-marked provisional list (content pass), no
coefficient changes, no UI redesign, no migration (v76-and-below
rejected on the merged base).

Phase 1 delivered docs only; Phase 2 begins after C2C spec + plan
gates pass.

## Step 0 — seam census (done during spec)

- `core/realm/ReleasePolicy.ts`: CEILING authority — gains
  `isCompanionPullPoolEnabled()` (Beta `false`),
  `COMPANION_PULL_TOKEN_MATERIAL_IDS` census (`['chieu_hien_lenh']`),
  `isCompanionPullTokenSourceSuppressed(itemId)` = `!flag && census.has`.
  Origination-only invariant: nothing re-checks at restore/delivery.
- `core/companion/CompanionAvailability.ts`: already composes
  ReleasePolicy — gains `companionAcquirablePool()` = `flag ?
  BETA_COMPANIONS : []` (one pool view for ops + UI).
- `core/game/GameManagerCompanionOps.ts`: `pullCompanion` order becomes
  `no_active_player → realm_locked → pool_unavailable → missing_token →
  debit+roll` — pool check on `companionAcquirablePool().length === 0`
  before token touch, so flag-off and empty-authored-pool share the
  explicit rejection and `pickDefinitionOfGrade` stays unreachable.
  `exchangeCompanion` gains the same `pool_unavailable` gate before the
  catalog lookup. New `claimCompanionGift(giftId)` — player →
  `isCompanionDomainUnlocked` → record lookup (absent, `definitionId`
  unresolvable in `COMPANIONS`, or `!isBetaCompanionGift` →
  `unknown_gift`) → `alreadyClaimed` no-op → pull-parity grant (new
  instance / `applyConstellationRank` write-back / maxed →
  `+DUPLICATE_MAXED_DUYEN_PHAN`) → `claimed = true` last →
  `kind:'loot'` notification. `COMPANIONS` (full catalog) resolves gift
  definitions.
- `core/companion/CompanionGifts.ts` (new): `issueCompanionGifts(
  player, trigger, moments = COMPANION_GIFT_MOMENTS)` — pure,
  write-if-absent append of `{id: moment.id, definitionId,
  claimed:false}`, returns appended records (empty = no-op); skips
  moments whose `definitionId` fails `isBetaCompanionGift` (defensive
  — an unclaimable record must never be issued). Moments injected like
  `pullCompanion`'s pool.
- `data/companion/CompanionGiftMoments.ts` (new):
  `CompanionGiftTrigger` union (`realm_entered`/`stage_completed`),
  `CompanionGiftMoment`, `COMPANION_GIFT_MOMENTS` with the two
  DEFERRED-marked provisional entries (than_nong @ realm_entered
  foundation_establishment; khai_minh @ stage_completed
  `foundation_floor_10` — the ex-token-drop boss stage).
- `data/companion/Companions.ts`: `CompanionGiftRecord` type beside
  `CompanionInstance` (shared persisted shape, multi-consumer);
  `BETA_COMPANION_GIFT_IDS` + `isBetaCompanionGift` — the Beta
  gift-acquisition authority (C2C round-49 HIGH: enforced at registry
  integrity, issue-fire skip, claim reject, save preflight).
- `core/player/Player.ts`: `PlayerData.companionGifts` required field
  beside `companions`; `createDefaultPlayer` initializes `[]`.
- `core/game/GameManagerRealmAdvanceOps.ts`:
  `applyCompanionGiftRealmTransition(player)` (mirrors
  `applyTechnique/applySwordPath` naming) delegates to
  `issueCompanionGifts(player, {kind:'realm_entered', realmId:
  player.realmId})`.
- `core/tribulation/TribulationOutcomeService.ts:~240`: post realmId
  write, beside `grantCultivationPathRealmReward` — call the ops
  wrapper. Plus `GameManagerRealmAdvanceOps.chooseCultivationPath`'s
  mortal→qi_refining promotion (~:321, beside
  `markQuestRealmTransition`) — both realm-write seams covered.
- `core/game/GameManagerBattleRewardOps.ts:~168`: inside the
  first-completion once-guard, right after
  `completedStageIds.push(stage.id)` — direct
  `issueCompanionGifts(playerData, {kind:'stage_completed', stageId:
  stage.id})`.
- `core/quest/QuestSystem.ts:L31` `isUnlocked`: `&&
  !questIsTokenOnlySource(quest)` — quest suppressed ONLY when its
  entire granted reward set is suppressed pull-token lines (`itemDrops
  non-empty` + `reward.reward === undefined` + every itemDrop is a
  censused material token): `daily_chieu_hien_lenh` is token-only on
  base → suppressed; a mixed-reward quest stays unlocked minus its
  token lines (A6 consistency, C2C round-49). Covers activation
  candidates, the R8.1 deactivation inverse pass, and the daily-list
  query. `claim` material `itemDrops` branch gains the same `continue`
  filter beside `isBreakthroughAcquisitionEnabled`.
- `core/game/BattleLootSystem.ts:~546` material branch: `if
  (isCompanionPullTokenSourceSuppressed(drop.itemId)) break` beside the
  breakthrough check (post-resolve, rng order untouched).
- `components/panels/WorkerLodgePanel.vue`: `TABS` + `qua_tang` entry
  inside the existing domain gate; new
  `components/panels/worker-lodge/QuaTangTab.vue`.
- `ChieuMoTab.vue`: `poolEnabled` gate → disabled button + unavailable
  block; `pullErrorMessage` `'pool_unavailable'` arm.
- `DuyenPhanTab.vue`: `groups` reads `companionAcquirablePool()`;
  empty → unavailable block; `exchangeErrorMessage` arm.
- `locales/en.json` + `locales/vi.json`: `workerLodge.tabs.quaTang`,
  `chieuMo.unavailable`/`errors.poolUnavailable`,
  `duyenPhan.unavailable`/`errors.poolUnavailable`, `quaTang.*`.
- `services/save/saveVersion.ts`: `CURRENT → CURRENT+1` on the merged
  base at implementation start (expect 76→77 once M-F-TALENT lands;
  verify at phase-2 start) + changelog comment;
  `saveShapeValidation.ts` `requireArray` + `validateCompanionGiftEntries`
  (`definitionId ∈ BETA_COMPANION_GIFT_IDS` — fail loud on persisted
  future-realm gifts).

## Step 1 — TDD failing tests first

1. `core/realm/ReleasePolicy.test.ts` (extend): Beta
   `isCompanionPullPoolEnabled() === false`;
   `isCompanionPullTokenSourceSuppressed` true for `chieu_hien_lenh`,
   false for other material ids; census ↔ `COMPANION_PULL_TOKEN_ID`
   equality + every census id resolves in the material registry.
2. `core/companion/CompanionGifts.test.ts` (new): matching trigger
   appends pending records; non-matching trigger appends nothing;
   second identical fire is a pure no-op (idempotent); different
   trigger kinds don't cross-fire; a moment whose `definitionId` is not
   in `BETA_COMPANION_GIFT_IDS` is skipped (injected fixture); moment-
   list integrity — unique ids, every `definitionId` satisfies
   `isBetaCompanionGift`, `BETA_COMPANION_GIFT_IDS ⊆ COMPANIONS`,
   `realm_entered` refs in `REALMS`, `stage_completed` refs in
   `STAGES`.
3. `GameManagerCompanionOps` tests (extend — pull/exchange scopes):
   pull with tokens on hand rejects `pool_unavailable` and the bag is
   untouched; exchange rejects `pool_unavailable` before
   `unknown_definition`; `claimCompanionGift` full matrix — new grant
   pushes a mortal/level-1 instance; owned grant writes
   constellation_up; maxed grant credits exactly
   `DUPLICATE_MAXED_DUYEN_PHAN`; claimed record set once; second claim
   returns `alreadyClaimed` with companions/duyenPhan snapshots
   unchanged; `unknown_gift`/`realm_locked`/`no_active_player` reject
   without mutation; a record whose `definitionId` is catalog-valid
   but outside `BETA_COMPANION_GIFT_IDS` rejects `unknown_gift`
   (defense path — gift channel cannot widen the Beta acquisition
   surface).
4. `core/quest/QuestSystem.test.ts` (extend): `daily_chieu_hien_lenh`
   absent from activation candidates and the daily list at TC; a
   pre-activated stale progress deactivates on
   `reconcileActiveQuests`; forced `claim` on a completed copy drops
   the token item while other rewards land; non-token daily quests
   unaffected; a mixed-reward fixture quest (token line + cultivation
   reward) stays UNLOCKED and its claim drops only the token line
   (A6 consistency).
5. `BattleLootSystem` drop tests (extend): floor-10 boss
   `signatureDrop` material line never lands `chieu_hien_lenh` in the
   bag (post-resolve suppression); sibling material drops on the same
   resolve unaffected.
6. `GameManagerBattleRewardOps`/stage-completion test (extend): first
   completion of `foundation_floor_10` appends the khai_minh gift
   record exactly once; a refight win on an already-completed stage
   issues nothing.
7. `TribulationOutcomeService.test.ts` (extend): major-realm advance
   into foundation_establishment appends the than_nong record once;
   repeat fire idempotent; qi_refining announcement-only path issues
   no record (and `chooseCultivationPath` promotion fires a
   `realm_entered` moment only when one targets that realm — asserted
   via an injected test moment).
8. `WorkerLodgePanel`/`QuaTangTab`/`ChieuMoTab`/`DuyenPhanTab`
   component tests (extend/new): `qua_tang` tab listed at TC, hidden
   below; pending gift renders name+claim, claim drives ops +
   notification; claimed renders dimmed; unavailable blocks render on
   both gacha tabs with the release-reason copy and the pull button
   disabled.
9. `GameManagerSaveRestore`/save-shape tests (extend): CURRENT+1
   round-trips `companionGifts`; malformed records reject (missing id,
   duplicate id, unknown definitionId, definitionId outside
   `BETA_COMPANION_GIFT_IDS`, non-boolean claimed); record with id not
   in `COMPANION_GIFT_MOMENTS` still validates (drift tolerance);
   prior-version payload rejected (expect v76 when M-F-TALENT lands —
   pin the bumped number at implementation start).

## Step 2 — data + policy + state

- `data/companion/Companions.ts`: `CompanionGiftRecord` beside
  `CompanionInstance`; `BETA_COMPANION_GIFT_IDS` +
  `isBetaCompanionGift` (Beta gift-acquisition authority).
- `data/companion/CompanionGiftMoments.ts`: trigger/moment types +
  `COMPANION_GIFT_MOMENTS` (DEFERRED-marked provisional list).
- `core/player/Player.ts`: `companionGifts` field + `createDefaultPlayer`.
- `core/realm/ReleasePolicy.ts`: `isCompanionPullPoolEnabled()`,
  `COMPANION_PULL_TOKEN_MATERIAL_IDS`,
  `isCompanionPullTokenSourceSuppressed`.
- `core/companion/CompanionAvailability.ts`: `companionAcquirablePool()`.

## Step 3 — domain + ops

- `core/companion/CompanionGifts.ts`: `issueCompanionGifts`
  write-if-absent fire (moments defaulted to the registry).
- `GameManagerCompanionOps.ts`: `'pool_unavailable'` in both result
  unions + both gates on `companionAcquirablePool().length === 0`;
  `claimCompanionGift` per spec §6 (gates → alreadyClaimed no-op →
  pull-parity grant → `claimed = true` → loot notification); import
  `COMPANIONS` for gift definition resolution.

## Step 4 — suppression + fire seams

- `QuestSystem.ts`: `questIsTokenOnlySource` helper (itemDrops
  non-empty + `reward.reward === undefined` + every itemDrop a
  censused material token) + `isUnlocked` consult + `claim`
  material-branch `continue` on suppressed lines.
- `BattleLootSystem.ts`: material-branch `break` beside the
  breakthrough check.
- `CompanionGifts` wiring: `realmAdvanceOps.applyCompanionGiftRealmTransition`
  + call at `TribulationOutcomeService:~240` + call inside
  `chooseCultivationPath`'s promotion block;
  `GameManagerBattleRewardOps` `issueCompanionGifts` call inside the
  once-guard after `completedStageIds.push`.

## Step 5 — UI + i18n

- `WorkerLodgePanel.vue`: `qua_tang` tab entry + render branch.
- `QuaTangTab.vue`: pending/claimed lists, claim → ops → notify +
  `bumpState`.
- `ChieuMoTab.vue`: `poolEnabled` disabled + unavailable block +
  error arm.
- `DuyenPhanTab.vue`: pool-driven groups + unavailable block + error
  arm.
- `en.json`/`vi.json`: tab label, unavailable copies (release-reason
  style `Chưa mở trong bản hiện tại` + Quà Tặng pointer — C2C flag
  F2), `quaTang.*` namespace, `errors.poolUnavailable` in both
  namespaces; grant outcome copy reuses `chieuMo.result.*`.

## Step 6 — save contract

- `saveVersion.ts` → `CURRENT_SAVE_VERSION + 1` on the merged base at
  implementation start (expect 76 → 77 once M-F-TALENT lands; verify
  at phase-2 start) + changelog comment per convention.
- `saveShapeValidation.ts`: `requireArray(player, 'companionGifts')` +
  `validateCompanionGiftEntries` (unique nonempty ids;
  `definitionId ∈ BETA_COMPANION_GIFT_IDS`; `claimed` boolean; no
  moment-id validation — drift tolerance).
- Confirm restore needs no field work (player blob replace).

## Step 7 — gates

- P3: quick `npm run type-check` + `npx vitest run <companion|quest|
  loot|tribulation|save|worker-lodge scopes>`; escalate to
  `npm run verify` (full) — PlayerData/save-shape + progression touch
  (P3 trigger).
- E3 simplify → P18 OCR (delegation mode) → P4 adversarial QA
  (progression/persistence/economy vectors — deep if quick QA flags
  breadth) → P5 sequential ≥3 passes with per-pass evidence blocks →
  commit + push + PR base `p7/truc-co`.
- P14 likely triggers (new tab + disabled-state surfaces) — Playwright
  pass on WorkerLodgePanel inside the checkout: gift tab visible,
  claim works, gacha tabs explain the closed pool.
- P15 ASCII scan on new comments; i18n keys en + vi.
- P13 check: no `GameManager.update`/boot/lifecycle path changed —
  fire seams are existing reward channels; reconcile is the existing
  tick consumer.
- Report to coordinator: branch, files, per-gate evidence, limitations.

## Per-delta acceptance map

| Delta | Spec § | Plan step | Acceptance test |
|---|---|---|---|
| 1 — pool flag + empty-pool contract | §3 | 2, 3 | A1, A2 |
| 2 — gift primitive (slice + claim + UI) | §2, §6, §7 | 2, 3, 5 | A4 |
| 3 — authored grant moments + seams | §2, §5 | 2, 4 | A3, A5 |
| 3a — gift-acquisition boundary | §2, §6, §8 | 2, 3, 6 | A9 |
| 4 — token-source suppression | §4 | 4 | A6 |
| 5 — save bump + validation | §8 | 6 | A7 |
| coefficients unchanged | §9 | diff-scoped | A8 |
| tests | §12 | 1 | A1–A9 |
