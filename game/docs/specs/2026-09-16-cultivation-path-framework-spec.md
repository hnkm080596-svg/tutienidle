# Cultivation Path Framework — Architecture Specification (v3.1)

Project: `tutienidle`
Status: Proposed (v3.1 — Path→Way model, corrected against verified Git state; supersedes v2/v3, see `2026-09-16-cultivation-path-framework-review.md`)
Scope: Architecture / Domain / Path Progression / System Integration
Paths: Kiếm Tu (`kiem_tu`) / Pháp Tu (`phap_tu`) / Thể Tu (`the_tu`)

## 1. Purpose

`tutienidle` has three cultivation paths. Today their structure is inconsistent: hidden variants are separate path IDs for Pháp/Thể (`phap_tu_an`, `the_tu_an`) but an in-path mode for Kiếm (`kiemTu.mode: 'ngu'`); path-domain logic is scattered across free functions, GameManager ops, and a kit record with no governing contract.

**Approved model:**

```
Path (3: kiem_tu, phap_tu, the_tu)
└── Way (per-path declared; currently 2 each — Hiển / Ẩn)
    └── Way-owned node subtree (contains specialization nodes for skills)
```

- A **Way** is a major branch inside a path: own kit (technique, skills, stats, realm rewards), own node subtree, own mechanic slice, optional ritual offer gate.
- Ways are declared per path — the framework does not hardcode "2" or what a way *means*; `ways: readonly PathWayDefinition[]` may grow later.
- All ways are chosen **at the Initiation Ritual** — path + way commit atomically. No mid-progression path/way switch.
- Each way's node subtree holds its **specialization nodes** — ordinary `ProgressionNode`s whose `NodeEffect` grants skill/stat/mechanic content.

**In-way branches are NOT a framework concept** (see §15). Element/route, root mutex, and skill specialization keep their current owners.

**Approved gameplay change (the only one):** Kiếm Tu Ẩn (Ngự Kiếm Đạo) moves from mid-progression node flip (`kiem_tu_an` node) to a ritual-time way offer — gate `tram` Lv3 (exact port of the node's `skillCastCount level:3` gate), entry free (the node's 3-insight cost disappears). The hien→ngu mid-game conversion is permanently removed: a player without `tram` Lv3 at ritual can never enter ngu. Everything else preserves current behavior.

## 2. Verified Current-State Baseline

| Concern | Current implementation | Owner |
|---|---|---|
| Path IDs | union `'phap_tu' \| 'phap_tu_an' \| 'kiem_tu' \| 'the_tu' \| 'the_tu_an'` | `core/player/CultivationPathKit.ts:20` |
| Path content | `CultivationPathKit` (techniqueId, statModifiers, realmRewards, skillIds, offerGate, usesTheResource) + `CULTIVATION_PATH_KITS` catalog — **evolves into the module catalog, not replaced by a parallel registry** | `core/player/CultivationPathKit.ts` |
| Active path | `player.cultivationPath` — permanent, persisted | `core/player/Player.ts:108` |
| Offer evaluation | `getOfferableCultivationPaths`, `isCultivationPathOffered`, `isPhapTuAnEligible` — ritual-time, never stored | `core/player/CultivationPathSystem.ts` |
| Path choice | `chooseCultivationPath` — fused with mortal→qi_refining ritual (atomic: technique, skills, grade lock, realm advance, unequip contract QA-2026-09-02-001) | `core/game/GameManagerRealmAdvanceOps.ts:172` |
| Per-path state | `player.phapTu` {element, route} (PhapTuState — persistent path-choice authority); `player.kiemTu` {mode, preset, kiemY, kiemDaoCount, kiemDaoBase} (ONE canonical state — `NguKiemDao` owns ops on the ngu fields); Thể Tu: no persisted slice | `core/player/Player.ts`, `core/phap-tu/`, `core/kiem-tu/` |
| In-way branches | Pháp: `phapTu.element`/`route` + `elementTag`/`routeTag` node gating; Thể: `cuong_chien`/`tran_the` mutex via `excludesNode` root nodes; skill variants: `NodeEffect.selectsSpecialization` + `SkillSystem` | existing owners — see §15 |
| Node state | `player.nodeLevels`; `NodeSystem` owns purchase/prereq/upgrade; `requiredCultivationPath` + tags gate membership | `core/progression/` |
| Node effects | `NodeEffect` typed union (statModifiers, unlocksSkillIds, selectsSpecialization, turnSkillResourceModifiers, kiemYGrant, theTuKitModifiers, theTuAnMechanicModifiers, …) | `core/progression/ProgressionNode.ts` |
| Stats | kit `statModifiers` + domain-gated assembly emitters + `registerDomainDeltaDeriver` mid-battle channel | `core/player/CultivationPathSystem.ts`, `core/stats/` |
| Mechanics | `core/kiem-tu/` (KiemPho, NguKiemDao), `core/phap-tu/` (Routes), `core/the-tu/` (TheEconomy, TheTuAnMechanicModifiers, …) | `core/` |
| Node content | `data/progression/{KiemTu,PhapTu,PhapTuAn,TheTu,TheTuAn}Nodes.ts` (KiemTuNodes is live here; `core/cultivation/` holds CultivationSystem/Pose only) | `data/progression/` |
| UI entry | `QuanKhiPanel.vue` — already reads `getOfferableCultivationPaths` + calls `realmAdvanceOps.chooseCultivationPath` via GameManager API | `components/panels/` |
| Save policy | strict version rejection — every version rejects the previous (v61→v64 all "dev phase, không migration"); NO compatibility bridges | `services/save/saveVersion.ts` |
| Events | `core/events/EventBus.ts` | exists |

