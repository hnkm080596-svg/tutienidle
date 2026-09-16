# Cultivation Path Framework — Implementation Plan (v3.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.

**Goal:** Normalize the three cultivation paths (Kiếm Tu / Pháp Tu / Thể Tu) into registered modules under one `CultivationPathSystem` authority, using the Path → Way → specialization-nodes model.

**Architecture:** Evolve `CULTIVATION_PATH_KITS` into the module catalog (no parallel registry). `CultivationPathSystem` (repurposed `core/player/CultivationPathSystem.ts`) owns `cultivationPath` + `cultivationWay` writes and ritual offer evaluation. Ways = path-owned branches (kit + node subtree + mechanic slice) all chosen at the Initiation Ritual. NodeSystem keeps node-investment authority; in-way branches keep their current owners (`phapTu` element/route, mutex root nodes, skill spec); RealmAdvanceOps keeps the ritual transaction.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Spec:** `game/docs/specs/2026-09-16-cultivation-path-framework-spec.md` (v3.1)
**Review:** `game/docs/specs/2026-09-16-cultivation-path-framework-review.md`

## Global Constraints

- **Preserve gameplay** — the ONLY approved behavior change: `kiem_tu` Ẩn (Ngự Kiếm Đạo) moves from mid-progression node flip to a ritual-time way offer (gate: `tram` Lv3, free entry; hien→ngu conversion permanently removed). Everything else must behave identically.
- **Save policy:** strict version rejection (v61→v64 each reject prior; dev phase, no migration, no compatibility bridges). Schema + authority + consumer + `saveVersion` bump land **together in each vertical cutover** — never as standalone schema missions.
- **No unused primitives/state:** do not land fields, interfaces, or registries without their production consumer chain in the same mission. Reviewer-verified rejections: no `pathSpecializations` record, no `kiemTuNgu` slice split, no generic `PathCombatContribution`, no `requiresSpecialization`/`setsSpecialization` node generics, no parallel `CultivationPathRegistry`.
- **P3 verification:** `quick` = `npm run type-check` + `npx vitest run <scope>` from `game/`. `full` = + `npm run build` + `npx vitest run` — mandatory for M2 (save shape + ritual), M7 (union shrink), M10.
- **P4:** adversarial QA (quick) after every production mission; deep for M2/M6/M7.
- **P5:** three-lens review round per mission. **P7:** commit steps describe granularity only — every commit needs explicit user authorization.
- **P13/P14:** M2/M4/M5/M6 require driving the real ritual→way→progression→combat flow via Playwright (`npm run dev`, read actual port).
- **P17/roadmap:** before touching `core/battle/turn/**`, battle-tick integration, or `CombatScene` — check roadmap combat-chain phases + `docs/qa/`.
- **`ngu` kit — decided** (spec §6.2): `techniqueId: 'van_kiem_quyet'`, `skillIds: []` (action set is provider-injected), offerGate `tram` Lv3, free entry. No longer a blocker.
- Per-mission report: changed / files / authority moved / adapters remaining / tests / build status / behavior changes (=None unless approved) / risks / next.

## Transition Model (read first)

During M2–M6 the legacy 5-id `CultivationPathId` union stays — `cultivationPath` keeps storing today's effective id (`'phap_tu_an'` etc.) so unmigrated consumers keep working. `applyPathChoice` additionally writes `cultivationWay` — the new authority truth. Each path mission (M4–M6) migrates that path's consumers to way-aware reads; **M7** flips `cultivationPath` to base ids and deletes `_an` members + all dual-write adapters.

---

## Mission 0 — Current-Git authority inventory (read-only)

**Files:**
- Create: `game/docs/architecture/2026-09-16-path-inventory.md`

