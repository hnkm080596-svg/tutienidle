# P1-M0 — Path Capability & Inference Inventory

Date: 2026-09-20. Baseline: `a4a83570` (post-V2 merge), `CURRENT_SAVE_VERSION = 67`.
Scope: every production read that decides behavior from cultivation path/way
identity, slice presence, skill ownership, or node ownership — classified per
the P1 plan (owner read / capability candidate / branch read / defect).

## Census method

Greps over `game/src`: `cultivationPath|cultivationWay|getActiveWay|
getActivePath|getActiveWayDefinition|isKiemTu|isPhapTu|isTheTu|usesTheResource|
BASIC_ATTACKS_BY_BUILD|van_phap_than_hoa` (878 hits / 104 files) plus
`player.kiemTu|player.phapTu|skillManager.has(|linh_ngo_|cuong_chien|tran_the`
(58 files). Test files excluded from the migration table (they pin behavior,
they don't own reads).

## (a) Legitimate canonical reads — keep, no migration

| Site | Read | Why it stays |
|---|---|---|
| `core/player/**` (System, Kit, Registry, Runtime) | pair fields, predicates, slices | the authority itself |
| `core/{kiem-tu,phap-tu,the-tu}/**` | own slices, own predicates | module internals |
| `core/progression/NodeSystem.ts:301,312` | `nodePathApplies`/`nodeWayApplies` vs `requiredCultivationPath`/`requiredWay` | declared-data gating; NodeSystem owns it |
| `services/save/**` | pair coherence + slice shapes | the boundary contract |
| `getActiveWayDefinition` consumers (`ArtifactPanel:49`, `CharacterPanel:43`, `Artifact.ts:86`, `kiemBarBridge:107`) | resolves persisted pair → way def | the canonical resolver itself |
| `QuanKhiPanel.vue` `listOfferableWays`, `!player.cultivationPath`, `player.cultivationWay` | authority offer list + canonical fields | already routed via the authority |
| `stores/player.ts:146` → `PlayerVisualForm.ts` | `cultivationPath` → visual profile id | keyed content on the canonical field (same class as `BASIC_ATTACKS_BY_BUILD`) |
| `PhaserCanvas.vue:117` | watch `player.cultivationPath` for republish | change detection on the canonical field |
| `data/**` (`TurnBasicAttacks`, `NguHanhChau`, `StatusVfxPresets`, `ReactionStatusBuffs`, `PhapTuRouteSkills`, node packs) | path-keyed content tables | declared data, not inference |
| `GameManagerTurnBattleOps.ts:1218-1237,1346-1359,1388-1435` | reaction wiring + `grantsElementalReactionAura` consumers | canonical combat carrier A; both seams consume the runtime method |
| `core/battle/runtime/capability/**`, `core/reaction/**`, `core/the-tu/TheEconomy.ts` | participant-local buff2 capability grants | canonical combat carrier B |
| `App.vue:533-545` (`skillManager.has('tram'|'linh_bao'|'huy_quyen')`) | idempotent restore grants | skill-presence for grant idempotence, NOT identity inference |
| `GameManagerProgressionOps.ts:401` (`cultivationPath !== undefined`) | any-path gate for mortal precursors | direct canonical field read — "was a path chosen", no inference |
| `GameManagerRealmAdvanceOps.ts:170-172,230-237` | ritual guards + way.skillIds grants | canonical ritual op |
| `KiemPhoSystem.ts:76-78`, `NguKiemDao*`, `PhapTuRoutes*` | module-owned slice reads | module internals |
| `Registry:486` `getNodeLevel('cuong_chien')` | root-mutex read at the dispatch site | inside `core/player` — allowed seam |

## (b) Capability candidates — migrate to capability reads

| Site | Today | Capability |
|---|---|---|
| `core/pill/PillSystem.ts:156` | `isPhapTuNguHanh` gates MP pills | `phap_tu.elemental_casting` (static) |
| `core/progression/NodeSystem.ts:507,594` | `isPhapTuNguHanh` gates `switchRoute`/`previewRouteSwitch` | `phap_tu.elemental_casting` (static) |
| `core/game/GameManager.ts:479` | `routeProfileProvider`: `isPhapTuNguHanh` + `phapTu.element` + kit membership | `phap_tu.elemental_casting` + `getActiveElement` |
| `core/game/GameManagerProgressionOps.ts:206,332` | `selectPhapTuElement`/`switchRoute` gates | `phap_tu.elemental_casting` |
| `core/game/GameManagerProgressionOps.ts:110` | `getPhapTuElement` predicate+slice | `getActiveElement` delegate |
| `core/game/GameManagerProgressionOps.ts:427` | `setKiemPhoPreset`: `!kiemTu \|\| !isKiemTuHien` | `kiem_tu.kiem_pho` + slice null-narrow |
| `core/game/GameManagerRealmAdvanceOps.ts:86` | `player.kiemTu && isKiemTuNgu` → merge | `kiem_tu.ngu_kiem_dao` + slice null-narrow |
| `core/tribulation/BreakthroughOutcomeService.ts:111` | `isPhapTuNguHanh` in documented-dead major-realm branch | `phap_tu.elemental_casting` (static) |
| `core/player/CultivationPathRegistry.ts:465` | `skillManager.has(ngo_dao_hon_don)` open-codes the aura condition | `phap_tu.reaction_aura` (conditional, `hasSkill` dep) |
| `presentation/bridges/kiemBarBridge.ts:103-118` | `!kiemTu` presence → `usesTheResource` flag → Thế fallback | `the_tu.the_economy` (static); `usesTheResource` retires |
| `presentation/bridges/kiemBarBridge.ts:120,142` | `isKiemTuHien`/`isKiemTuNgu` pick bar mode | `kiem_tu.kiem_pho`/`kiem_tu.ngu_kiem_dao` (static) |
| `presentation/bridges/theBarBridge.ts:78` | `isPhapTuNguHanh` gates Thế bar | `phap_tu.the_pool` (static) |
| `presentation/bridges/theBarBridge.ts:82` | `player.phapTu?.element` | `getActiveElement` |
| `presentation/bridges/theBarBridge.ts:102` | `linh_ngo_<godUlt>` node ownership | `phap_tu.empowered_ult` (conditional — nodeLevels only, no deps) |
| `components/game/combat/hud/TurnCombatSkillBar.vue:65` | `isPhapTuNgoDao` gates the dao emblem | `phap_tu.reaction_aura` via bound facade (emblem = aura indicator) |
| `components/panels/SkillPathPanel.vue:56-75,189-197,230` | predicate chains → tree visibility/tag; element tabs | way-declared `nodeTreeTag` (fixed-tag ways) + `phap_tu.elemental_casting` (element tabs) + `getActiveElement` |
| `components/panels/loadout-sections/NodeTreePanel.vue:100` | `isPhapTuNguHanh ? phapTu.route : null` | `phap_tu.elemental_casting` + `getActiveRoute` |
| `components/panels/QuanKhiPanel.vue:140-157` | `isKiemTuHien\|\|isKiemTuNgu`, `isKiemTuNgu` for spec card + preset editor | `getActivePathId`/`getActiveWayDefinition().id` canonical reads + `kiem_tu.kiem_pho` for the preset editor |
| `components/panels/CharacterPanel.vue:34` | `isKiemTuHien\|\|isKiemTuNgu` gates Quán Khí entry | `getActivePathId(player) === 'kiem_tu'` |
| `saveShapeValidation.ts:438-557` | hardcoded slice-shape/pair blocks | module `validatePersistedState` hooks (M6) |

## (c) Branch-state reads → typed canonical reads (M3)

| Axis | Owner (state) | Readers needing the canonical read |
|---|---|---|
| `phapTu.element` | `player.phapTu` (commit: `selectPhapTuElement`) | theBarBridge, SkillPathPanel, GameManager provider, ProgressionOps |
| `phapTu.route` | `player.phapTu` (same atomic commit; `switchRoute` writes) | NodeTreePanel |
| `kiemTu.preset` | `player.kiemTu` (write: `setKiemPhoPreset`) | kiemBarBridge:126, QuanKhiPanel:179 |
| the_tu root (`cuong_chien`/`tran_the`) | `player.nodeLevels` (NodeSystem) | **no external reader** — registry-internal only → NO canonical read added (no speculative API) |

## (d) Defects — inference that can disagree with the committed pair

None that produce wrong outcomes: `kiemBarBridge:103`'s `!kiemTu` presence check is fail-closed (a `kiem_tu` way with a missing slice is a corrupt save rejected by validation). It still migrates in M5 — presence-checks as identity signals are exactly what P1 removes.

## Confirmed capability vocabulary (every entry has ≥1 real consumer)

| Capability | Way | Kind | Consumers |
|---|---|---|---|
| `phap_tu.elemental_casting` | ngu_hanh | static | PillSystem, NodeSystem route ops, GameManager route provider, selectPhapTuElement, BreakthroughOutcomeService, SkillPathPanel, NodeTreePanel |
| `phap_tu.the_pool` | ngu_hanh | static | theBarBridge |
| `phap_tu.empowered_ult` | ngu_hanh | conditional (`linh_ngo_<element>` node owned — reads nodeLevels+phapTu only) | theBarBridge `empowered` |
| `phap_tu.reaction_aura` | ngo_dao | conditional (`ngo_dao_hon_don` learned — needs `hasSkill` dep) | `grantsElementalReactionAura` (entry + revive seams), TurnCombatSkillBar emblem |
| `kiem_tu.kiem_pho` | hien | static | setKiemPhoPreset, kiemBarBridge hien mode, QuanKhiPanel preset editor, SkillPathPanel `kiem_pho` tag |
| `kiem_tu.ngu_kiem_dao` | ngu | static | applyKiemTuRealmTransition, kiemBarBridge ngu mode, SkillPathPanel `ngu_kiem` tag |
| `the_tu.the_economy` | ung_the | static | kiemBarBridge Thế-bar branch (replaces `usesTheResource`) |

**Cut from the seed table (no real consumer):** `the_tu.root_kit` — the
root-mutex kit read lives inside `core/player`'s dispatch site; nothing
outside the module consumes it. The `subpaths` axis declaration still
documents `root` ownership in nodeLevels.

## Deps-surface decision (resolves open question 4)

Only `phap_tu.reaction_aura` needs `PathCapabilityDeps.hasSkill` (learned
skills live in `SkillManager`, not `PlayerData`). Contract split:

- `hasStaticPathCapability(player: PathWayRead, cap)` — deps-free, narrow
  read; answers ONLY from the way's `static` list (conditional caps return
  false — conservative, documented).