## 3. Core Architectural Rule

`CultivationPathSystem` is the sole authority for cultivation-path lifecycle state:

- active path (`player.cultivationPath`) and active way (`player.cultivationWay`) writes
- offer evaluation (which path+way pairs the ritual may offer)
- choice commit — invoked inside the ritual transaction (§13)
- path domain events

Concrete paths are registered modules:

```
CultivationPathSystem
        │
        ├── KiemTuPath    — ways: hien, ngu (gate: tram)
        ├── PhapTuPath    — ways: ngu_hanh, ngo_dao (gate: linh_bao Lv3)
        └── TheTuPath     — ways: hien, ung_the (gate: huy_quyen Lv3)
```

Core systems operate through shared contracts and MUST NOT branch on concrete path or way identity.

`CultivationPathSystem` does NOT own: node investment (NodeSystem), in-way branch state (§15), stat calculation (StatSystem), skill execution (SkillSystem), combat resolution, ritual orchestration (RealmAdvanceOps), resource ticking, mechanic runtime rules (dedicated systems).

## 4. Fundamental Invariant

No concrete path/way identity branches inside generic infrastructure (Combat, Damage, Vitals, Stats, Skills, Cooldown, Casting, Save, generic UI). Concrete identity is allowed inside: path/way modules, definitions, path-specific mechanics, path-specific UI (e.g. the `phap_tu_an` kit card in `QuanKhiPanel` is legitimate path-specific presentation), registration, tests.

Domain gating (`StatModifier.domain`, `registerDomainDeltaDeriver`) is NOT a forbidden branch — domains are module-declared namespaces consumed generically.

## 5. Architecture Goal

- New path = new module + ways + nodes + registration. No core edits.
- New way in an existing path = one `PathWayModule` added to that path. No new framework concepts.

## 6. Terminology

### 6.1 Cultivation Path

`CultivationPathId = 'kiem_tu' | 'phap_tu' | 'the_tu'` — target union is **3**. `_an` IDs retire as path IDs and become way IDs. During transition the existing 5-id union stays until nothing writes `_an` values (removed in the cleanup mission).

### 6.2 Way (`PathWayId`)

A path-owned branch — the framework's ONLY level of branch structure. Path-scoped string ID. Current six:

| Path | Way | Meaning | Entry |
|---|---|---|---|
| `kiem_tu` | `hien` | Kiếm Phổ preset-combo | always offered |
| `kiem_tu` | `ngu` | Ngự Kiếm Đạo (Ẩn) | ritual offerGate: `tram` Lv3 (was: mid-progression node) |
| `phap_tu` | `ngu_hanh` | Đại Ngũ Hành | always offered |
| `phap_tu` | `ngo_dao` | Ẩn — Ngộ Đạo | ritual offerGate: `linh_bao` Lv3 |
| `the_tu` | `hien` | Cuồng Chiến / Trấn Thể roots | always offered |
| `the_tu` | `ung_the` | Ẩn — Ứng Thế | ritual offerGate: `huy_quyen` Lv3 |