- [ ] **Step 1 — Lock baseline:** record `git rev-parse HEAD` in the inventory doc; all "current state" claims reference this SHA.
- [ ] **Step 2 — Enumerate readers/writers:** grep `game/src` for `cultivationPath`, `kiemTu`, `phapTu`, `kiemTuMode`, `kiemTuModeSwitch`, `routeTag`, `elementTag`, `requiredCultivationPath`, `selectsSpecialization`, `chooseCultivationPath`, `getOfferableCultivationPaths`, `isCultivationPathOffered`, `phap_tu_an`, `the_tu_an`, `selectPhapTuElement`, `cultivationRitualFlow`. Record file:line, read vs write, owner.
- [ ] **Step 3 — Resolve unknowns:**
  - `selectPhapTuElement` home (likely `GameManagerProgressionOps.ts`) + its atomic element+route commit (INV-13)
  - element-reaction ownership (`core/` search: `reaction`, `elemental`) — for the §18 boundary
  - `kiem_tu_an` node's full prereq/effect chain in `data/progression/KiemTuNodes.ts` (live file — confirmed) → input for the `ngu` ritual gate design
  - `NodeBranchViews.ts` — existing tree partitioning; may already be the way-subtree view mechanism
  - **Battle-build seam** — how each path/way currently reaches battle build: `buildTheTuAnKit`, KiemPho/NguKiemDao providers, `GameManagerTurnBattleOps` kit resolution sites. This determines the way→combat contract shape (spec §18: name exactly this seam, no generic bag).
- [ ] **Step 4 — Write authority matrix + leak list** (P0–P3 classification).

**Exit criteria:** spec §2 rows confirmed/corrected against baseline SHA; every path-state writer has a named owner; battle-build seam documented concretely enough to write the M1 contract.

---

## Mission 1 — Minimal Path/Way contracts + evolve the kit catalog

No parallel types. `CultivationPathKit` fields become `PathWayDefinition` fields; `CULTIVATION_PATH_KITS` becomes the module catalog.

**Files:**
- Modify: `game/src/core/player/CultivationPathKit.ts` — evolve in place:
  - `CultivationPathKit` → `PathWayDefinition` (same fields: techniqueId, skillIds, statModifiers, realmRewards, offerGate, usesTheResource + `nodeIds`)
  - `CULTIVATION_PATH_KITS` → `CULTIVATION_PATH_MODULES: Record<CultivationPathId, CultivationPathModule>` — during transition this is a view over the same data: legacy 5-id entries map to (path, way) pairs
  - `CultivationPathId` union: **unchanged here** (5 ids, shrinks at M7) — do NOT create a second same-named type
- Create: `game/src/core/player/CultivationPathTypes.ts` — only types with no current home: `PathWayId`, `PathWayOffer`, `PathChoiceResult`, `CultivationPathModule`, `PathWayModule`, `PathStatContribution`, `PathLifecycleHooks`
- Update: all `CULTIVATION_PATH_KITS[...]` readers (M0 list) to the module shape
- Test: `game/src/core/player/CultivationPathKit.test.ts` (extend — catalog validity: unique way ids, kit refs resolve)

**Interfaces — Produces:**

```ts
type PathWayId = string
interface PathWayOffer { pathId: CultivationPathId; wayId: PathWayId; eligible: boolean; reason?: string }
interface PathWayModule {
  readonly definition: PathWayDefinition
  createInitialState?(): unknown
  readonly stats?: PathStatContribution          // only if the path owns a stat channel
  readonly lifecycle?: PathLifecycleHooks        // only hooks with real consumers
}
interface CultivationPathModule {
  readonly definition: { id: CultivationPathId; name: string; description?: string; icon?: string; ways: readonly PathWayId[] }
  readonly ways: Readonly<Record<PathWayId, PathWayModule>>
}
interface PathStatContribution {
  collectModifiers(player: PlayerData, totals: Pick<Stats, MainStatKey>): readonly StatModifier[]
  deltaDeriver?(delta: AttributeDelta): readonly StatModifier[]   // match registerDomainDeltaDeriver's existing signature — read it first
  domains: readonly string[]
}
interface PathLifecycleHooks {
  onChosen?(player: PlayerData, deps: PathChosenDeps): void
  onRealmAdvance?(player: PlayerData, realmId: string): void     // ngu merge semantics
}
```

Explicitly NOT created: `PathCombatContribution` (shape = the M0 seam finding; if the seam is just provider refs, the way module exposes those refs directly).

