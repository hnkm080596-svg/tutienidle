# Canonical Path Authority — Implementation Plan (P1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cultivation path a pure capability contract — downstream systems consume declared capabilities and typed branch reads from the path authority, and never infer path/way identity from owned skills, seals, Ngộ Đạo passives, slice presence, node ownership, or UI state.

**Program / spec:** `game/docs/specs/2026-09-20-post-canonical-foundation-block-spec.md` §P1 (authoritative requirement — the pending block moved out of `roadmap.md` into this spec). Ordering constraint: P1 runs **after** the Canonical Seal / Ngộ Đạo / Reaction V2 megaplan (`2026-09-19-megaplan-canonical-seals-ngo-dao-reaction-v2.md`) — **V2 is already merged**; this plan binds to the landed reality, not the V2 plan text.

**Architecture:** Extends the shipped Cultivation Path Framework (spec `docs/specs/2026-09-16-cultivation-path-framework-spec.md`, merged — `cultivationPath` 3-id union + `cultivationWay`, `CULTIVATION_PATH_MODULES`, `CultivationPathSystem` write authority, `CultivationPathRegistry` combat dispatch incl. `grantsElementalReactionAura`, `cultivationPathIsolation` guard, save v67). P1 adds the missing capability layer on top:

```
CultivationPath (3 ids, ritual-only write — exists)
    ↓
PathWayDefinition (module catalog — exists)
    ↓ declares: capabilities facet, ownedContent, subpath axes, slice validator
PlayerPathState (cultivationPath/cultivationWay + owned slices — exists)
    ↓ resolvePathCapabilities / resolvePathBranches  (NEW)
Capabilities (ReadonlySet<PathCapability>) + typed branch read models
    ↓
Feature systems / HUD / save boundary
    ↓ CultivationPathRuntime semantic flags + buff2 capability grants (canonical combat carriers — exist)
Combat Runtime (never reconstructs player identity)
```

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

---

## Global Constraints

- **Zero gameplay change.** P1 is an authority refactor: every migrated consumer must produce identical outcomes. No new path behavior is introduced.
- **Capabilities map to real consumers.** No speculative vocabulary: every `PathCapability` declared must name ≥1 real production consumer found in M0. If a capability has no consumer, it does not exist.
- **Framework spec §8.1/§15 still bind.** Definitions stay declarative — conditional capability resolution lives in a *structured facet* (`PathCapabilityFacet`, same layering precedent as the `stats` facet), never free-form callbacks on the definition. In-way branch state is NOT unified — `phapTu.element/route`, `kiemTu.preset`, the_tu root-mutex nodes keep their owners; P1 formalizes *reads and declarations*, not state.
- **Combat capability carriers already exist — formalize, don't replace.** Two canonical channels are live: (a) `CultivationPathRuntime` semantic flags (`grantsElementalReactionAura` — gate owned at `CultivationPathRegistry.ts:459`, consumed by entry grant `GameManagerTurnBattleOps.ts:1346-1359` and the dormant revive seam `:1388-1435`); (b) buff2 `ActiveCapabilityGrant`s on kit clones (`grantsBuffsAtBuild` markers; `isUngTheCombatant(grants)` reads). P1 binds these to the capability vocabulary (one source for each condition); it does not rip them out or add a third channel.
- **P3 verification:** `quick` = `npm run type-check` + `npx vitest run <scope>` from `game/`. `full` (`npm run verify`) mandatory for P1-M2 (catalog shape), P1-M4 (combat surface), P1-M6 (save boundary), P1-M7 (guards + E2E).
- **P4:** adversarial QA (quick) after every production mission; deep for M4/M6.
- **P5:** Sequential Multi-Pass Review per mission (≥3 ordered passes). **P7:** commits need explicit user authorization — commit steps describe granularity only.
- **P13/P14:** M4/M5 touch battle-build wiring + HUD readers → drive the real ritual→way→combat flow via Playwright (`npm run dev`, actual printed port) inside the implementation worktree. The existing `tests/e2e/cultivation-path-ritual.spec.ts` (7-scenario per-way matrix) is the harness to extend, not replace.
- **Save policy:** strict version rejection (current `CURRENT_SAVE_VERSION = 67`), no migration bridges. Any shape change lands with its version bump + validation + consumer in the same mission.
- Per-mission report: changed / files / authority moved / adapters remaining / tests / build status / behavior changes (=None) / risks / next.