Ways are mutually exclusive and permanent — one way per path, chosen once at the ritual.

**`ngu` ritual starter kit — RESOLVED** (from current Git): `techniqueId: 'van_kiem_quyet'` — the existing ngu signature the mode-flip already learns+equips (`GameManagerProgressionOps.ts:175-248`), so ritual entry equips it directly instead of swapping mid-game; `skillIds: []` — ngu's action set is fully provider-injected at battle build (`ngu_kiem_thuat` via `buildNguKiemDaoProvider`; `tu_kiem_y`/`kiem_dao_cascade` as `emblemOnly` slot markers), same shape as `hien` whose kit carries no skillIds; offerGate `{ requiresSkillLevel, skillId: 'tram', level: 3 }`; slice = `freshKiemTuState()` minus `mode` (`kiemY 0`, `kiemDaoCount 1`, `kiemDaoBase 1`, `preset` untouched). `NguKiemDao.assertRealmIndex` ("mortal cannot enter ngu") is satisfied: the ritual commits realmIndex 1 before slice creation. Every `kiem_tu_an`-node prereq in the ngu subtree is replaced by `requiredWay: 'ngu'`; the node itself is deleted.

### 6.3 Path Node / Specialization Node

A `ProgressionNode` belonging to a way (`requiredWay` tag, §14). "Specialization nodes" = ordinary nodes with skill-related `NodeEffect`s (`unlocksSkillIds`, `selectsSpecialization`, resource modifiers). No new node type. NodeSystem keeps sole node-investment authority (`player.nodeLevels`).

### 6.4 Way Mechanic

Way-scoped runtime rules with own state/lifecycle (Kiếm Phổ combos, Ngự Kiếm Đạo economy, element reactions, Thế economy, counters). Live in `core/<path-dir>/`; framework decides availability, never execution.

## 7. Responsibility Model

`CultivationPathSystem` owns exactly:

- `cultivationPath` / `cultivationWay` writes
- offer evaluation (`listOfferableWays`)
- choice commit inside the ritual transaction
- way-slice lifecycle (created at commit, where a slice exists)
- path domain events

Explicit non-ownership: nodeLevels/prereqs/costs (NodeSystem), in-way branch choices (§15), damage/heal/vitals/DoT/crit, skill execute/cooldown/cast, stat calc, resource ticking, ritual transaction boundary, presentation.

## 8. Three-Layer Model

### 8.1 Definition

```ts
interface CultivationPathDefinition {
  id: CultivationPathId
  name: string
  description?: string
  icon?: AssetId
  ways: readonly PathWayDefinition[]     // currently 2 per path; not hardcoded
}

// Evolved from CultivationPathKit — same fields, way-scoped:
interface PathWayDefinition {
  id: PathWayId
  name: string
  description?: string
  offerGate?: OfferGate                  // ritual-time eligibility; absent = always offered

  techniqueId: string
  skillIds?: readonly string[]
  statModifiers?: readonly StatModifier[]
  realmRewards?: Readonly<Record<string, CultivationPathRealmReward>>
  usesTheResource?: boolean

  nodeIds: readonly string[]             // the way's subtree (forward ref)
}
```

Definitions are data. No runtime mutation, no arbitrary callbacks.

### 8.2 State (persisted)

```ts
// PlayerData:
cultivationPath?: CultivationPathId   // framework-owned writes
cultivationWay?: PathWayId            // NEW — framework-owned writes

// way-owned mechanic slices — EXISTING fields stay; no new slice types:
kiemTu?: KiemTuState                  // { mode, preset, kiemY, kiemDaoCount, kiemDaoBase }
                                      // → `mode` field retires once `cultivationWay` exists;
                                      //    the slice itself stays ONE canonical object
                                      //    (NguKiemDao owns ngu fields; KiemPho owns preset)
phapTu: PhapTuState                   // { element, route } — stays; way-internal branch state
// the_tu / the_tu_an-ways: no persisted slice today — unchanged
```

Design notes (from Git verification):

- `player.kiemTu` is NOT split into hien/ngu slices — it is deliberately one canonical state with per-field owners (`NguKiemDao` owns `kiemY`/`kiemDaoCount`/`kiemDaoBase`). Splitting adds save shape and consumer churn for no architectural gain. Only `mode` retires — way identity replaces it.
- `player.phapTu` stays — it is already a typed, persistent branch-state authority. No generic `Record<string,string>` replaces it.