- [ ] **Step 1:** failing catalog tests (unique way ids per path; `nodeIds` resolve against the live node registry; technique/skill refs exist).
- [ ] **Step 2:** evolve types + catalog; update readers; type-check.
- [ ] **Step 3:** `npx vitest run src/core/player` + `npm run type-check`.
- [ ] **Step 4:** commit: `refactor(path): evolve kit catalog into path/way modules`

**Exit criteria:** one catalog, no parallel registry; all kit readers consume the module shape; zero behavior change (verification: quick).

---

## Mission 2 — Ritual Path/Way authority vertical slice

Schema + authority + consumer + save bump in ONE coherent change. This is the cutover mission for entry.

**Files:**
- Modify: `game/src/core/player/Player.ts` — add `cultivationWay?: PathWayId`
- Modify: `game/src/core/player/CultivationPathSystem.ts` — the authority: `listOfferableWays`, `applyPathChoice`, `getActivePath`, `getActiveWay`; existing offer functions become delegates
- Modify: `game/src/core/game/GameManagerRealmAdvanceOps.ts:172` — `chooseCultivationPath(pathId, wayId, player)`; path/way writes delegate to `applyPathChoice`; during transition `applyPathChoice` writes `cultivationWay` AND the legacy-effective `cultivationPath` id (`'phap_tu_an'` for `('phap_tu','ngo_dao')`) so unmigrated consumers keep working — flagged as the M7 deletion adapter
- Modify: `game/src/components/panels/QuanKhiPanel.vue` — offer list renders (path, way) pairs via `listOfferableWays`
- Modify: `game/src/services/save/saveTypes.ts`, `saveVersion.ts` (v65), `saveShapeValidation` — `cultivationWay` optional string; `cultivationPath` still validates the 5-id union
- Test: `CultivationPathSystem.test.ts` (new), `GameManager.theTuRitual.test.ts`, `GameManager.phapTuAnPath.test.ts`, `GameManager.kiemTuAn.test.ts`, `cultivationRitualFlow.integration.test.ts`, `saveShapeValidation.test.ts`, `SaveRoundTrip.test.ts`

**Interfaces — Produces:**

```ts
// CultivationPathSystem (authority — function-module or class per surrounding convention)
listOfferableWays(player: PlayerData): readonly PathWayOffer[]
applyPathChoice(player: PlayerData, pathId: CultivationPathId, wayId: PathWayId): PathChoiceResult
getActiveWay(player: PlayerData): PathWayId | undefined
```

- [ ] **Step 1:** failing tests — `listOfferableWays` = 3 base ways always + `ngo_dao` only at linh_bao Lv3 + `ung_the` only at huy_quyen Lv3 + `ngu` only at tram gate; `applyPathChoice` rejects unknown path/way, ineligible way, second choice — zero mutation on failure; legacy `cultivationPath` still receives the effective id.
- [ ] **Step 2:** implement authority + field + ritual delegation + panel pairs.
- [ ] **Step 3:** `saveVersion` bump → 65; validation + round-trip tests.
- [ ] **Step 4:** `npx vitest run src/core/player src/core/game src/services/save` + `npm run type-check` + `npm run build`.
- [ ] **Step 5 (P13/P14):** dev server → browser → create char → ritual shows correct (path, way) pairs at/below gates → choose → realm advances, kit granted, unequip contract holds.
- [ ] **Step 6:** commit: `feat(path): ritual path/way authority cutover`

**Exit criterion (scoped, per review):** *all Initiation Ritual path/way choice writes* flow through `CultivationPathSystem`. NOT "all path state" — `kiemTuModeSwitch` node machinery still exists until M6. **Verification: full + P14 + deep QA.**

---

## Mission 3 — `requiredWay` in NodeSystem

**Files:**
- Modify: `game/src/core/progression/ProgressionNode.ts` — add `requiredWay?: PathWayId` to `ProgressionNode`
- Modify: `game/src/core/progression/NodeSystem.ts` — `nodePathApplies` (and every aggregator) also checks `requiredWay` against `player.cultivationWay`
- Test: `game/src/core/progression/NodeSystem.test.ts`

