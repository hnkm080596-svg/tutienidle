# Canonical Build Composition — Implementation Plan (P2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One canonical `ResolvedCombatBuild` artifact — resolved once per battle entry by a single pure resolver — replaces the ad-hoc recombination of player state, registries, and runtime seams that `GameManagerTurnBattleOps` performs today.

**Program / spec:** `game/docs/specs/2026-09-20-post-canonical-foundation-block-spec.md` §P2. Ordering: P2 runs after P1 — **P1 (Canonical Path Authority) is implemented and IMPLEMENT-READY on this branch** (`p1-canonical-path-authority`, worktree `.agent-worktrees/p1-canonical-path-authority`); this plan binds to the landed P1 capability layer, not the P1 plan text.

**Architecture:** The battle entry's player-side assembly is today scattered across `beginBattleCycleCommitted` / `buildTurnBattle` / `applyEntryBuffs` in `core/game/GameManagerTurnBattleOps.ts` — ~12 direct seams (stat aggregation, entity minting, path-runtime kit, formation, companions, entry buffs, survive sources, live-modifier provider). P2 introduces one composition authority:

```
PlayerData + domain registries (unchanged owners)
    ↓ resolveCombatBuild(source, runtime, deps)  (NEW — pure, no Phaser, no rng, no Date.now)
ResolvedCombatBuild {
  identity, capabilities,
  stats + modifierChannels (attribution),
  entity, kit, formation, companions,
  entryBuffs (declarations), survive plan,
  liveModifiers (bound provider)
}
    ↓ consumed by
GameManagerTurnBattleOps (assembly/apply only — no recombination)
    ↓
TurnBattle / TurnBattleSystem (unchanged engine)
```

The resolver **composes** — it does not own per-channel rules. Modifier content stays owned by `GameManagerPersistentEffectOps` / path modules / node registry / equipment bag; kit semantics stay owned by `CultivationPathRuntime`; formation semantics by `resolvePartyFormation`; companion entities/kits by `core/companion`. P2 changes **who calls them and when**, not what they decide.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

---

## Global Constraints