### 8.3 Runtime Contribution

Derived from Definition + State + Context; rebuilt, never persisted.

## 9. Module Contract

```ts
interface CultivationPathModule {
  readonly definition: CultivationPathDefinition
  readonly ways: Readonly<Record<PathWayId, PathWayModule>>
}

interface PathWayModule {
  readonly definition: PathWayDefinition
  createInitialState?(): unknown                    // way slice factory (kiem_tu → KiemTuState)
  readonly stats?: PathStatContribution             // §16
  readonly lifecycle?: PathLifecycleHooks           // narrow, evidence-driven
  // combat: no speculative interface — the contract is exactly the
  // battle-build seam found in inventory (§18); today it is
  // provider/kit-resolver references, not a generic contribution bag
}

interface PathLifecycleHooks {
  onChosen?(ctx: PathChosenContext): void              // inside ritual txn (slice init, loadout strip)
  onRealmAdvance?(ctx: PathRealmAdvanceContext): void  // ngu kiemDaoBase merge compounding
}
```

## 10. Module Catalog (registry)

`CULTIVATION_PATH_KITS` **evolves in place** into the module catalog — do NOT create a parallel `CultivationPathRegistry` beside it:

```
CULTIVATION_PATH_KITS (Record<PathId, Kit>)
        ↓ evolve
CULTIVATION_PATH_MODULES (Record<PathId, CultivationPathModule>)
```

Responsibilities: unique path ids, unique way ids within a path, required kit fields, referenced techniques/skills/nodes exist (the pre-commit checks in `chooseCultivationPath` move here where possible). Lookup composes `MODULES[pathId].ways[wayId]`.

Catalog owns no player state — content only.

## 11. CultivationPathSystem

Existing `core/player/CultivationPathSystem.ts` is repurposed into the authority (free functions → methods/delegates). Explicit deps: module catalog, stat-domain channels, event publisher. No hidden store access.

## 12. Entry Model — everything at the ritual

No unlock flag, no post-ritual path/way transition.

```ts
listOfferableWays(player): readonly PathWayOffer[]
// PathWayOffer = { pathId, wayId, eligible, reason? }
// gate evaluation is live at ritual time, never stored (isPhapTuAnEligible pattern preserved)

applyPathChoice(player, pathId, wayId): PathChoiceResult
// invoked by RealmAdvanceOps inside the ritual transaction
```

`applyPathChoice` validates: path exists, way belongs to path, `offerGate` passes at this moment, ritual preconditions hold. Failure → deterministic rejection, zero mutation.

`transitionPath`, `kiemTuModeSwitch` — deleted concepts. Ngu entry is a ritual offer.

## 13. Ritual Boundary (critical)

`chooseCultivationPath(pathId, wayId, player)` remains the RealmAdvanceOps-owned atomic transaction: validate → realm advance + grade lock + technique learn/equip + skill grants + unequip contract → **path/way commit via `CultivationPathSystem.applyPathChoice`**.

The path authority owns path-state writes inside the transaction; it does not orchestrate the ritual; the ritual never writes `cultivationPath`/`cultivationWay` directly.

UI sees offerable (path, way) pairs; presentation shape (flat list vs two-step) is a UI detail.

## 14. Node Integration

NodeSystem keeps `player.nodeLevels`, purchase, prereqs, upgrade costs. Membership tags:

- `requiredCultivationPath` — kept (3 ids at end-state)
- **`requiredWay?: PathWayId`** — NEW: way membership. `ngu` nodes get `requiredWay: 'ngu'`; `the_tu_an`/`phap_tu_an` nodes get `requiredPath` + `requiredWay` of their way.
- `elementTag` / `routeTag` — **unchanged.** They are Pháp-way-internal branch gating on `phapTu.element`/`route` — correct ownership already.
- `kiemTuMode` — retired (superseded by `requiredWay`); `kiemTuModeSwitch` — deleted (no transitions).

**Ruling on per-path `NodeEffect` fields** (`kiemYGrant`, `kiemDaoGrant`, `cascadeUnlock`, `kiemTuComboModifier`, `theTuKitModifiers`, `theTuAnMechanicModifiers`, `turnSkillResourceModifiers`, `theCapPerLevel`): ACCEPTED — declarative typed data, one path-owned consumer each. No new generic grant fields are added — Git shows no need.