Only `requiredWay`. No `requiresSpecialization`/`setsSpecialization` — Git shows `elementTag`/`routeTag`/`excludesNode`/`selectsSpecialization` already cover in-way branching (spec §15).

- [ ] **Step 1:** failing test — node with `requiredWay: 'ung_the'` unpurchasable/unaggregated for a `hien`-way player.
- [ ] **Step 2:** implement; all existing nodes keep working (undefined = way-agnostic).
- [ ] **Step 3:** `npx vitest run src/core/progression` + type-check.
- [ ] **Step 4:** commit: `feat(path): requiredWay node gating`

**Exit criteria:** way gating works beside existing tags; NodeSystem remains sole node authority; no content migrated yet.

---

## Mission 4 — Normalize Pháp Tu (first proof — cleanest representation change)

`phap_tu_an` is already a ritual path → becoming way `ngo_dao` is representation-only.

**Files:**
- Create: `game/src/core/phap-tu/PhapTuPath.ts` — module: `ngu_hanh` (kit `dai_ngu_hanh_chan_quyet`, stat facet = attunement emitters + `'phap_tu'` domain + deltaDeriver) + `ngo_dao` (kit `ngo_dao_chan_quyet` + required-skill triple, offerGate linh_bao Lv3, same `'phap_tu'` domain facet)
- Modify: `game/src/data/progression/PhapTuNodes.ts`, `PhapTuAnNodes.ts`, `PhapTuNodes.builders.ts` — `requiredCultivationPath: 'phap_tu_an'` → `requiredCultivationPath: 'phap_tu'` + `requiredWay: 'ngo_dao'`; `elementTag`/`routeTag` unchanged
- Modify: `getPhapTuAttunementStatModifiers` + `registerDomainDeltaDeriver('phap_tu', …)` → move behind the way stat facet; `player.cultivationPath === 'phap_tu_an'` checks → way-aware equivalents (e.g. domain still `'phap_tu'`; membership via way)
- Modify: `QuanKhiPanel.vue` `kit.id === 'phap_tu_an'` card → way-aware hidden card
- `player.phapTu` {element, route} — **unchanged** (INV-13 atomic commit stays)
- Test: `PhapTuNodes.reimagined.test.ts`, `PhapTuRoutes.test.ts`, `GameManager.phapTuAnPath.test.ts`, `PhapTuState.test.ts`, `StatCalculator` phap-domain tests

- [ ] **Step 1:** baseline snapshot — element+route atomic commit, route-tag aggregation, attunement MP via BOTH channels, ngo_dao skill triple atomicity.
- [ ] **Step 2:** module + stat facet port; node tag migration; consumer reads → `cultivationWay`/authority.
- [ ] **Step 3:** `npx vitest run src/core/phap-tu src/data/progression/PhapTu src/core/game/GameManager.phapTu src/core/stats` + type-check.
- [ ] **Step 4 (P14):** ritual → ngo_dao offer at linh_bao Lv3 → element pick → reactions/cast behave.
- [ ] **Step 5:** commit: `refactor(path): phap tu module — ngu_hanh + ngo_dao ways`

**Exit criteria:** phap consumers read way/authority, not `phap_tu_an` path id; both stat channels identical; `phapTu` slice untouched.

---

## Mission 5 — Normalize Thể Tu (`the_tu_an` → way `ung_the`)

