# Blind adversarial audit — beta scope contract, CONSUMER/INTEGRATION seams

- **Scope:** consumer seams only (combat build resolution, UI surfaces/panels/badges,
  stat assembly, vendor reads, reward/drop emission, quest claim/settle, production
  worker settle, alchemy settle/park, offline settle, decompose, notifications/toasts,
  tutorial triggers, migrations, event handlers, devtools, tri-state verdict honesty).
- **Pin:** `devin/qa-fixpoint` @ `ea406a1f` (tested exactly this state).
- **Method:** census of every consumer of the persisted way pair
  (`cultivationPath`/`cultivationWay`), the capability resolver family
  (`resolvePathCapabilities` / `hasStaticPathCapability` / `hasPathCapability` — none
  of which consults `isBetaWay`), every `isScopeHidden`-gated surface's sibling
  emitters, and restore-time consumers. Deterministic probes in
  `tests/architecture/betaConsumerHudChannels.qa.test.ts` (8 DEFECT assertions fail on
  the pinned state; 6 controls pass).
- **Verdict: FAIL** — one capability-resolver family re-admits every dormant way to
  four live HUD surfaces, plus a material-bag surface leak. All confirmed leaks are
  display-layer (no stat/effect mints found downstream); gating of combat build,
  economy faucets, quest/claim, settle/park, companions, and migrations is clean.

## Findings

### BCS-HUD-01 — carried `sword_pathway` mints the 'Kiếm Phổ' HUD bar mid-battle
- **Severity:** Medium · **Confidence:** Confirmed
- **Surface:** `src/presentation/bridges/kiemBarBridge.ts:116` — `swordPath &&
  hasStaticPathCapability(player, 'sword.sword_scroll')` → `mode:'kiem_pho'` snapshot
  `{preset, cursor, nextOrb, log}`; polled every frame via `CombatScene.pollKiemBar`.
- **Repro:** probe "a carried sword_pathway save emits the 'Kiem Pho' HUD bar"
  (reader returns the kiem_pho snapshot instead of null).
- **Mint path:** carried `cultivationWay:'sword_pathway'` + `swordPath.preset` →
  ungated static capability → per-frame HUD bar renders the persisted orb-loop
  preset (authored by the dormant system) during live beta combat.

### BCS-HUD-02 — carried `hidden_sword_pathway` mints the 'Kiếm Ý' HUD bar mid-battle
- **Severity:** Medium · **Confidence:** Confirmed
- **Surface:** `kiemBarBridge.ts:139` — `sword.sword_riding` → `mode:'ngu_kiem'`
  snapshot `{kiemY, kiemDaoCount, kiemDaoBase}`.
- **Repro:** probe "a carried hidden_sword_pathway save emits the 'Kiem Y' HUD bar".
- **Mint path:** carried way + persisted `kiemY`/`kiemDaoCount` → ungated capability
  → HUD shows dormant Ngu Kiem Dao progress (`Kiếm Ý · N kiếm`) every frame.

### BCS-HUD-03 — carried body ways mint the 'Thế' proc-fuel HUD bar mid-battle
- **Severity:** Medium · **Confidence:** Confirmed
- **Surface:** `kiemBarBridge.ts:107` — `hasStaticPathCapability(player,
  'body.essence_economy')` → `{current: entity.currentThe, max: theCap(entity),
  label:'Thế'}`.
- **Repro:** probe "a carried body way emits the 'The' proc-fuel HUD bar" (both
  `body_pathway` and `hidden_body_pathway`).
- **Mint path:** carried way → ungated capability → the dormant The-economy pool bar
  renders on every live battle.

### BCS-HUD-04 — carried body ways mint the Ung Thế HUD snapshot mid-battle
- **Severity:** Medium · **Confidence:** Confirmed
- **Surface:** `src/presentation/bridges/theBarBridge.ts:107` — `bodyEconomy =
  hasStaticPathCapability(player, 'body.essence_economy')` → snapshot carrying
  `thamTargetId`, `quanTheActive`, `reactionDebt`, `quaThe` (polled via
  `CombatScene.pollTheBar`). The spell arm is correctly gated to
  `spell.essence_pool`-only ways.
- **Repro:** probes "a carried hidden_body_pathway/body_pathway save emits the Ung
  The HUD".
- **Mint path:** same ungated capability → dormant Ung-The HUD structure (Tham focus,
  Quan The state, Ung Tre/Qua The feedback) renders during live combat; the
  corresponding combat effects are correctly suppressed by `wayAdmitted`, so the HUD
  also misrepresents live state (tri-state dishonesty).

### BCS-HUD-05 — carried `hidden_spell_pathway` mints the Ẩn aura emblem in the skill bar
- **Severity:** Medium · **Confidence:** Confirmed
- **Surface:** `src/components/game/combat/hud/TurnCombatSkillBar.vue:69` —
  `isAnPath = gameManager.hasPathCapability('spell.reaction_aura')` → emblem +
  `ngo_dao_hon_don` tooltip. Root: `GameManager.hasPathCapability` (GameManager.ts:1013)
  binds `pathCapabilityDeps` but the resolver never re-gates on `isBetaWay`.