---

## §0. Verified Current-State Baseline (master, post-framework + post-V2 merge)

| Concern | Current implementation | Owner |
|---|---|---|
| Path/way identity write | `applyPathChoice` — sole writer of `cultivationPath` + `cultivationWay` + `createInitialState` slice | `core/player/CultivationPathSystem.ts` |
| Catalog | `CULTIVATION_PATH_MODULES` (3 modules, 6 ways); way defs in `core/{kiem-tu,phap-tu,the-tu}/*Path.ts` | `core/player/CultivationPathKit.ts` |
| Way predicates | `isKiemTuHien/Ngu`, `isPhapTuNguHanh/NgoDao`, `isTheTuHien/UngThe` — module-owned | path module files |
| Combat dispatch | `resolveCultivationPathRuntime` keyed `'path:way'` → `CultivationPathRuntime` | `core/player/CultivationPathRegistry.ts` |
| Combat capability channel A | `grantsElementalReactionAura()` semantic flag — condition (`skillManager.has(ngo_dao_hon_don)`) owned at dispatch site `Registry:459-465`; consumed by `applyEntryBuffs` (`TurnBattleOps:1346-1359`) and dormant revive re-grant `regrantAuraOnSourceRevived` (`:1388-1435`) | Registry (predicate) → runtime method (carrier) → orchestrator seams |
| Combat capability channel B | buff2 capability grants on kit clones (`grantsBuffsAtBuild`; `isUngTheCombatant`, `theGainPerRound/OnEvade/OnHitTaken`) — participant-local, no player identity | `core/proc/MarkerCapabilities.ts`, `core/the-tu/TheEconomy.ts` |
| Node gating | `requiredCultivationPath` + `requiredWay` vs persisted pair | `core/progression/NodeSystem.ts:301` |
| Save shape | pair coherence + `kiemTu`/`phapTu` slice blocks; `CURRENT_SAVE_VERSION = 67`; `ShapeIssue` local type | `services/save/saveShapeValidation.ts:385-557` |
| Isolation guard | identity-branching ban outside `core/player/`, module dirs, `services/save/`; value-import seam allowlist | `tests/architecture/cultivationPathIsolation.test.ts` |

### Inference / indirect signals that survive today (P1's real target list)

| Site | Inference | Desired read |
|---|---|---|
| `presentation/bridges/kiemBarBridge.ts:103` | `!kiemTu` slice presence ⇒ "not kiem_tu" | capability query (`kiem_tu.*` → kiếm bar; `the_tu.the_economy` → Thế bar) |
| `presentation/bridges/kiemBarBridge.ts:107` | `usesTheResource` way flag | declared capability (`the_tu.the_economy`) — same idea, canonical surface |
| `presentation/bridges/theBarBridge.ts:78,82,101` | `isPhapTuNguHanh` + `phapTu.element` + `linh_ngo_<godUlt>` node ownership | `phap_tu.the_pool` cap + `getActiveElement` + conditional cap `phap_tu.empowered_ult` |
| `core/pill/PillSystem.ts:156` | `isPhapTuNguHanh` gates MP pills | `phap_tu.elemental_casting` (deliberately ngu_hanh-only — preserve) |
| `core/game/GameManager.ts:485` | `routeProfileProvider` gates on `isPhapTuNguHanh` + `PHAP_TU_KIT_IDS[element].includes(skillId)` | capability + branch-owned kit membership |
| `core/game/GameManagerProgressionOps.ts:110,206` | `getPhapTuElement`/`selectPhapTuElement` gate on `isPhapTuNguHanh` | capability + module-owned commit op (INV-13 atomicity untouched) |
| `core/game/GameManagerRealmAdvanceOps.ts:86` | `player.kiemTu && isKiemTuNgu` gates breakthrough merge | `kiem_tu.ngu_kiem_dao` capability (slice presence becomes a declared invariant check, not the signal) |
| `Registry:465` | `skillManager.has(ngo_dao_hon_don)` open-codes the aura condition | conditional capability `phap_tu.reaction_aura` — the runtime method delegates to it (one source; both seams already consume the method, zero seam changes) |
| `components/panels/SkillPathPanel.vue:56-75,189-197` | predicate chains pick tree branch tags | way-declared `branchTags` / tree view declaration |
| `kiemTu.preset` readers (kiemBarBridge, KiemPho) | direct slice read | canonical read `getKiemTuPreset` (payload after `kiem_tu.*` cap gate — fail-closed on wrong way) |
| `saveShapeValidation.ts:438-557` | hardcoded `kiem_tu`-requires-slice + `phapTu`/`kiemTu` shape blocks | module-declared `validatePersistedState` iterated generically |