## 15. In-Way Branches — explicitly NOT framework-owned

Do not unify these into a shared "specialization" record — verified reasons:

- **Pháp element/route** — `phapTu.element`/`route` is already a typed persistent authority committed atomically by `selectPhapTuElement()` (INV-13); `elementTag`/`routeTag` are its node-gating mechanism. A generic `Record<string,string>` loses type safety and solves nothing.
- **Thể root choice** — `cuong_chien`/`tran_the` are mutex `ProgressionNode`s via `excludesNode`; `NodeSystem` is already the authority. A parallel "root specialization" state would be a second representation of one choice.
- **Skill specialization** — `NodeEffect.selectsSpecialization` + `SkillSystem.selectSpecialization` already own it.

Framework rule: a way's internal branching lives in that way's own state/nodes. If a *second* way later demonstrates the same branch semantics, then — and only then — extract a shared mechanism (A1/A9).

## 16. Stat Integration — two channels preserved

```ts
interface PathStatContribution {
  collectModifiers(ctx: PathStatContext): readonly StatModifier[]   // kit lines + assembly emitters
  deltaDeriver?(delta: AttributeDelta): readonly StatModifier[]      // mid-battle domain deltas (INV-10)
  domains: readonly string[]                                       // 'phap_tu', 'the_tu', 'the_tu_an', …
}
```