- **Zero gameplay change on all reachable flows, with ONE declared correction.** Every resolved output must equal today's assembly on every flow production/tests actually reach: same stats, same kit slots (post-emblem ordering), same entity fields, same buff entries, same companion set, same survive sources. **Declared correction (latent inconsistency, unreachable today):** `beginBattleCycleCommitted` resolves stats/entity from `request.player` (ops:1666-1678) while `buildTurnBattle` resolves formation/kit/companions from `deps.getActivePlayer()` (ops:1970-1975) — a `request.player !== activePlayer` call would produce a mixed-source battle today. P2 canonicalizes: **the player-side build resolves entirely from `request.player`** (all production callers pass the active player — `startBattleWithPlayer`/`startStage`/`restartTurnBattleCycle`). For the raw-entity path (`request.playerEntity`, no `request.player`), the build resolves from `deps.getActivePlayer()` — today's party/kit source for devtools battles is preserved. Characterization tests pin both modes plus `activePlayer` absent.
- **Entity-scoped outputs bind to the ACTUAL primary entity.** `resolveCombatBuild` takes an optional `primaryEntityOverride` (the raw `request.playerEntity`). `build.entity` = the override when present (untouched: stats/skillLevels are the caller's), else the resolver-minted entity. All entity-scoped declarations — `entryBuffs` source/target ids, the maxThe write, kit application — bind to `build.entity.id`, never a literal `'player'`. maxThe precedence is exact and per-path: **minted** `entity.maxThe = specialUltimate?.maxThe ?? resolveMaxThe(source)` (today's ops:1678 + adapter stamp); **raw override** `entity.maxThe = specialUltimate?.maxThe ?? override.maxThe` — NO `resolveMaxThe` fallback (today's raw path never calls it; the adapter stamp was the only write).
- **P1 capability layer is the path authority.** The build reads `resolvePathCapabilities` / `getActiveWayDefinition` for identity and the aura declaration; it never re-derives path identity.
- **ARCH-002 static/live partition is preserved.** `getBattleBaseModifiers` (static) feeds the resolved base; the live partition still reaches `entity.stats` per-tick through the provider — the build carries the *binding*, never folds live values into `stats`.
- **Determinism.** `resolveCombatBuild(source, runtime, deps)` is a pure function of its arguments: no `Math.random`, no `Date.now`, no Phaser, no store reads. Registry reads (`getProgressionNodes`, companion defs) are snapshotted AT resolve time; session-scoped inputs (cycle RNG, battle-local buff authority, participant references) arrive through bound factories/thunks on the build — never re-read from deps after resolve returns. **One sanctioned output write:** the resolved entity's `maxThe` — the minted entity is resolver-created (no aliasing), and writing `maxThe` on the raw `primaryEntityOverride` replicates the in-place stamp `TurnBattleAdapter:84-86` already performs on that object today. All other inputs are read-only; no other field of `source`, `deps`, or the override is mutated.
- **One write per field — settled contract.** `entity.maxThe` today has two writers (`resolveMaxThe` at ops:1678 — player path only; `resolveSpecialUltimate().maxThe` stamped in `TurnBattleAdapter:84-86` — fires on BOTH paths when the runtime carries it). The build resolves it once at resolve time, per-path per the entity-binding bullet above: minted `specialUltimate?.maxThe ?? resolveMaxThe(source)`; raw override `specialUltimate?.maxThe ?? override.maxThe`. `ResolvedCombatKit` does NOT carry `maxThe` (consumed into `entity`); ops passes the adapter `{special, ultimate, reactivePayloads}` WITHOUT `maxThe` on every path, so `TurnBattleAdapter:84-86` is dead code afterward — the field stays in the adapter signature for compatibility (shared surface, not removed), with a parity test asserting the single-write result.
- **Override seam preserved.** `setPathRuntimeResolver` (ops:1022-1030, public via `GameManager:963`; exercised by `GameManager.stageLease.test.ts` ×5 and `CultivationPathRuntime.test.ts:102`) swaps runtime resolution for tests. The build resolver must NOT capture `deps.resolvePathRuntime` internally — `resolveCombatBuild` takes the already-resolved `runtime: CultivationPathRuntime` as a parameter, supplied by ops' override-aware `this.resolvePathRuntime(player)`. The dormant revive seam resolves through the same method. One resolution point, override intact.
- **Player-backed lifecycle gates stay on `request.player`.** The survive/talent session and loot receiver run today only when `request.player` exists (ops `:1754` `const player = request.player ?? null` → `if (player)`). The raw-entity path has NO survive wiring — the ops keeps that exact gate (`if (request.player)`) and consumes `build.survive` inside it (buildSource === request.player there, so the plan is the right player's). A raw battle must not gain survive sources just because an activePlayer exists.
- **Live-modifier provider keeps its literal gate + live read.** Today's closure (ops:232-240) returns live modifiers only for `entity.id === 'player'` AND reads `deps.getActivePlayer()` at each refresh — NOT the build's source. `build.liveModifiers` must replicate exactly: `(entity) => entity.id === 'player' && deps.getActivePlayer() !== undefined ? deps.getLiveBattleModifiers(deps.getActivePlayer()!) : []` — a raw entity with a non-'player' id receives `[]` as today, and the modifiers follow the LIVE active player (the provider is a runtime channel; live reads are its contract). `CombatBuildDeps` therefore carries `getActivePlayer`.
- **Emblem ordering preserved.** Kit-clone `grantsBuffsAtBuild` buffs are collected from the *effective* (post-emblem-override) slots, matching today's read of `participant.special`/`participant.ultimate` after emblem replacement.
- **Retained seams (explicit non-goals):** the `startBattle(playerEntity, enemy)` raw-entity path keeps its own entity (stats/skillLevels as supplied — never re-resolved) while its party/kit/entry-buff declarations resolve from `deps.getActivePlayer()` via the build (entity-override binding above); `regrantAuraOnSourceRevived` dormant revive seam keeps re-evaluating the live capability against the *current* player (revive-time semantics, not entry snapshot); `resolveAmbientPlayerStats` / store `finalStats` menu mirror unchanged; `buildPlayerRewardReceiver`, `seedPassiveCarry`/`bankPassiveCarry`, `surviveLethalGuard` mechanics, enemy/wave assembly all stay in ops.
- **P3 verification:** `quick` = `npm run type-check` + `npx vitest run <scope>`; `full` (`npm run verify`) mandatory for M4 (battle-entry surface) and M5.
- **P13/P14:** M4 touches battle-build wiring → run `tests/e2e/cultivation-path-ritual.spec.ts` (7-scenario matrix, currently green incl. P1's provider/aura assertions) inside this worktree.
- **P4/P5:** adversarial QA + sequential multi-pass review per AGENTS.md.
- **P7:** commits need explicit user authorization — commit steps describe granularity only.
- Comments in `.ts`/`.vue` are ASCII-only (ratchet test `tests/architecture/asciiComments.test.ts`).

---

## §0. Verified Current-State Baseline (branch `p1-canonical-path-authority`, post-P1)

Player-side build assembly today — every seam `GameManagerTurnBattleOps` recombines:

| Input | Current call site | Owner of the rule |
|---|---|---|
| Static stat modifiers | `deps.resolvePlayerStats` → `resolvePlayerFinalStats(player, effectOps.getBattleBaseModifiers(player))` — `GameManager.ts:769-770` | `GameManagerPersistentEffectOps.getBattleBaseModifiers` (`:109-117`) — technique tier, cultivation path, route, node levels, technique combat mods |
| Way-facet stat emissions | inside `resolvePlayerFinalStats` — `Player.ts:444-447` | `collectActiveWayStatModifiers` (way stat facet, `CultivationPathSystem.ts`) |
| Persisted modifier bag | `player.modifiers` (equipment via `setEquipmentModifiers` sourceType-filtered, meridian `bat-mach:*`, body `luyen-the:*`, realm passives, tribulation, pill permanents) | per-domain writers; attribution on `StatModifier.sourceType` |
| Live modifiers (per-tick) | `liveStatModifiers` closure — ops `:232-239` → `getLiveBattleModifiers` (persistent buffs + scaled passives + timed effects) | `GameManagerPersistentEffectOps` |
| Combat entity | `playerToCombatEntity(player, stats, getSkillLevels())` — ops `:1669-1673`; `skillLevels` from `skillManager` (`GameManager.ts:763`) | `core/player/Player.ts` |
| `entity.maxThe` | `resolvePathRuntime(player).resolveMaxThe(player)` — ops `:1678`; then `resolveSpecialUltimate().maxThe` re-stamps — `TurnBattleAdapter.ts:84-86` | `CultivationPathRuntime` (two write channels — P2 unifies) |
| Kit (basic/special/ult/reactive/domains) | `pathRuntime.resolveBasic/resolveSpecialUltimate/resolveStatDomains` — ops `:1988-1994` | `resolveCultivationPathRuntime` — `CultivationPathRegistry.ts:547` |
| Dynamic basic (Kiem Pho / Ngu Kiem Dao) | `pathRuntime.buildDynamicBasic(player, nodes, rng)` — ops `:2003-2010` | runtime; rng = cycle session stream |
| Emblem slots (Ngu) | `pathRuntime.emblemSlots()` — ops `:2014-2020` (post-kit override) | runtime |
| Formation | `resolvePartyFormation(playerPath)` — ops `:1975`; player slot → row/x `:1979-1982` | `core/game/FormationPlacement.ts` |
| Companions | `playerPath.companions` + `COMPANIONS` + `resolveCompanionSkillKit` + `companionToCombatEntity` — ops `:2025-2048` | `core/companion` |
| Entry buffs | `applyEntryBuffs` — ops `:1305-1374`: Tran Phap formation buff (`TRAN_PHAP_FORMATIONS` × `formationLoadout`), `van_phap_than_hoa` aura (`grantsElementalReactionAura` → P1 capability `phap_tu.reaction_aura`), kit-clone `grantsBuffsAtBuild` (post-emblem slots) | ops collects declarations; `applyBuildBuffs` applies |
| Survive-lethal | `surviveLethalGuard.beginBattle(player.selectedTalentIds)` + `pathRuntime.buildSurviveSources(player, participant, hasActiveBuff)` — ops `:1772-1867` | `CombatSystem`/`surviveLethalGuard` + runtime |
| PathRuntime resolution | `resolvePathRuntime(player)` called **4×** per entry — ops `:1678`, `:1986`, `:1349`, `:1781` | `resolveCultivationPathRuntime` |

**Ordering contract (must be preserved):** `resetPassiveStacks()` → resolve stats/entity → `buildTurnBattle` → `mintCycleScheduler` (registers kit-clone defs into battle-local registry) → `applyEntryBuffs` → `refreshEffectiveStats` → `seedPassiveCarry` → `refreshEffectiveStats`. Resets run **before** resolution so stale stacks never bake into the base.

**Consumers of the build:** `beginBattleCycleCommitted` + `buildTurnBattle` + `applyEntryBuffs` + the survive-session block — all inside `GameManagerTurnBattleOps.ts`. Tribulation reads ambient stats only (no entity assembly — not a consumer). The store `finalStats` getter is the menu mirror (not a consumer).

---

## Mission P2-M0 — Composition inventory (read-only, confirmatory)

**Files:**
- Create: `game/docs/architecture/2026-09-21-build-composition-inventory.md`

The §0 table is pre-verified; M0 confirms it and locks the modifier-channel vocabulary.

- [ ] **Step 1 — Lock baseline:** record `git rev-parse HEAD` + `git status` (P1 uncommitted state is the baseline — this plan stacks on it). Confirm the seams listed in §0 still match source (ops line numbers may drift — record actuals).
- [ ] **Step 2 — Modifier channel census:** enumerate every `StatModifier[]` source reaching `resolvePlayerFinalStats` on the battle path and the store path. Output: channel table `{channel id, owner, partition static|live, sourceType values}` — this becomes the `BuildModifierChannel.channel` vocabulary. Channels (expected): `player_bag` (persisted `player.modifiers`), `technique_tier`, `cultivation_path`, `phap_tu_route`, `node_levels`, `technique_combat`, `way_facet`; live: `live_battle`.
- [ ] **Step 3 — Assembly-input census:** every read `buildTurnBattle`/`beginBattleCycleCommitted`/`applyEntryBuffs` performs on player/registries that is NOT a stat modifier (skillLevels, formation, companions, kit methods, entry buffs, survive inputs). Record which become build fields vs bound factories vs retained ops seams.
- [ ] **Step 4 — Parity-risk list:** the order-sensitive details — emblem-override before kit-clone collection, maxThe precedence (`resolveSpecialUltimate().maxThe` wins over `resolveMaxThe`), `resolveTheTuKit/AnKit` evaluated once per resolve-method today (kit built twice per entry: resolveBasic + resolveSpecialUltimate — build may cache the kit per resolution; verify observable equality), companion skip rules (missing definition OR missing formation slot → dropped silently).

---

## Mission P2-M1 — `ResolvedCombatBuild` contract + stat assembly with attribution

**Files:**
- Create: `game/src/core/game/CombatBuild.ts` — contract types + `resolveCombatBuild` skeleton
- Modify: `game/src/core/player/Player.ts` — extract `resolvePlayerStatAssembly`
- Modify: `game/src/core/game/GameManagerPersistentEffectOps.ts` — `getBattleBaseChannels`
- Test: `game/src/core/game/CombatBuild.test.ts`

**Interfaces:**
- Consumes: `resolvePlayerFinalStats` (existing formula owner), `getBattleBaseModifiers` channel contents, `resolvePathCapabilities`, `getActiveWayDefinition` (P1).
- Produces (all missions rely on):

```ts
// core/game/CombatBuild.ts
export type BuildStatChannel =
  | 'player_bag'        // persisted player.modifiers (equipment/realm/meridian/body/tribulation/pill — attribution via StatModifier.sourceType)
  | 'technique_tier'    // equipped technique tier effects (domain-gated MP family preserved)
  | 'cultivation_path'  // getCultivationPathStatModifiers
  | 'phap_tu_route'     // getRouteStatModifiers
  | 'node_levels'       // aggregateNodeStatModifiers (ngo_dao + all node trees)
  | 'technique_combat'  // equipped technique combatModifiers
  | 'way_facet'         // collectActiveWayStatModifiers emissions

export interface ResolvedModifierChannel {
  readonly channel: BuildStatChannel
  readonly partition: 'static'
  readonly modifiers: readonly StatModifier[]
}

export interface ResolvedCombatKit {
  readonly basic: TurnSkillDefinition
  readonly special?: TurnSkillDefinition
  readonly ultimate?: TurnSkillDefinition
  readonly reactivePayloads?: Record<string, TurnSkillDefinition>
  /** NO maxThe here — the build consumed it into entity.maxThe (single write). */
  readonly statDomains?: readonly StatDomain[]
  readonly emblem?: { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition }
  /**
   * Session-scoped: ops mints the provider with the cycle RNG stream.
   * Closes over the node snapshot taken at resolve time — the ONLY
   * post-resolution input is rng; no registry read may occur inside.
   */
  readonly buildDynamicBasic?: (rng: () => number) => DynamicBasicProvider | undefined
}

export interface ResolvedCompanionBuild {
  readonly instance: CompanionInstance
  readonly definition: CompanionDefinition
  readonly entity: CombatEntity            // row/column already applied from formation slot
  readonly basic: TurnSkillDefinition
  readonly special?: TurnSkillDefinition
  readonly ultimate?: TurnSkillDefinition
  /** Companion kit-clone build-buffs — same effective-slot collection as the player kit (ops:1361-1371 covers ALL players today). */
  readonly kitCloneBuffs: readonly ResolvedEntryBuff[]
}

export interface ResolvedEntryBuff {
  readonly definitionId: string
  readonly sourceId: string
  readonly targetId: string
}

export interface ResolvedCombatBuild {
  /** Committed pair via catalog resolution — undefined = mortal/fail-closed. */
  readonly identity: { path: CultivationPathId; way: PathWayId } | undefined
  readonly capabilities: ReadonlySet<PathCapability>
  /** undefined when no player source exists (raw-entity path) — ops supplies the entity. */
  readonly stats: Stats | undefined
  readonly modifierChannels: readonly ResolvedModifierChannel[]
  /**
   * The primary battle entity (players[0].entity): the minted entity when a
   * player source exists, the caller's `primaryEntityOverride` untouched on
   * the raw-entity path, undefined only when neither exists (ops throws).
   */
  readonly entity: CombatEntity | undefined
  readonly kit: ResolvedCombatKit
  readonly formation: readonly PartyFormationSlot[]
  readonly companions: readonly ResolvedCompanionBuild[]
  readonly entryBuffs: readonly ResolvedEntryBuff[]
  readonly survive: {
    readonly talentIds: readonly string[]
    readonly extraSources?: (
      participant: TurnBattleParticipant,
      hasActiveBuff: (definitionId: BuffDefinitionId) => boolean,
    ) => SurviveLethalSource[]
  }
  /**
   * ARCH-002 live partition binding — engine calls per refresh. Literal
   * `entity.id === 'player'` gate + LIVE getActivePlayer() read (today's
   * closure semantics at ops:232-240 — a raw-entity battle receives []).
   */
  readonly liveModifiers: (entity: CombatEntity) => StatModifier[]
}
```

- [ ] **Step 1 — Stat assembly extraction (TDD red):** test that `resolvePlayerStatAssembly(player, external)` returns `{stats, wayFacetModifiers}` where `stats` equals today's `resolvePlayerFinalStats` output and `wayFacetModifiers` equals `collectActiveWayStatModifiers(player, resolveAttributeTotals(...))`. Then refactor `Player.ts`: `resolvePlayerStatAssembly` owns the body; `resolvePlayerFinalStats` delegates (`= resolvePlayerStatAssembly(...).stats`). One formula owner — no parallel derivation.
- [ ] **Step 2 — Channel aggregation:** `GameManagerPersistentEffectOps.getBattleBaseChannels(player): readonly {channel, modifiers}[]` returns the same five calls as `getBattleBaseModifiers` but named; `getBattleBaseModifiers` delegates (flatten channels) so the menu/test path is unchanged. Test: flattened channels === today's flat list, same order.
- [ ] **Step 3 — Build skeleton:** `resolveCombatBuild(source, runtime, deps, primaryEntityOverride?)` — with `source` present resolves `identity` (catalog pair or undefined), `capabilities` (`deps.resolveCapabilities`), `stats` + `modifierChannels` (`player_bag` + battle-base channels + `way_facet`), `entity` (`primaryEntityOverride ?? playerToCombatEntity(source, stats, deps.getSkillLevels())` + maxThe per the entity-binding rule), `formation` (`resolvePartyFormation`). `source === undefined` → the minimal build: `entity = primaryEntityOverride` when supplied (untouched — no stats re-resolution; today's raw path does exactly this at ops:1679-1681), `undefined` ONLY when both are absent; `identity/capabilities/stats` empty-or-undefined, `kit = {basic: GENERIC_PHYSICAL_BASIC}`, `formation = DEFAULT_PARTY_FORMATION`, `companions/entryBuffs = []`, `survive.talentIds = []` — identical to today's `playerPath === undefined` assembly branch. Kit/companions/entryBuffs land in M2/M3. `liveModifiers` binds `(entity) => entity.id === 'player' && deps.getActivePlayer() !== undefined ? deps.getLiveBattleModifiers(deps.getActivePlayer()!) : []` — the literal-id gate + live activePlayer read, identical to ops:232-240 (a raw entity id gets `[]`).
- [ ] **Step 4 — Verify:** `npm run type-check` + `npx vitest run src/core/game/CombatBuild.test.ts src/core/player/ src/core/game/GameManager.statRefresh.test.ts`.

Deps contract (GameManager binds in M4 — declared now so tests mock it). The path **runtime is a parameter, not a dep** — ops resolves it through the override-aware `this.resolvePathRuntime(player)` (`setPathRuntimeResolver` seam preserved; the same method serves the dormant revive seam):

```ts
export interface CombatBuildDeps {
  getBattleBaseChannels(player: PlayerData): readonly ResolvedModifierChannel[]
  resolveCapabilities(player: PlayerData): ReadonlySet<PathCapability>
  getSkillLevels(): Record<string, number>
  getProgressionNodes(): readonly ProgressionNode[]   // called ONCE at resolve — snapshot
  getCompanionDefinition(id: string): CompanionDefinition | undefined
  getLiveBattleModifiers(player: PlayerData): StatModifier[]
  /** Live read inside the provider closure — mirrors ops' getActivePlayer seam. */
  getActivePlayer(): PlayerData | undefined
}

// signature — runtime arrives resolved (ops' override-aware method); the
// resolver never dispatches itself. `source === undefined` returns the
// no-player minimal build: {identity/capabilities/stats: undefined-or-empty,
// entity: primaryEntityOverride /* present */ | undefined /* both absent */,
// kit: {basic: GENERIC_PHYSICAL_BASIC}, formation: DEFAULT_PARTY_FORMATION,
// companions/entryBuffs: [], survive.talentIds: []} — identical output to
// today's undefined-playerPath assembly branch, where the raw entity keeps
// its own stats/skillLevels/maxThe. liveModifiers is the SAME canonical
// provider on every path (literal entity.id === 'player' gate + live
// getActivePlayer read) — never a stub.
// `primaryEntityOverride` = the raw request.playerEntity: entity-scoped
// outputs (entryBuffs ids, maxThe, kit target) bind to ITS id, and it is
// returned as build.entity unmodified except the maxThe rule.
export function resolveCombatBuild(
  source: PlayerData | undefined,
  runtime: CultivationPathRuntime | undefined,
  deps: CombatBuildDeps,
  primaryEntityOverride?: CombatEntity,
): ResolvedCombatBuild
```

---

## Mission P2-M2 — Kit composition

**Files:**
- Modify: `game/src/core/game/CombatBuild.ts`
- Test: `game/src/core/game/CombatBuild.test.ts`

- [ ] **Step 1 — Kit resolution (TDD):** `runtime` arrives as the parameter (override-aware — see Global Constraints). `const nodes = deps.getProgressionNodes()` is snapshotted at resolve time; `kit = {basic: runtime.resolveBasic(player), ...spread(resolveSpecialUltimate minus maxThe), statDomains: resolveStatDomains(player), emblem: runtime.emblemSlots?.(), buildDynamicBasic: runtime.buildDynamicBasic ? (rng) => runtime.buildDynamicBasic!(player, nodes, rng) : undefined}` — the thunk closes over the `nodes` snapshot; no registry read after resolution. `entity.maxThe` — the single write, per-path: minted entity `specialUltimate?.maxThe ?? runtime.resolveMaxThe(source)`; raw override `specialUltimate?.maxThe ?? primaryEntityOverride.maxThe` (NO `resolveMaxThe` on the raw path — today it never runs there). The adapter never sees `maxThe` on the build path.
- [ ] **Step 2 — Kit-clone entry buffs:** collect `grantsBuffsAtBuild` from the EFFECTIVE slots (basic + `emblem.special ?? kit.special` + `emblem.ultimate ?? kit.ultimate`) into `entryBuffs` as `{definitionId: clone.id, sourceId: entity.id, targetId: entity.id}` — replicates the post-emblem read in `applyEntryBuffs`/`collectKitCloneBuffs`.
- [ ] **Step 3 — Verify:** kit equality tests per way fixture (kiem hien/ngu, phap ngu_hanh/ngo_dao, the_tu hien/ung_the, mortal) — assert `build.kit` fields equal the runtime methods' outputs; assert maxThe precedence per-path (minted: ung_the kit cap wins, else `resolveMaxThe`; raw override: `specialUltimate?.maxThe ?? override.maxThe`, with a `resolveMaxThe` spy asserting it is NEVER called on the raw path); assert `build.entity.maxThe` is the ONLY write (adapter receives a payload without `maxThe` — the stamp at `TurnBattleAdapter:84-86` cannot fire); assert `buildDynamicBasic` reads no registry post-resolution (resolve, then mutate a fake `getProgressionNodes` dep → provider mint still sees the snapshot).

---

## Mission P2-M3 — Formation, companions, entry buffs, survive plan

**Files:**
- Modify: `game/src/core/game/CombatBuild.ts`
- Test: `game/src/core/game/CombatBuild.test.ts`

- [ ] **Step 1 — Companions (TDD):** replicate ops `:2025-2048` exactly — per `player.companions` instance: `definition = deps.getCompanionDefinition(instance.definitionId)`; `slot = formation.find(combatantId)`; skip silently if either missing; `entity = companionToCombatEntity(instance, definition)` + `row/x` from slot; `kit = resolveCompanionSkillKit(definition, instance)` → `{basic, special, ultimate}`. Collect each companion's `kitCloneBuffs` from its effective slots (same `grantsBuffsAtBuild` scan ops `:1361-1371` runs over every player-side participant — companions included) into `build.entryBuffs`.
- [ ] **Step 2 — Formation buff declaration:** if `player.formationLoadout` resolves a `TRAN_PHAP_FORMATIONS` entry with a `buff.definitionId`, emit one `entryBuffs` entry per allied entity (player + companions): `{definitionId, sourceId: entity.id, targetId: entity.id}`. The unknown-buff-id graceful-skip (`registry.tryGet` check, ops `:1328`) STAYS in ops — registry membership is a battle-local read, not build state.
- [ ] **Step 3 — Aura declaration:** `capabilities.has('phap_tu.reaction_aura')` → one entry per LIVING allied entity `{definitionId: VAN_PHAP_THAN_HOA_ID, sourceId: playerEntity.id, targetId: ally.entity.id}`. (P1 capability = the runtime flag's source; identical condition.)
- [ ] **Step 4 — Survive plan:** `survive = {talentIds: player.selectedTalentIds, extraSources: runtime.buildSurviveSources ? (participant, hasActiveBuff) => runtime.buildSurviveSources!(player, participant, hasActiveBuff) : undefined}` — battle-scoped args stay bound-at-call, never resolved eagerly.
- [ ] **Step 5 — Verify:** type-check + build tests incl. determinism (two `resolveCombatBuild` calls → deep-equal data fields; function members excluded), fail-closed pair (corrupt way → `identity: undefined` + mortal-runtime kit), companion skip cases.

---

## Mission P2-M4 — Battle entry consumes the build

**Files:**
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts` — `buildTurnBattle`, `beginBattleCycleCommitted`, `applyEntryBuffs`, deps
- Modify: `game/src/core/game/GameManager.ts` — bind `resolveCombatBuild` deps (replaces `resolvePlayerStats`/`getSkillLevels`/`resolvePathRuntime`/`getProgressionNodes` for the player-side path)
- Test: existing battle-entry suites must stay green unchanged

- [ ] **Step 1 — Player-source canonicalization (TDD characterization first):** pin today's source rules before touching code — (a) `request.player` present → stats/entity AND party/kit resolve from `request.player` (the declared correction: today's mixed-source divergence `request.player !== activePlayer` is unreachable in production; test asserts the unified result, not the old mix); (b) `request.playerEntity` only → the raw entity is the primary (`primaryEntityOverride`), party/kit resolve from `deps.getActivePlayer()` when present, else the no-player minimal build (default formation, generic basic, no companions — today's `playerPath === undefined` branch) — **entryBuffs/kit/maxThe bind to the raw entity's id** (raw-path test: non-`'player'` entity id + active path emitting maxThe/entry buffs → declarations target the raw id, kit applies, `entity.maxThe = specialUltimate?.maxThe ?? override.maxThe`); (c) neither → throw stays.
- [ ] **Step 2 — Ops rewiring:** `beginBattleCycleCommitted` resolves `const buildSource = request.player ?? this.deps.getActivePlayer()` then `const build = deps.resolveCombatBuild(buildSource, buildSource ? this.resolvePathRuntime(buildSource) : undefined, request.playerEntity)` — runtime via the OVERRIDE-AWARE `this.resolvePathRuntime` (`setPathRuntimeResolver` intact — stageLease/CultivationPathRuntime tests green unchanged); `request.playerEntity` is passed as `primaryEntityOverride` so buff ids/maxThe/kit bind to the real entity. `playerEntity = build.entity` (the override or the minted one); the `!playerEntity` throw is preserved (`:1683-1688`). Store `this.activeBuild = build` for the cycle; clear it in `clearCycleEntryState` + `discardFailedCycle`.
- [ ] **Step 3 — `buildTurnBattle(build, enemyEntities)`:** player slot from `build.formation` written onto `build.entity` (the actual primary — minted or raw override); participant from `build.entity` + `build.kit` — adapter receives `{special, ultimate, reactivePayloads}` WITHOUT `maxThe` on every path; `dynamicBasic` via `build.kit.buildDynamicBasic?.(() => cycleRng.roll())`; emblem overrides from `build.kit.emblem`; companions from `build.companions` (entity + kit → participant, `index + 100` priority preserved). No `resolvePartyFormation`/`COMPANIONS`/`companionToCombatEntity`/`resolveCompanionSkillKit` calls remain in ops; `resolvePathRuntime` remains ONLY for the dormant revive seam.
- [ ] **Step 4 — `applyEntryBuffs`:** consumes `activeBuild.entryBuffs` — keeps only the `registry.tryGet` graceful-skip + `applyBuildBuffs` call. The aura `alive` filter is folded into the declaration (M3 resolves per-living-ally; `companionToCombatEntity` mints `alive: true` — assert it).
- [ ] **Step 5 — Survive + live provider:** the survive block keeps its `if (request.player)` gate (ops `:1759`) — inside it, `surviveLethalGuard.beginBattle(build.survive.talentIds)` and `extraSources = build.survive.extraSources?.(playerParticipant, hasActiveBuff)`; a raw battle gains NO survive wiring even when an activePlayer exists. `TurnBattleSystem` construction passes `build.liveModifiers` (replacing the ops closure `:232-240`; the provider keeps the literal `'player'` gate + live `getActivePlayer` read). `resolvePathRuntime` dep usage drops to the dormant revive seam only — record in ledger.
- [ ] **Step 6 — Verify:** `npm run type-check` + `npx vitest run src/core/game/` + full ritual E2E (`tests/e2e/cultivation-path-ritual.spec.ts`, worktree dev server, actual printed port). Then `npm run verify`.

---

## Mission P2-M5 — Boundary guard, determinism contract, docs

**Files:**
- Create/Modify: `game/tests/architecture/buildCompositionBoundary.test.ts` (new guard)
- Modify: `game/docs/systems/cultivation-paths.md` or new `game/docs/systems/combat-build.md`
- Modify: `game/docs/architecture/2026-09-21-build-composition-inventory.md` (final channel map)
- Modify: `AGENTS.md` A13 bullet if the constitution references need the build layer

- [x] **Step 1 — Boundary guard:** scan `GameManagerTurnBattleOps.ts` — ban direct imports/calls of `resolveCultivationPathRuntime` (except the documented dormant revive seam — allowlist the method, not the file), `resolvePartyFormation`, `COMPANIONS`, `companionToCombatEntity`, `resolveCompanionSkillKit`, `TRAN_PHAP_FORMATIONS`, `aggregateNodeStatModifiers`, `resolvePlayerFinalStats`, `playerToCombatEntity`. Prove red→green with a synthetic violation file, then delete it.
- [x] **Step 2 — Determinism + attribution contract tests:** identical `(player, deps)` → identical `stats`/`modifierChannels`/`kit`/`formation`/`companions`/`entryBuffs` (deep-equal; function members excluded). Every `ResolvedModifierChannel.modifiers[*]` retains `id`/`sourceId`/`sourceType` (attribution — spec exit condition). No live-partition modifier may appear in `modifierChannels` (partition integrity).
- [x] **Step 3 — Docs:** systems doc section — the build layer in the authority chain; retained-seam list (raw-entity test path, dormant revive re-grant, passive carry, loot receiver, ambient/menu stats). Update the P2 mission's §0 table into the inventory doc as the maintained channel map.

---

## Ledger (maintained through implementation)

| Rule/state | Current authority | Target authority | Consumers migrated | Retained path + reason |
|---|---|---|---|---|
| Player-side battle assembly | `GameManagerTurnBattleOps` inline | `resolveCombatBuild` | `beginBattleCycleCommitted`, `buildTurnBattle`, `applyEntryBuffs`, survive block | `startBattle(playerEntity)` raw-entity test path — no player source |
| Stat formula | `resolvePlayerFinalStats` | `resolvePlayerStatAssembly` (same function's body — delegation, not duplication) | battle ops, store `finalStats`, `resolveAmbientPlayerStats` | store mirror unchanged |
| Static modifier channels | `getBattleBaseModifiers` (flat) | `getBattleBaseChannels` (named) | build resolver | `getAggregatedModifiers` menu path unchanged |
| `entity.maxThe` | ops:1678 + adapter:84-86 (two writes, same value; raw path gets ONLY the adapter stamp) | `build.entity.maxThe` one write — minted: `specialUltimate?.maxThe ?? resolveMaxThe(source)`; raw override: `specialUltimate?.maxThe ?? override.maxThe` (no resolveMaxThe on raw) | adapter receives `maxThe`-less payload on every path — the stamp is dead code afterward | adapter signature keeps the field (shared surface); parity tests pin both paths |
| Entry buff declarations | `applyEntryBuffs` inline reads | `build.entryBuffs` | `applyEntryBuffs` consumes declarations | `registry.tryGet` skip stays in ops (battle-local registry read); dormant revive seam keeps live capability re-evaluation |
| Kit clone registration | `collectKitCloneBuffs` on participant slots | unchanged mechanism — reads effective slots assembled from build | `mintCycleScheduler` | participant slots still carry the defs (registration needs the battle-local registry) |
| Live modifiers | ops closure `:232-240` (literal `'player'` id gate + live `getActivePlayer` read) | `build.liveModifiers` bound provider — same gate, same live read | `TurnBattleSystem` ctor arg | live partition semantics unchanged (ARCH-002); raw-entity ids still get `[]` |
| Aura entry grant | `grantsElementalReactionAura` flag read in `applyEntryBuffs` | `capabilities.has('phap_tu.reaction_aura')` at build time | `applyEntryBuffs` | `regrantAuraOnSourceRevived` dormant seam — live re-eval retained |
| Survive sources | `resolvePathRuntime(...).buildSurviveSources` in ops, gated on `request.player` | `build.survive.extraSources` bound binder, consumed inside the SAME `if (request.player)` gate | survive-session block | `surviveLethalGuard` mechanics unchanged; raw path gets no survive wiring |

## Risks

- **Ordering regression** — resets must precede resolution; kit-clone registration must precede `applyEntryBuffs`. Mitigation: keep the canonical sequence verbatim; only the read sources change.
- **Kit double-build parity** — `resolveTheTuKit`/`AnKit` run twice today (resolveBasic + resolveSpecialUltimate); resolver may share one resolved kit. Verify observable equality (same defs/content), not reference identity.
- **Emblem ordering** — clone buffs must come from post-emblem slots; a pre-emblem read would resurrect removed kit buffs on the ngu way.
- **`activeBuild` lifecycle** — must clear in `clearCycleEntryState`/`discardFailedCycle` so a failed cycle never exposes a stale build.
- **Scope creep** — enemies, reward receiver, tribulation, menu stats are NOT the build; stay out.