- `resolvePathCapabilities(player, deps)` / `hasPathCapability(player, cap,
  deps)` — full resolver over a narrow conditional-read shape
  (`PathWayRead & Pick<PlayerData,'nodeLevels'|'phapTu'|'kiemTu'>`) so
  `TheBarPlayerState`/`KiemBarPlayerState` satisfy it where their consumed
  predicates allow.
- `gameManager.hasPathCapability(cap)` — bound facade for presentation
  (binds `activePlayer` + `skillManager.has` once).

## Amendments applied to the plan (M1–M7)

1. `the_tu.root_kit` capability and `getTheTuRoot` read dropped (no
   external consumer). `subpaths` keeps the `root` axis as ownership
   documentation only.
2. `usesTheResource` field retires in M5 after kiemBarBridge migrates to
   `the_tu.the_economy` (its only reader).
3. New canonical read `getActivePathId(player)` (`getActiveWayDefinition
   ?.pathId`, fail-closed) for "is on path X" gates — CharacterPanel:34,
   QuanKhiPanel:140-157.
4. Way definition gains `nodeTreeTag?: string` (fixed tree-tag ways:
   kiem hien→`kiem_pho`, ngu→`ngu_kiem`, the_tu hien→`the_tu`,
   ung_the→`the_tu_an`); ngu_hanh declares none — its tag is the browsed
   element via `phap_tu.elemental_casting` + `getActiveElement`.
5. `BreakthroughOutcomeService.ts:111` added to the M5 list (was M0-verdict
   pending — now confirmed `isPhapTuNguHanh` inside the documented-dead
   major-realm branch migrates to `phap_tu.elemental_casting`).