**Files:**
- Create: `game/src/core/the-tu/TheTuPath.ts` — ways `hien` (kit `kim_cang_bat_hoai_the`, endurance emitter + `'the_t'` domain) + `ung_the` (kit `ung_the_than_quyet`, offerGate huy_quyen Lv3, `usesTheResource`, reactive emitters + `'the_tu_an'` domain)
- Modify: `game/src/data/progression/TheTuNodes.ts`, `TheTuAnNodes.ts` — `requiredCultivationPath: 'the_tu_an'` → `requiredWay: 'ung_the'` + path `the_tu`; `cuong_chien`/`tran_the` mutex nodes **unchanged** (NodeSystem owns the choice — no specialization axis is added)
- Modify: `getTheTuAnReactiveStatModifiers`/`getTheTuEnduranceStatModifiers` + delta derivers → way facets; `theBarBridge.ts` + battle-build kit resolution reads way via authority
- Test: `TheTuNodes.test.ts`, `TheTuAnNodes.test.ts`, `GameManager.theTuKit.test.ts`, `theTuE2E`/`theTuAnE2E`, `StatCalculator.theTu.test.ts`, `TurnBattleSystem.theEconomy.test.ts`

- [ ] **Step 1:** baseline — root-mutex kit resolution at battle build; endurance + reactive channels; Thế economy.
- [ ] **Step 2:** module + facets + tags + way-aware consumers.
- [ ] **Step 3:** `npx vitest run src/core/the-tu src/data/progression/TheTu src/core/game/GameManager.theTu src/core/stats` + type-check.
- [ ] **Step 4 (P14):** ritual → ung_the offer at huy_quyen Lv3 → Thế bar + counter/protect/follow-up in combat.
- [ ] **Step 5:** commit: `refactor(path): the tu module — hien + ung_the ways`

**Exit criteria:** the_tu consumers way-aware; root mutex still pure NodeSystem; kit resolution identical.

---

## Mission 6 — Normalize Kiếm Tu (last — hardest; includes the approved gameplay change)

**Files:**
- Create: `game/src/core/kiem-tu/KiemTuPath.ts` — ways `hien` (kit `ngu_kiem`, slice factory `freshKiemTuState`) + `ngu` (kit `van_kiem_quyet`, no skillIds — provider-injected actions, offerGate `{requiresSkillLevel, 'tram', 3}`, lifecycle `onRealmAdvance` → NguKiemDao merge)
- Modify: `game/src/data/progression/KiemTuNodes.ts` — delete `KIEM_TU_AN_NODE`; every `{kind:'node', nodeId:'kiem_tu_an'}` prereq in the ngu subtree → `requiredWay: 'ngu'` (+ path `kiem_tu`); `kiemTuMode: 'ngu'` tags → `requiredWay: 'ngu'`
- Modify: `game/src/core/kiem-tu/KiemTuState.ts` — remove `mode` field; slice stays `{ preset, kiemY, kiemDaoCount, kiemDaoBase }` (one canonical state, per-field owners unchanged)
- Modify: `game/src/core/kiem-tu/NguKiemDao.ts` — `state.mode !== 'ngu'` guards → `player.cultivationWay !== 'ngu'` (or authority query)
- Modify: `game/src/core/progression/ProgressionNode.ts`/`NodeSystem.ts`/`GameManagerProgressionOps.ts` — delete `kiemTuMode` + `kiemTuModeSwitch` handling (incl. the `van_kiem_quyet` learn+equip swap + rollback — the way kit equips it at ritual instead)
- Modify: `QuanKhiPanel.vue` `player.kiemTu?.mode` display → `cultivationWay`; `kiemBarBridge.ts`, `NodeBranchViews.ts` consumers
- Test: `core/kiem-tu/invariants.test.ts`, `NguKiemDao.test.ts`, `KiemPhoProvider.test.ts`, `GameManager.kiemTuState.test.ts`, `kiemTuTree`/`kiemTuAn` tests rewritten to way-entry, `KiemTuNodes.test.ts`

- [ ] **Step 1:** baseline — hien preset flow; ngu economy (kiemY gain, kiemDaoCount cap, kiemDaoBase merge).
- [ ] **Step 2:** module + way split; `mode` removal ripples through all readers (M0 list).
- [ ] **Step 3:** delete transition machinery; ngu offer gate lands in ritual.
- [ ] **Step 4:** `npx vitest run src/core/kiem-tu src/data/progression/KiemTu src/core/game/GameManager.kiemTu` + type-check.
- [ ] **Step 5 (P14):** ritual → ngu offer at tram gate → ngu tree → kiemY→kiemDao economy → breakthrough merge; hien preset editor unchanged.
- [ ] **Step 6:** commit: `refactor(path): kiem tu module — hien + ngu ways`