Not inference (keep): `BASIC_ATTACKS_BY_BUILD[player.cultivationPath]` (content keyed on declared id), `requiredWay` node checks (declared data), buff-grant capability reads inside battle (canonical carrier), `assertNgoDaoKitLearned` (kit integrity at the dispatch site), mortal-runtime slot-0 read, `applyEntryBuffs`/`regrantAuraOnSourceRevived` consuming `grantsElementalReactionAura` (already the canonical seam pattern — only the predicate's source changes).

---

## Mission P1-M0 — Capability & inference inventory (read-only, confirmatory)

**Files:**
- Create: `game/docs/architecture/2026-09-20-path-capability-inventory.md`

The baseline table above is pre-verified; M0 completes the census and confirms the vocabulary.

- [ ] **Step 1 — Lock baseline:** record `git rev-parse HEAD` and `CURRENT_SAVE_VERSION` (expect 67); confirm the merged V2 seams (`VAN_PHAP_THAN_HOA_ID`, `grantsElementalReactionAura`, `regrantAuraOnSourceRevived`, `PHAP_TU_AN_REQUIRED_SKILLS`) — update this plan's §0 table if reality has drifted.
- [ ] **Step 2 — Enumerate readers:** grep `game/src` for `cultivationPath|cultivationWay|getActiveWay|getActivePath|getActiveWayDefinition|isKiemTu|isPhapTu|isTheTu|kiemTu\b|phapTu\b|skillManager\.has|nodeLevels\[|linh_ngo_|van_phap_than_hoa|usesTheResource|BASIC_ATTACKS_BY_BUILD`. Record file:line, read-vs-write, and **what decision the read drives**.
- [ ] **Step 3 — Classify each read:** (a) legitimate owner read; (b) capability candidate — downstream behavioral gate → `hasPathCapability`; (c) branch-state read → typed branch contract; (d) defect — inference that can disagree with the committed pair.
- [ ] **Step 4 — Capability matrix:** confirm/trim this seed — every entry must name granting way(s) + ≥1 real consumer:

| Capability | Way | Real consumers (seed) |
|---|---|---|
| `phap_tu.elemental_casting` | ngu_hanh | PillSystem MP gate, routeProfileProvider, element tree, element commit |
| `phap_tu.the_pool` | ngu_hanh | theBarBridge Thế bar, empowerment threshold |
| `phap_tu.empowered_ult` (conditional — `linh_ngo_<godUlt>` node) | ngu_hanh | theBarBridge `empowered`, `applyPhapTuEmpowerment` |
| `phap_tu.reaction_aura` (conditional — `ngo_dao_hon_don` learned) | ngo_dao | `grantsElementalReactionAura` → entry grant + dormant revive re-grant |
| `kiem_tu.kiem_pho` | hien | KiemPho provider, preset editor, kiếm bar hien mode |
| `kiem_tu.ngu_kiem_dao` | ngu | NguKiemDao provider/economy/realm merge, emblem slots, ngu bar mode |
| `the_tu.root_kit` | hien | root-mutex kit resolution, bat_tu survival |
| `the_tu.the_economy` | ung_the | The-economy marker grants, reactive payloads, Thế bar, `usesTheResource` |

- [ ] **Step 5 — Branch/subpath inventory:** every in-way branch axis (`phapTu.element`, `phapTu.route`, `kiemTu.preset`, the_tu root-mutex node ids, phap element roots) with owner + readers → feeds M3.
- [ ] **Step 6 — Write the inventory doc** with matrix, migration table (site → capability/read → mission), defect dispositions (fix-in-P1 vs pre-existing out-of-scope), and **amend M1–M7 in place** wherever the census disagrees with this plan — the plan follows evidence, not vice versa.

**Exit criteria:** every identity-adjacent read has owner + verdict; zero speculative capabilities; M1–M7 file/consumer lists amended to match the census.

---

## Mission P1-M1 — `PathCapability` contract + authority resolver

**Files:**
- Modify: `game/src/core/player/CultivationPathKit.ts` — `PathCapability` union, `PathCapabilityDeps`, `PathCapabilityFacet`, `PathWayDefinition.capabilities`
- Modify: `game/src/core/player/CultivationPathSystem.ts` — `resolvePathCapabilities` + `hasPathCapability`
- Modify: `game/src/core/{kiem-tu/KiemTuPath,phap-tu/PhapTuPath,the-tu/TheTuPath}.ts` — declare each way's capability facet
- Modify: `game/src/core/game/GameManager.ts` — expose a bound `hasPathCapability(cap)` facade (binds `skillManager.has` once) so consumers don't each reconstruct deps
- Test: `CultivationPathSystem.test.ts`, `CultivationPathContract.test.ts` (extend)

**Interfaces — Produces:**

```ts
// CultivationPathKit.ts
/**
 * A downstream-facing behavioral grant namespaced by owning path.
 * Closed union extended ONLY when a real consumer exists (M0 matrix).
 * Format: '<pathId>.<feature>'. Not persisted — derived per call.
 */
export type PathCapability =
  | 'phap_tu.elemental_casting'
  | 'phap_tu.the_pool'
  | 'phap_tu.empowered_ult'
  | 'phap_tu.reaction_aura'
  | 'kiem_tu.kiem_pho'
  | 'kiem_tu.ngu_kiem_dao'
  | 'the_tu.root_kit'
  | 'the_tu.the_economy'

/**
 * Minimal context for conditional predicates — session-owned state that
 * is NOT on PlayerData. Learned skills live in SkillManager (restored at
 * session boundary), so skill-membership conditions read through this
 * dep instead of pretending player.skills exists.
 */
export interface PathCapabilityDeps {
  hasSkill(skillId: string): boolean
}

/**
 * Structured facet on the way — same layering precedent as the `stats`
 * facet (named, typed members; NOT free-form callbacks, spec §8.1).
 * `static` is pure data; `conditional` predicates are module-owned rules
 * evaluated live (e.g. phap_tu.reaction_aura = tâm pháp learned).
 */
export interface PathCapabilityFacet {
  readonly static?: readonly PathCapability[]
  readonly conditional?: Readonly<Partial<Record<PathCapability,
    (player: PlayerData, deps: PathCapabilityDeps) => boolean>>>
}
// on PathWayDefinition:  capabilities?: PathCapabilityFacet

/**
 * Minimal identity read contract — the committed pair only. Satisfied
 * by PlayerData AND by every presentation slice that carries the pair
 * (KiemBarPlayerState, TheBarPlayerState stay narrow by design).
 */
export interface PathIdentityRead {
  cultivationPath?: CultivationPathId
  cultivationWay?: PathWayId
}

// CultivationPathSystem.ts
/** The player's full capability set — active way's static + live-evaluated
 *  conditional caps; mortal/corrupt pairs resolve to the empty set.
 *  Full PlayerData is required because conditional predicates may read
 *  nodeLevels/slices. */
export function resolvePathCapabilities(
  player: PlayerData,
  deps: PathCapabilityDeps,
): ReadonlySet<PathCapability>
/** The canonical downstream read for CORE callers (full PlayerData).
 *  Presentation NEVER calls this with its narrow slice types — bridges
 *  consume the bound facade `gameManager.hasPathCapability(cap)`
 *  (deps pre-bound to skillManager.has) injected like today's helpers. */
export function hasPathCapability(
  player: PlayerData,
  cap: PathCapability,
  deps: PathCapabilityDeps,
): boolean
```

- [ ] **Step 1:** failing tests — mortal resolves `∅`; each way resolves exactly its declared set (incl. `phap_tu.reaction_aura` present iff `deps.hasSkill('ngo_dao_hon_don')`, `phap_tu.empowered_ult` iff `linh_ngo_<element>` owned); corrupt pair resolves `∅`; catalog validation rejects capability whose `<pathId>` prefix mismatches `pathId`, and rejects the same capability declared by two ways.
- [ ] **Step 2:** implement types + facet + resolver + way declarations (M0 matrix verbatim) + GameManager facade.
- [ ] **Step 3:** `npx vitest run src/core/player` + `npm run type-check`.
- [ ] **Step 4:** commit: `feat(path): canonical capability contract on the way model`

**Exit criteria:** one resolver owns capability derivation; union is closed and consumer-backed; zero consumer migrated yet (quick verification).

---

## Mission P1-M2 — Owned-content declarations

Modules declare what they own; the catalog validates; consumers stop re-deriving membership.

**Files:**
- Modify: `game/src/core/player/CultivationPathKit.ts` — extend `PathWayDefinition`:

```ts
/** Content this way owns (catalog-validated, unique across modules):
 *  skills/passives granted or exclusive to the way; buff/marker/seal
 *  definition ids it plants at build. Pure data (spec §8.1). The aura's
 *  APPLICATION stays runtime-owned (grantsElementalReactionAura) —
 *  ownedContent declares OWNERSHIP, not timing. */
ownedContent?: {
  skillIds?: readonly string[]
  buffIds?: readonly string[]
}
```

- Modify: `CultivationPathContract.test.ts` — owned skill ids exist in skill templates; owned buff ids exist in the LIVE buff registry (incl. `van_phap_than_hoa` under ngo_dao); no id owned by two ways; ngo_dao's `ownedContent.skillIds` is the declaration of record for the kit (the module re-exports `PHAP_TU_AN_REQUIRED_SKILLS` FROM its own declaration — single source, registry keeps asserting completeness at the dispatch site).
- Modify: the three `*Path.ts` modules — fill `ownedContent` (ung_the owns `ung_the`/`ho_mon`/`phan_mon`/`tro_mon` markers; ngu owns emblem def ids; ngu_hanh owns its element kit ids where exclusive — M0 matrix decides).

- [ ] **Step 1:** failing catalog tests (refs resolve, uniqueness, ngo_dao owns kit + aura def).
- [ ] **Step 2:** implement field + declarations + validation inside `runCultivationPathContractTests` (uniform per module).
- [ ] **Step 3:** `npm run verify` (catalog shape touches build-time data).
- [ ] **Step 4:** commit: `feat(path): way-owned content declarations`

**Exit criteria:** ownership is data, not grep; a new path's content = declaring it on the module (litmus). No consumer migrated yet.

---

## Mission P1-M3 — Branch/subpath contract (formalize, don't unify)

**Files:**
- Modify: `game/src/core/player/CultivationPathKit.ts`:

```ts
/** An in-way branch axis the path owns (framework §15 — state stays
 *  with its existing owner; this declaration is the READ contract).
 *  DATA ONLY — way definitions carry no executable callbacks; the
 *  concrete reads live in CultivationPathSystem. */
interface PathSubpathAxis {
  /** Static capability (declared by the same way) gating the axis. */
  requiresCapability?: PathCapability
  /** Persisted field the axis owns, e.g. 'player.phapTu.element'. */
  state: string
}
// on PathWayDefinition:
subpaths?: { element?; route?; preset?; root? }
// `root` on the_tu ways is an ownership record only (M0 dropped
// getTheTuRoot - no external consumer).
```

- Modify: `CultivationPathSystem.ts` — typed branch reads, each fail-closed (undefined when the owning capability/way is absent); NodeSystem stays write authority (`core/player → core/progression` import direction already exists via the Registry). **Signatures are narrow structural reads** — `PathConditionalRead` (pair + optional slices) — so presentation slices (KiemBarPlayerState etc.) satisfy them without widening to `PlayerData`:

```ts
export function getActiveElement(player: PathConditionalRead): ElementType | undefined
export function getActiveRoute(player: PathConditionalRead): PhapTuRoute | undefined
export function getKiemTuPreset(player: PathConditionalRead): readonly OrbId[] | undefined
```

- Test: `CultivationPathSystem.test.ts` — each read undefined on wrong way/corrupt pair; `getKiemTuPreset` undefined on ngu.

- [ ] **Step 1:** failing tests per read.
- [ ] **Step 2:** implement axes + reads; migrate `GameManagerProgressionOps` `getPhapTuElement`/`resolveRouteProfile` call sites to the authority reads (identical returns).
- [ ] **Step 3:** `npx vitest run src/core/player src/core/progression src/core/game` + type-check.
- [ ] **Step 4:** commit: `feat(path): subpath axis declarations + canonical branch reads`

**Exit criteria:** branch state owner-written (INV-13 `selectPhapTuElement` atomicity untouched); every outside-module read of `phapTu.element/route`, `kiemTu.preset`, or the_tu root goes through the authority read.

---

## Mission P1-M4 — Combat consumes capabilities (bind the carrier, keep the seams)

The entry + revive seams are already correct (`grantsElementalReactionAura` consumers). M4 binds the **condition** to the capability authority so the predicate has exactly one source.

**Files:**
- Modify: `core/player/CultivationPathRegistry.ts` — `createPhapTuNgoDaoRuntime.grantsElementalReactionAura` returns `hasPathCapability(player, 'phap_tu.reaction_aura', deps)` where `deps.hasSkill = (id) => deps.skillManager.has(id)` — the `ngo_dao_hon_don` predicate moves into the phap_tu module's `conditional` facet (module-owned), and the runtime method becomes pure delegation. `assertNgoDaoKitLearned` unchanged.
- Modify: `core/game/GameManager.ts` — `routeProfileProvider` gates on `hasPathCapability(player, 'phap_tu.elemental_casting', facadeDeps)` + `getActiveElement`.
- Test: `GameManager.skillPipelineJourney.test.ts` (extend), `CultivationPathRuntime.test.ts` — pin BOTH seams: entry grant and `regrantAuraOnSourceRevived` produce identical gating (aura on all living `battle.players`; none for hien; re-grant skips existing holders — the dormant seam's event-idempotence is preserved, not rebuilt).

- [ ] **Step 1:** failing tests — capability-driven aura gate; kit-incomplete ngo_dao save still throws at build (integrity preserved); revive seam unchanged behaviorally.
- [ ] **Step 2:** migrate the predicate + provider; **no edits** to `applyEntryBuffs`/`regrantAuraOnSourceRevived` bodies (they consume the method correctly — pin with tests).
- [ ] **Step 3:** `npm run verify` + path/combat scopes.
- [ ] **Step 4 (P13/P14):** dev server in worktree → real tribulation → ngo_dao → combat: aura on party, reactions fire, Thế bar absent.
- [ ] **Step 5:** commit: `refactor(path): aura gate binds to capability authority; combat consumes declared flags`

**Exit criteria:** the aura condition has one owner (module facet) and one carrier (runtime method) consumed by both seams; `GameManager` holds zero path predicates. **Deep QA** on aura gating.

---

## Mission P1-M5 — Feature-system migration

Move every remaining (b)/(c) read from the M0 table onto the authority.

**Files:**
- Modify: `core/pill/PillSystem.ts` — `isPhapTuNguHanh` → `hasPathCapability(player, 'phap_tu.elemental_casting', deps)` (deps injected at the call boundary — PillSystem gets the bound facade, same pattern as `routeProfileProvider`).
- Modify: `presentation/bridges/kiemBarBridge.ts` — `!kiemTu` presence check → capability branch (`kiem_tu.kiem_pho`/`kiem_tu.ngu_kiem_dao` → kiếm bar mode; `the_tu.the_economy` → Thế bar); `usesTheResource` retires into the capability (way def keeps a `hudResourceBar?: 'the'` declaration ONLY if the renderer needs a label discriminator — M0 decides; default: capability id IS the discriminator). Preset reads go through `getKiemTuPreset`.
- Modify: `presentation/bridges/theBarBridge.ts` — gate on `phap_tu.the_pool`; element via `getActiveElement`; `empowered` via `phap_tu.empowered_ult` conditional cap.
- Modify: `components/panels/SkillPathPanel.vue` — `showTree`/`treeBranchTag`/`theTuTreeTag` predicate chains → add `branchTags?: readonly string[]` (pure data) on the way definition; panel renders declared tags; element tabs still render under `phap_tu.elemental_casting`.
- Modify: `GameManagerRealmAdvanceOps.applyKiemTuRealmTransition` — `isKiemTuNgu` → `hasPathCapability(player, 'kiem_tu.ngu_kiem_dao')`.
- Modify: `core/tribulation/BreakthroughOutcomeService.ts` dead legacy block (if still referencing `ngu_hanh` realm-technique grant) — route through the authority read or documented dead-code note (M0 verdict).
- Test: `theBarBridge.test.ts`, `kiemBarBridge.test.ts`, PillSystem profession tests, `SkillPathPanel` tests — rebuilt on capability fixtures (player built via `applyPathChoice`, never stuffed `cultivationPath` literals).

- [ ] **Step 1:** failing characterization tests per site (pin current behavior first where coverage is thin).
- [ ] **Step 2:** migrate each site; delete dead `isXxx` imports.
- [ ] **Step 3:** `npx vitest run` affected scopes + type-check.
- [ ] **Step 4 (P14):** real browser — Thế bar on ung_the + ngu_hanh (empowered marker at `linh_ngo_*` owned), kiếm bar hien/ngu modes, MP pill rejection on non-phap paths.
- [ ] **Step 5:** commit: `refactor(path): feature systems consume capability authority`

**Exit criteria:** the M0 (b)/(c) table fully migrated; module predicates legal only inside module dirs, `core/player`, and documented presentation seams.

---

## Mission P1-M6 — Serialization contract (module-owned slice validation)

The save boundary validates an **untrusted payload** — `PlayerData` types do not exist there yet. The contract is therefore layer-neutral: each module declares one validator over the raw `unknown` player payload; the save service adapts emitted issues into its local `ShapeIssue`. No module imports `services/` (isolation rule holds).

**Files:**
- Modify: `core/player/CultivationPathKit.ts`:

```ts
/** Layer-neutral issue emitted by module validators; the save boundary
 *  adapts it to its local ShapeIssue. Lives in core so path modules
 *  never import services/. */
export interface PathStateIssue {
  /** JSON path relative to save root, e.g. 'player.phapTu.element'. */
  readonly path: string
  readonly message: string
}
// on CultivationPathModule — ONE hook, the module owns ALL its rules:
/**
 * Validate this module's persisted fields from the RAW player payload
 * (untrusted — narrow with guards, do not cast to PlayerData).
 * Runs for EVERY save; the module itself decides presence/shape/pair
 * rules, e.g.:
 *   phap_tu: player.phapTu required + shaped on every save
 *            (mortal and other-path saves included);
 *            element/route only under committed way ngu_hanh.
 *   kiem_tu: player.kiemTu optional shape; REQUIRED when the committed
 *            pair is kiem_tu — the module reads the raw pair fields
 *            itself to decide.
 * The boundary supplies no path knowledge — modules are the only place
 * that knows which fields they own.
 */
validatePersistedState?(playerPayload: unknown, emit: (issue: PathStateIssue) => void): void
```

- Modify: `services/save/saveShapeValidation.ts` — keep pair-coherence + enum + mortal-gate (boundary owns the persisted union contract); replace the hardcoded `kiemTu`/`phapTu` blocks with a generic `for (const m of CULTIVATION_PATH_MODULES) m.validatePersistedState?.(playerPayload, emit)`; adapt `PathStateIssue` → `ShapeIssue` locally.
- Move: the `kiemTu` shape block → `core/kiem-tu/` (validator beside `freshKiemTuState`); the `phapTu` block → `core/phap-tu/` (beside `PhapTuState`).
- Test: `saveShapeValidation.test.ts`, SaveRoundTrip — the existing reject corpus must still reject identically (move, don't weaken); **explicit new regressions**: missing `phapTu` on mortal/kiem_tu/the_tu saves rejects; missing `kiemTu` on active `kiem_tu` rejects; `phapTu.element` set under way `ngo_dao` rejects; corrupt `kiemTu` present under a non-kiem path rejects.

- [ ] **Step 1:** failing tests (existing reject corpus stays green — pin first).
- [ ] **Step 2:** implement hooks + migrate blocks + generic iteration.
- [ ] **Step 3:** `npm run verify` (save boundary).
- [ ] **Step 4:** commit: `refactor(path): module-owned slice validation at the save boundary`

**Exit criteria:** persisted path state = identity pair (boundary-owned) + module slices (module-owned validators); a new path carries its own rules — zero save-layer edits. **Deep QA** on save/restore round-trips per way.

---

## Mission P1-M7 — Guards, contract suite, E2E closure

**Files:**
- Modify: `tests/architecture/cultivationPathIsolation.test.ts` — tighten: outside `core/player/` + module dirs + `services/save/` + the explicit presentation allowlist, `isKiemTu*/isPhapTu*/isTheTu*` value imports are banned (consumers must use `hasPathCapability`/branch reads); direct `player.kiemTu.*`/`player.phapTu.element` reads outside module dirs + the authority flagged as slice inference (M0 evidence decides exact patterns).
- Modify: `CultivationPathContract.test.ts` (`runCultivationPathContractTests`) — every module: valid ways, capability prefix ownership, `ownedContent` refs resolve, `subpaths` axes point at declared slices, `validatePersistedState` present on every module that owns a persisted slice.
- Modify: `tests/e2e/cultivation-path-ritual.spec.ts` — keep the 7-scenario matrix; add capability assertions where a spec already drives the way (ngo_dao aura present in combat; hien preset provider attached).
- Modify: `AGENTS.md` — extend the Cultivation Path Isolation rule (A13) with the capability read contract; `docs/systems/cultivation-paths.md` — document the capability model + the two combat carrier channels.

- [ ] **Step 1:** tighten guard regexes — prove they fail on a synthetic predicate import outside the allowlist (red), then pass on migrated tree (green).
- [ ] **Step 2:** contract suite extensions.
- [ ] **Step 3:** `npm run verify` + E2E spec.
- [ ] **Step 4:** commit: `test(path): capability-authority guards + contract closure`

**Exit criteria:** a new `isPhapTuNguHanh` import in `core/pill` fails the suite; the litmus holds end-to-end — a hypothetical fourth path needs: module file + way defs + nodes + catalog entry, zero edits in PillSystem/bridges/save/TurnBattleOps.

---

## Acceptance Criteria (maps the §P1 spec exit conditions)

- `CultivationPathSystem` remains the sole writer of path/way identity AND is the sole resolver of capabilities + branch reads; `resolvePathCapabilities` is the only capability derivation.
- Every downstream behavioral gate consumes `hasPathCapability` / typed branch reads — no `hasSkill(...)`/slice-presence/node-ownership/UI inference of path identity outside the authority, module dirs, and declared presentation seams.
- All three paths conform to one contract: `PathWayDefinition` + `capabilities` facet + `ownedContent` + `subpaths` + optional slice validators; verified by `runCultivationPathContractTests`.
- Path/build state serializes and restores through the boundary contract (pair coherence + module slice validators on `unknown` payloads).
- Combat consumes the two canonical carriers — runtime semantic flags (`grantsElementalReactionAura`, bound to `phap_tu.reaction_aura`) and participant buff2 capability grants; battle orchestration holds zero path predicates.
- `type-check`, `build`, full Vitest, `cultivation-path-ritual` E2E green; zero behavior change vs baseline.

## Explicit Non-Goals

- No new paths/ways, no gameplay/balance changes, no in-way branch unification (§15), no P2 `ResolvedCombatBuild` work (this mission ends at capabilities + branch reads; build composition is the next program item), no legacy save migration, no generic capability *engine* (a Set + declared predicates only), no re-plumbing of the aura grant seams (already canonical).

## Open Questions for M0 to Resolve

1. Exact `PathCapability` vocabulary — the seed table is a proposal; each entry needs its M0 consumer or gets cut.
2. Whether `usesTheResource` retires into `the_tu.the_economy`/`phap_tu.the_pool` or stays a declared HUD discriminator.
3. Whether any reader legitimately needs a *parameterized* conditional beyond `phap_tu.empowered_ult`/`phap_tu.reaction_aura` (M0 decides if `conditional` earns both entries).
4. How `PathCapabilityDeps` reaches presentation bridges — bound GameManager facade vs. store-level binding (M0 picks whichever matches the existing bridge wiring).