- Stat domains are way-owned namespaces, decoupled from path ids (`'the_tu_an'` domain stays valid as the `ung_the` way's domain; `phap_tu` domain is shared by both phap ways).
- StatSystem keeps aggregation + domain gate; no path/way branches inside it.

## 17. Skill Integration

SkillSystem owns learn/equip/execute/cooldown/cast. Ways contribute availability via existing channels only: kit `skillIds`/`innateSkillId` grants at ritual commit, `unlocksSkillIds`/`selectsSpecialization`/resource modifiers on nodes. Starter skills ride the ritual grant or first-node grant (Pháp's no-auto-starter preserved). No way-specific branches inside SkillSystem.

## 18. Combat Integration

Battle-build composition is the boundary. The inventory mission must find the **real seam** — today it is provider/kit-resolver references (`buildTheTuAnKit`, KiemPho/NguKiemDao providers, root-mutex kit resolution) plus `NodeEffect`-driven mechanic modifiers baked into participant-local clones and domain-gated stats. The way contract names exactly that seam — no generic `CombatContribution` interface containing everything.

P17 applies before touching `core/battle/turn/**`, battle-tick integration, or `CombatScene` — check roadmap R-phases + `docs/qa/`. Path/way code never originates gameplay events from presentation.

## 19. Resource Integration

Way resources (Kiếm Ý/Đạo, Thế pool, mana-shield semantics) stay mechanic-owned: `player.kiemTu` persists ngu resource facts under `NguKiemDao` authority; battle Thế lives on `CombatEntity`; `usesTheResource` stays a declarative way flag for the HUD. The framework never becomes a resource engine.

## 20. Domain Events

Existing `EventBus`. Only events with real consumers — candidate:

- `PATH_WAY_CHOSEN` — ritual commit (UI refresh, loadout rebuild)

Validate during implementation; do not produce a speculative vocabulary. No Vue objects; stable identifiers.

## 21. UI Boundary

UI reads state, displays offers/ways/nodes/eligibility, issues commands via GameManager facades. UI MUST NOT write `cultivationPath`/`cultivationWay`/node levels/slices, and MUST NOT re-derive gate rules (consume `listOfferableWays` — extending the existing QuanKhiPanel/`isCultivationPathOffered` sharing to pairs).

A dedicated `CultivationPathViewModel` is **conditional** — only add it if the UI boundary mission finds real consumers the current GameManager-facade reads don't already serve (QuanKhiPanel already goes through GameManager APIs today). Path-specific panels (Kiếm Phổ orb editor, Thế bar) remain per-way UI under a generic shell; no Vue refs in domain definitions.

## 22. Composition Root & Layout

One registration point at GameManager/bootstrap assembly:

```ts
CULTIVATION_PATH_MODULES = {
  kiem_tu: KiemTuPath,    // ways: hien, ngu
  phap_tu: PhapTuPath,    // ways: ngu_hanh, ngo_dao
  the_tu:  TheTuPath,     // ways: hien, ung_the
}
```

Files (existing conventions):

- `core/player/CultivationPathSystem.ts` — repurposed authority
- `core/player/CultivationPathKit.ts` — evolves into module catalog + types
- `core/kiem-tu/KiemTuPath.ts`, `core/phap-tu/PhapTuPath.ts`, `core/the-tu/TheTuPath.ts` — module + way modules beside their mechanics
- node content stays consolidated under `data/progression/`

## 23. Persistence

Per project policy: schema change + authority change + consumer change + `saveVersion` bump land **together in each vertical cutover** — no standalone schema mission, no compatibility bridge, old saves rejected.

End-state shape:

- `cultivationPath` — union 3 ids (saves with `_an` ids rejected — accepted)
- `cultivationWay` — new field
- `kiemTu` — `mode` removed; single slice kept
- `phapTu` — unchanged ({element, route})
- `saveShapeValidation`/`SaveRoundTrip` updated per landing; repeated full-restore repeat-safe (QA-2026-09-08-001)
- Derived values never persisted

## 24. Isolation, Dependencies, IDs

- Path/way modules never import each other's code; shared needs extract to shared infra.
- Direction: shared primitives ← framework ← path/way modules; consumers depend on contracts only.
- `CultivationPathId` stays a closed union (3) — project convention + save validation. `PathWayId` is a path-scoped content string (like node ids).

## 25. Avoid Premature Generalization

Every contract maps to a §2-verified consumer. Explicitly rejected by evidence:

- `pathSpecializations: Record<string,string>` — loses type safety vs `PhapTuState`; duplicates NodeSystem's mutex ownership for Thể.
- `kiemTuNgu` slice — splits one canonical state for no gain.
- Generic `PathCombatContribution` — the real seam is provider/kit-resolver references; name exactly that.
- `requiresSpecialization`/`setsSpecialization` node generics — `elementTag`/`routeTag`/`excludesNode` already cover the real cases.
- Parallel `CultivationPathRegistry` — evolve `CULTIVATION_PATH_KITS` instead.

## 26. Implementation Phases

Order driven by Git evidence — cleanest representation change first, hardest case last:

- **P0 Inventory** — confirm §2; lock baseline SHA; enumerate all `cultivationPath`/`kiemTu`/`phapTu`/mode/route/element readers+writers; find the real battle-build seam (§18); authority matrix + leak list.
- **P1 Contracts** — evolve `CultivationPathKit`/`CULTIVATION_PATH_KITS` into module catalog types; no parallel id/registry types.
- **P2 Ritual vertical slice** — `cultivationWay` field + authority + `chooseCultivationPath(pathId, wayId)` + QuanKhiPanel pairs + saveVersion bump, one coherent cutover. Exit: all *ritual* path/way writes flow through the authority (kiem node migration is P5's job — do not overclaim).
- **P3 `requiredWay`** — NodeSystem way gating.
- **P4 Normalize Pháp Tu** — `phap_tu_an` → way `ngo_dao` (representation change only — Ẩn is already a ritual path); element/route ownership unchanged.
- **P5 Normalize Thể Tu** — `the_tu_an` → way `ung_the`; root mutex stays NodeSystem-owned nodes.
- **P6 Normalize Kiếm Tu** — hardest: ngu becomes ritual way (approved gameplay change + open starter-kit item); `kiemTu.mode` retires; slice stays unified.
- **P7 Remove 5-ID model + obsolete adapters** — union shrinks; `phap_tu_an`/`the_tu_an`/`kiem_tu_an` path-id remnants, mode-switch machinery, temporary delegates deleted.
- **P8 Contribution ownership cleanup** — stat emitters into way facets; verify both channels.
- **P9 Core leakage cleanup** — dependency/branch-level; modules may know their own ids.
- **P10 Architecture guards + full E2E.**

## 27. Testing Requirements

- Catalog: unique path ids, unique way ids per path, kit refs (technique/skills/nodes) resolve.
- Authority: `listOfferableWays` gate evaluation at ritual time (linh_bao/huy_quyen/tram); `applyPathChoice` atomic or nothing; no second choice.
- Nodes: NodeSystem suite + `requiredWay` gating across all six ways.
- Stats: assembly + delta channels per way, domain-gated, exactly-once, absent when way not chosen.
- Skills: kit grants correct per way at ritual; no way branches in SkillSystem.
- Combat: battle-build output per way matches pre-migration snapshots.
- Persistence: new shape validates/round-trips/repeat-restores safely; `_an` path ids rejected post-cutover.
- Isolation: no cross-path/way imports; no path/way branches in generic systems (dependency-level, not just literal grep).
- Wiring (P13/P14): Playwright ritual→way gate→tree→combat per way.

## 28. Architecture Guards

- Import-boundary tests: generic core must not import path modules (primary guard — dependency direction).
- Branching guard: path/way conditional logic in generic systems fails review; concrete modules/content legitimately know their own ids — do not pursue zero-literal purity.
- `runCultivationPathContractTests(module)` over all three paths: valid definition, unique ids, ways well-formed (kit refs, nodeIds exist + carry `requiredWay`, offerGate shape), `createInitialState` shape.

## 29. Explicit Non-Goals

- Legacy save migration / compatibility bridges (project policy: strict version rejection)
- Rebalances/redesigns of combat/stat/skill/resource systems
- New ECS, event bus, modifier engine
- More than the six current ways (growth is data, not machinery)
- In-way branch unification (§15)
- Behavior changes beyond the approved ngu-entry change (§1)

## 30. Acceptance Criteria

- `CultivationPathSystem` sole writer of `cultivationPath` + `cultivationWay` and way-slice lifecycle.
- Three path modules, six way modules, one evolved catalog — no parallel registry.
- Ẩn uniformly = ritual-gated ways; `_an` path ids, `kiemTu.mode`, and all transition machinery gone.
- In-way branch ownership unchanged (phapTu element/route; the_tu mutex nodes; skill spec in SkillSystem).
- NodeSystem sole node-investment authority; `requiredWay` expresses way membership — no parallel unlock state.
- Both stat channels via typed way facets; no path/way branches in generic systems.
- Ritual stays one atomic RealmAdvanceOps transaction delegating path writes.
- No cross-path/way imports; one composition root.
- Type-check, build, all tests green; Playwright verification per way.

## 31. Litmus Test

- **New Path X:** `core/<x>/` mechanics if needed + `XPath.ts` (definition + way modules) + `XNodes.ts` + register + optional UI. No core edits.
- **New way in existing path:** add a `PathWayModule` (gate/kit/nodeIds/facets/slice factory). No framework edits.
- If either requires editing generic systems → framework failed.

## 32. AGENTS.md Rule Addition

> **Cultivation Path Isolation.** Cultivation paths are registered modules under the Cultivation Path Framework. `CultivationPathSystem` is the sole authority for active path, active way, and ritual offer/choice; `NodeSystem` remains sole authority for node investment; in-way branch state stays with its existing owners (`phapTu` element/route, mutex root nodes, skill specialization). Each path declares **ways** — path-owned branches with their own kit, node subtree, and mechanic slice — all chosen at the Initiation Ritual (way offer gates are ritual-time evaluations, never persisted). Core systems MUST NOT branch on concrete path or way identity; contributions flow through typed contracts (domain-gated stat modifiers, kit skill grants, battle-build providers). Concrete paths and ways MUST NOT depend on one another.

## 33. Target Architecture

```
              CULTIVATION_PATH_MODULES (content catalog)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
    KiemTuPath     PhapTuPath      TheTuPath
     ├─ hien        ├─ ngu_hanh      ├─ hien
     └─ ngu (gate)  └─ ngo_dao(gate) └─ ung_the (gate)
        │               │               │
        └───────────────┼───────────────┘
                        ▼
             CultivationPathSystem
          (offer / choose path+way authority)
                        │
        ┌───────┬───────┼────────┬──────────────┐
        ▼       ▼       ▼        ▼              ▼
   StatSystem SkillSystem NodeSystem  Battle-build   RealmAdvanceOps
   (modifiers) (grants)  (investment) (providers)    (ritual txn)
                        │
                        ▼
                        UI (via GameManager facades)
```

Final principle:

> CultivationPathSystem owns path+way lifecycle.
> Path modules own composition; way modules own mechanic slices.
> Dedicated systems own mechanic execution.
> NodeSystem owns node investment; in-way branches keep their owners.
> RealmAdvanceOps owns the ritual; Stats/Skills/Combat keep execution authority.
>
> Three paths, N ways each, one set of architectural laws.