- **Repro:** probe "hasPathCapability('spell.reaction_aura') resolves true on a
  carried hidden_spell save".
- **Mint path:** carried way + learned `ngo_dao_hon_don` → conditional capability
  resolves true → the emblem renders (claims the aura is live) while the aura
  entryBuff is suppressed at `CombatBuild.ts:347` (`wayAdmitted &&`). Dormant-way
  branding presented as live inside combat; emblem/ground truth disagree.

### BCS-SUR-06 — `MaterialBagSection` renders scope-suppressed materials as live cells
- **Severity:** Medium · **Confidence:** Confirmed
- **Surface:** `src/components/panels/bag-sections/MaterialBagSection.vue:233` —
  `entries = materialBag.getAll().map(...)` verbatim; no scope/domain filter (no
  `scopeHiddenMaterialFamilyOfId` predicate exists anywhere).
- **Repro:** probe "a carried companion pull token renders as an ordinary live cell"
  (mount with 3× `chieu_hien_lenh` → filled slot exists).
- **Mint path:** save carries `chieu_hien_lenh` (companion pull token) → restore
  preserves it (correct, dormancy) → bag renders an ordinary cell whose tooltip
  advertises the dormant gacha ("dùng tại Chiêu Hiền Quán") while its only sink
  (`pullCompanion`) is permanently `realm_locked` and `CurrencyHud` deliberately
  censors companion currencies at every realm. Sibling surfaces disagree on the
  verdict for the same id — nothing renders as progression-locked or scope-hidden.
  Same class covers other domain-scoped carried materials (e.g. `doan_bao_thach`).

### BCS-LAT-07 — `resolveCombatBuild` exports an ungated `capabilities` set (+ inert `survive.extraSources` bind)
- **Severity:** Low (latent) · **Confidence:** Suspected — inert today
- **Surface:** `src/core/game/CombatBuild.ts:374` `capabilities` export and :385
  `survive.extraSources` bind from the ungated `runtime` (not `gatedRuntime`).
- **Repro:** code census — `resolvePathCapabilities` ungated (probe "static
  capability reads admit every dormant way"); zero consumers of
  `build.capabilities` today; `survive.extraSources` inert because no way runtime
  implements `buildSurviveSources` (CultivationPathRegistry.ts:495 comment confirms
  "Beta: no buildSurviveSources").
- **Mint path:** any future consumer of `build.capabilities`, or a runtime that
  gains `buildSurviveSources`, would re-admit the dormant way with no scope gate —
  this is the sibling-emission-channel class the prior `survive.extraSources`
  finding warned about.

## Rejected / not-a-finding (recorded for completeness)
- `SkillPathPanel.vue:76` `wayIdentity` renders the dormant way's display name on a
  parked save — text label only, tree gated by `betaWayAdmitted` (:89). Honest-record
  display, same accepted class as hidden-carry realm flagging.
- `QuanKhiPanel.vue:235` resolves the hidden way id, but the panel is unreachable on
  carried saves (`showQuanKhiEntry` gated at CharacterPanel.vue:44-46) — latent, not
  live.
- Restore bag-overflow toast names a dormant material's template name when a carried
  stack exceeds `stackLimit` (e.g. >999 pull tokens) — Low; notification text only,
  hostile-save-only trigger; the record itself must be preserved.
- `enemySpawnDebug.ts` dev spawn lacks the roster check — dev-only seam, no
  production path.

## Verified clean seams (census, no findings)
Combat build resolution (`wayAdmitted` gates kit/roles/statDomains/maxThe/
buildDynamicBasic/formation/companion/aura/Tran-Phap buff), `collectActiveWayStatModifiers`
(`!isBetaWay` → []), spell element reads (fail closed on uncommitted/corrupt pairs),
`getWorkerAssignments`/`getWorkforceView`/`assignWorkers` + lodge tabs (censored),
alchemy start/tick (`scopeHiddenPillFamilyOfId` parks), vendor sell/preview/rows
(rejects dormant materials), quest claim itemDrops (breakthrough + pull-token +
domain-scope filters applied per line), companion ops (`isCompanionDomainUnlocked`
fails closed incl. hidden-carry realms), `companionGiftRosterFor` ([]), hidden-beast
spawn/onEnemyDefeated (double-gated), `resolveHiddenBattleReplacement` /
`isAncientBeastTrialEligible` (`isBetaFeature('hiddenContent')` gate), tribulation
settle (re-derives verdict — dormant committed outcomes park), `resolveBreakthroughType`
('hidden' unreachable under beta lock), auto-farm start/reconcile/settle
(stage-validity recheck), equipment wash/refine ops (all `isScopeHidden`),
CurrencyHud companion chips (`isBetaFeature && isCompanionDomainUnlocked`),
`survive-lethal` talent mint (beta-talent list re-gates), migrations/restore
(parks dormant slices, re-derives modifiers, reconcileWayGrants gated),
offline settle (same gated settle path), tutorial/event-bus/devtools census.

## Exclusion honored
Same-value forged counters within authored bounds (quest progress, timestamps) —
not reported, per brief.