**Exit criteria:** Kiếm Tu fully on framework; `mode`/`kiemTuModeSwitch` gone; regression identical except approved ngu-entry change. **Deep QA.**

---

## Mission 7 — Remove the 5-ID model + obsolete adapters

**Files:**
- Modify: `game/src/core/player/CultivationPathKit.ts` — `CultivationPathId` shrinks to `'kiem_tu' | 'phap_tu' | 'the_tu'`; legacy `_an`→(path,way) mapping deleted; `PHAP_TU_AN_*` constants move into `ngo_dao` way definition
- Modify: `CultivationPathSystem.ts` — `applyPathChoice` writes base path id only; delete legacy-effective-id adapter
- Modify: `Player.ts` — no `phapTu`/`kiemTu` deletions needed (both stay by design); remove any remaining dual-write reads
- Modify: `saveTypes.ts`/`saveShapeValidation`/`saveVersion.ts` (v66) — `_an` path ids now invalid
- Modify: any remaining `cultivationPath === '*_an'` reader from the M0 list
- Test: all ritual/path test files; save validation + round-trip

- [ ] **Step 1:** M0 leak list drives the search — every write resolves to authority; every read to way/query.
- [ ] **Step 2:** shrink union; fix all type errors; validation rejects `_an`.
- [ ] **Step 3:** `npx vitest run` (full) + type-check + build.
- [ ] **Step 4:** commit: `refactor(path): remove legacy 5-id model + adapters`

**Exit criteria:** single path/way truth; no dead adapters. **Verification: full + deep QA.**

---

## Mission 8 — Contribution ownership cleanup

- [ ] Delete old free-function entry points in `CultivationPathSystem.ts` superseded by way facets (`getCultivationPathStatModifiers`, standalone emitters if fully ported); verify every stat contribution flows through module facets — both assembly and delta channels.
- [ ] Verify `grantCultivationPathRealmReward` reads the way-scoped `realmRewards`.
- [ ] Any remaining helper that reaches into path internals gets an owner or gets deleted.
- [ ] `npx vitest run src/core` + type-check. Commit: `refactor(path): contribution ownership cleanup`

---

## Mission 9 — Core leakage cleanup

- [ ] Generic dirs (`core/stats`, `core/skill`, `core/battle`, `core/combat`, `core/game`, `stores`, `services/save`): find path/way **conditional branching** (not just literals — `pathId ===`, `wayId ===`, `switch(path`, domain maps keyed on concrete ids). Concrete modules/content legitimately know their own ids — zero-literal purity is NOT the goal; zero generic branching is.
- [ ] Route each hit: legit (registration/tests/content/path code) vs violation → fix via contracts.
- [ ] `npx vitest run` + type-check. Commit: `refactor(path): core path-leak cleanup`

---

## Mission 10 — Architecture guards + final E2E

**Files:**
- Create: `game/tests/architecture/cultivationPathIsolation.test.ts` — import-boundary + generic-branching checks (pattern: `tests/architecture/i18nKeyParity.test.ts`)
- Create: `game/src/core/player/CultivationPathContract.test.ts` — `runCultivationPathContractTests(module)` over all 3 modules: unique ids, well-formed ways (kit refs, `nodeIds` exist + carry `requiredWay`, offerGate shape), `createInitialState` shape
- Optional: test-only fake path proves infra independence
- Modify: `game/docs/roadmap.md` (§B6 status), `AGENTS.md` (add the §32 rule — docs authorized by mission)

- [ ] Guards fail-first → implement → `npx vitest run tests/architecture src/core/player`
- [ ] `npm run type-check` + `npm run build` + `npx vitest run` (full)
- [ ] Playwright matrix — all six ways (run inside the implementation
      worktree per current P14 — the isolated-worktree exception is
      retired; an environment failure is an explicit blocker, not a deferral):
  - kiem_tu/hien: ritual → preset editor → orb combos in combat
  - kiem_tu/ngu: tram gate → ritual entry → kiemY→kiemDao economy → breakthrough merge
  - phap_tu/ngu_hanh: element+route atomic pick → element tree → reactions/cast
  - phap_tu/ngo_dao: linh_bao gate → skill triple → passive
  - the_tu/hien: root mutex pick → kit resolution → endurance
  - the_tu/ung_the: huy_quyen gate → Thế bar → counter/protect/follow-up
