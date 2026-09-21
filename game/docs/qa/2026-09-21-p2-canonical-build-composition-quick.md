# QA Quick Review — P2 Canonical Build Composition

Date: 2026-09-21 · Mode: quick · Branch: `p1-canonical-path-authority` (P2 work shares the P1 worktree)

## Scope

Task-owned paths (P2 delta only; the P1 surface was QA'd and externally
approved separately):

- `game/src/core/game/CombatBuild.ts` (new — the canonical resolver)
- `game/src/core/game/CombatBuild.test.ts` (new — 23 contract tests)
- `game/src/core/game/GameManager.ts` (deps wiring only)
- `game/src/core/game/GameManagerPersistentEffectOps.ts` (named channels)
- `game/src/core/game/GameManagerTurnBattleOps.ts` (build consumption)
- `game/src/core/player/Player.ts` (`resolvePlayerStatAssembly` extraction)

## Risk map

`changed-risk-map.mjs` returns `deepAuditCandidate: true` (cross-system,
time-and-offline listed via GameManager.ts adjacency) and reports every
P2 path as `unmappedPaths` (the mapper predates CombatBuild.ts).

**Boundedness argument:** this is a composition-boundary refactor — every
rule still lives in its prior owner (Player.ts formulas, effectOps
channels, registry runtime, FormationPlacement, companion resolvers);
the resolver only sequences calls and binds ids. No persistence write,
no clock/offline accrual, no Vue/Phaser lifecycle change. The only
gameplay-visible delta is the documented request.player source
canonicalization. Risk confidently bounded by inspection → quick mode
per the mapper-override clause.

## Invariant ledger

| # | Invariant | Evidence |
|---|-----------|----------|
| 1 | Stats identical to legacy `resolvePlayerStats` | `resolvePlayerStatAssembly` delegates; parity test asserts equality vs `resolvePlayerFinalStats` + manual `calculateStats` |
| 2 | Raw-entity path untouched (devtools/test) | `entity = primaryEntityOverride`; `resolveMaxThe` spy never called on raw path (test) |
| 3 | maxThe single write: ult cap > runtime (minted) / override (raw) | Both branches pinned by tests |
| 4 | Entry-buff order preserved: formation x allies, aura x living allies, kit clones (player then companions) | Order test asserts exact sequence |
| 5 | Registry graceful-skip applies ONLY to save-derived formation id; kit clones/aura still throw on unknown | `gracefulSkip` flag on formation declarations only; ops filter + map restores the plain apply shape |
| 6 | Override seam (`setPathRuntimeResolver`) preserved | ops resolves runtime via `this.resolvePathRuntime` before calling the resolver; stageLease tests green (14/14) |
| 7 | Live-modifier lifetime: literal `entity.id === 'player'` gate + live `getActivePlayer()` per refresh | `bindLiveModifiersProvider` single source; bootstrap + cycle engines share it |
| 8 | Node registry snapshot taken once at resolve; provider never re-reads | Snapshot test mutates the dep post-resolve |
| 9 | Both-supplied precedence: `request.player` mints; `playerEntity` consulted only without it | Explicit `request.player === undefined ? request.playerEntity : undefined` (parity with retired if/else) |
| 10 | `activeBuild` lifecycle: set post-resolve, cleared in `clearCycleEntryState` (covers discard/abandon/repeat entry) | Single write site before use; cleared with all other cycle state |

## Ranked hypotheses and dispositions

- **H1 — aura gate authority change.** Entry gate moved from
  `runtime.grantsElementalReactionAura` (overrideable via
  `setPathRuntimeResolver`) to `capabilities.has('phap_tu.reaction_aura')`
  (player-data + skill membership, not the stub runtime). Divergence
  requires: override installed AND an ngo_dao player with the learned
  passive AND the stub omitting the method. No shipped flow or test
  stub does this (stageLease/runtime stubs are mortal players or throw
  before kit resolution). **Bounded — capability is the sanctioned
  authority per the approved plan; recorded, not a defect.**
- **H2 — companion priority drift.** Skipped companions must not shift
  survivors' priorities. `priority = source-array index + 100` is
  computed inside the flatMap (index counts skipped entries). Parity
  with `index + 100`. **Closed.**
- **H3 — `resolveMaxThe` on undefined runtime.** `runtime?.` write can
  produce `undefined` when source exists without a runtime. Ops always
  passes a runtime when source exists (`buildSource ? resolvePathRuntime
  : undefined`) — unreachable; `entity.maxThe ?? MAX_THE` clamps
  downstream regardless. **Low — recorded.**
- **H4 — post-emblem clone scan parity.** Old code scanned the assembled
  participant slots; the build collects `emblem ?? kit` per slot — the
  same effective set. Test pins emblem-replaces-kit precedence. **Closed.**
- **H5 — repeat-cycle source.** Repeat resolves from
  `playerDataForTurnBattle` (stored player) for ALL inputs vs old split
  (stats from stored, kit/formation from activePlayer). Single-player
  store means identical object; the correction is the documented intent.
  **Closed.**
- **H6 — alive check timing for aura.** Old code checked
  `participant.entity.alive` post-assembly; build checks `ally.alive` at
  resolve. No mutation happens between resolve and apply (synchronous
  assembly); minted entities start alive; a dead raw override still
  fails the same check. **Equivalent — closed.**

## Evidence

- `npm run verify`: type-check ✓, build ✓, 689 files / 6027 tests
  (4 expected-fail) — includes the 23 CombatBuild contract tests.
- `tests/e2e/cultivation-path-ritual.spec.ts`: 7/7 (4.5m) — incl. the
  P1-added combat assertions (kiem hien dynamic provider, ngo_dao aura
  via `getBattleBuffs`) exercising the new build path end-to-end.
- `stageLease` 14/14: throw-in-assembly teardown, repeat-cycle resolver
  failure, survive wiring boom — all preserved through the resolver.
- `battleLifecyclePathBoundary` / `cultivationPathIsolation` guards green.

## Post-review additions (external review round 1)

External review returned CHANGES (2 Medium) — both were missing plan
deliverables, now implemented:

1. `tests/architecture/buildCompositionBoundary.test.ts` — bans
   `resolveCultivationPathRuntime`/`resolvePartyFormation`/`COMPANIONS`/
   `companionToCombatEntity`/`resolveCompanionSkillKit`/
   `TRAN_PHAP_FORMATIONS`/`aggregateNodeStatModifiers`/
   `resolvePlayerFinalStats`/`playerToCombatEntity` in ops. Red→green
   proven via injected violation (removed). The `resolvePathRuntime`
   dep seam (override + dormant revive) stays.
2. Attribution/partition contract tests — every channel modifier
   retains `id`/`sourceId`/`sourceType` over REAL
   `effectOps.getBattleBaseChannels` output; a live sentinel proves
   the live partition never enters `modifierChannels` while still
   flowing through `build.liveModifiers`.
3. M5 Step 3 docs — `docs/systems/combat-build.md` (authority-chain
   position + retained seams) + README index entry.

## Verdict

**PASS WITH EVIDENCE.** No Confirmed or Suspected defects. Seam
differences documented above are either unreachable or the plan-approved
authority migration.