- [ ] Repo audit: remaining path/way literals each justified; final per-mission report.
- [ ] Commit: `test(path): cultivation path guards + docs`

**Exit criteria:** spec §30 acceptance criteria all green.

---

## Commit Strategy (all commits need explicit authorization — P7)

```
refactor(path): evolve kit catalog into path/way modules   (M1)
feat(path): ritual path/way authority cutover              (M2, save v65)
feat(path): requiredWay node gating                        (M3)
refactor(path): phap tu module — ngu_hanh + ngo_dao ways   (M4)
refactor(path): the tu module — hien + ung_the ways        (M5)
refactor(path): kiem tu module — hien + ngu ways           (M6)
refactor(path): remove legacy 5-id model + adapters        (M7, save v66)
refactor(path): contribution ownership cleanup             (M8)
refactor(path): core path-leak cleanup                     (M9)
test(path): cultivation path guards + docs                 (M10)
```

## Stop Conditions

Stop and reassess if implementation requires: rewriting NodeSystem/StatSystem/SkillSystem/combat resolution; a second modifier engine or event bus; `CultivationPathSystem` owning node levels or executing combat; a field/interface/registry without a same-mission consumer; in-way branch unification beyond current owners; behavior changes beyond the approved ngu-entry change. Document separately.

---

## M0 Addendum (2026-09-16) — corrections from verified inventory

Inventory: `game/docs/architecture/2026-09-16-path-inventory.md`. Corrections to mission text:

- **`getCultivationPathKit`/`getCultivationPathRealmRewards`/`hiddenUntilEligible` do not exist.** All kit access is direct `CULTIVATION_PATH_KITS[id]` indexing (unguarded at CultivationPathSystem:203,216; kiemBarBridge:98; ArtifactPanel:47). M1 provides safe way-aware accessors; hidden offers = omission from offer list.
- **Battle seam is participant artifacts**, not a function seam: `dynamicBasic` provider, basic/special/ultimate defs, `reactivePayloads`, `activeDomains`, `maxThe` — installed by GameManager/TurnBattleOps branches. No `PathCombatContribution` interface; orchestration resolves (path, way) → artifacts as composition.
- **`CULTIVATION_PATH_STAT_DOMAINS` must become way-aware** (`the_tu_an`→['the_tu_an'] keyed by way, else reactive chances die at union shrink). Stale `hoa_tu` row removed at M7.
- **`phap_tu_an` has zero node content** (`PHAP_TU_AN_NODES = []`) — M4's node migration is trivial; its real work is the `=== 'phap_tu'` → way-aware gate audit (see R6 in ledger: selectPhapTuElement, switchRoute, PhapTuRoutes, theBarBridge, applyPhapTuTheGains, getPhapTuElement, PillSystem, CombatBuildHud, SkillPathPanel, NodeTreePanel, authoredBasicSkillId, An-kit resolvers, emblem HUD).
- **`requiredCultivationPath` only gates the two Thể Tu trees today** — small surface for M3/M5.
- **Save: add enum validation for `cultivationPath` + new `cultivationWay` in v65**; declare field in `createDefaultPlayer` literal (Pinia toRefs).
- **`kiem_tu_an` node id ≠ path id** — string migrations must not rename it (deleted wholesale in M6 anyway).
- **ngu gate**: `requiresSkillLevel {tram, 3}` exactly ports the node's `skillCastCount level:3` (both read `skillLevels`). NOTE `isPhapTuAnEligible` reads `skillCastCounts` vs CAST_LEVELING_THRESHOLDS — different mirror; port as `requiresSkillCastLevel` offerGate variant or keep as a way-def gate function (implementer decision, recorded in report).
