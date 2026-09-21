# P7 — M5 Plan: Unified BodyProgression Authority

Status: IMPLEMENTATION COMPLETE - gates green (P3 full verify 714/6292, P18 OCR clean, P13/P14 live evidence, P4 QA PASS WITH EVIDENCE, P5 3 passes 0 Medium+; pending external IMPL review)
Spec: `m5-body-progression-authority.spec.md` (SPEC_PASS, v3 - includes the plan-phase errata: meridian currency is a PILL, channel descriptor replaces materialId).
Base: M4 `05eba824` on `feat/p7-progression-consolidation`, worktree `.agent-worktrees/p7-progression-consolidation`.

## Execution notes

- TDD order: failing/ported tests first per task, then implementation, then re-run the touched scope.
- Behavior deltas: NONE by design (ownership migration only). Every formula/gate/threshold is ported verbatim — sequential order, mortal/qi_refining pace gates, talent multiplier `ceil(remaining/mult)`, clamp-to-missing no-overflow, aux gate not consumed, modifier prefixes byte-identical, grade `clamp(completed,1,6)`, Dai Dao thresholds.
- Ordering is load-bearing: `PlayerData.bodyProgression` lands FIRST, additively, in T1 (old flat fields still present — the chapter modules need the field to compile). Chapter modules land T2/T3, registry+system T4, ops+consumers T5 (each consumer's gameplay fixtures migrate IN THE SAME TASK — a test seeding a retired flat field against a re-pointed consumer asserts stale behavior), save v72 T6 (save-literal fixtures gain `bodyProgression` in the same task — the shape validator starts requiring it there), and only then are flat fields + old engines + their direct tests deleted in T7. No task boundary leaves the tree uncompilable.
- Talent-multiplier correction (review): `luyen_the_ky_tai` is RETIRED at catalog v4 — `getBodyRefinementProgressMultiplier` resolves 1 for it (TalentEffects.ts:111-113, empty `body_refinement_progress` effect; TalentEffects.test.ts:114 pins 1). The invest formula keeps the multiplier pipeline verbatim (`needed = ceil(remaining/mult)`) but the pinned behavior is 1 essence = 1 progress — `BodyRefinementSystem.test.ts:63-122` already locks the retired semantics; the ported test asserts THOSE, not a doubling.
- Spec errata folded in (reviewer-visible): `thong_mach_dan` lives in `pillBag` (data/pill/pills.ts:71, `type:'material'` pill — GameManagerPillOps.ts:56-62 rejects it at the drink path; its sink is the meridian chapter). `thien_dia_chi_kieu` is a material (materials.ts:71). The unified invest therefore dispatches through a per-chapter `currency`/`auxCurrency` `{bag:'material'|'pill'; id}` descriptor — both bags share `getAmount(id): number` + `remove(id, amount): boolean` (MaterialBag.ts:87-125,142-150; PillBag.ts:43-68,77-79).
- Meridian invest stays PARKED: `investBodyChapter(player,'meridian')` exists and is op-level tested; no new UI/gateway/caller (spec §4 non-goal).
- New comments ASCII-only (P15); touched stale comments are transliterated per the M4 convention.
- All edits inside the worktree. Local commit only after all gates pass.

## Task 0 — G0/G1 evidence

- Task card: mission-graph M5 + spec v3 §3 scope (registry, chapter-keyed state, unified invest, derived facts, resolver/panel re-points, v72).
- Measured facts (re-verified on `05eba824`):
  - `BodyRefinementSystem.ts` (157 lines): `getTierCap`/`getActiveTierIndex`/`isTierRequiredRealmLevelMet`/`isActiveTierUnlocked`/`investTinhHoa`/`computeBreakthroughGrade` + private `buildTierModifiers`/`applyTierModifiers`; prefix `luyen-the:`; reads `player.bodyRefinementCompletedTiers`/`bodyRefinementCurrentTierProgress`; `TOTAL_TIERS = BODY_REFINEMENT_TIERS.length` (=6).
  - `MeridianSystem.ts` (77 lines): `nextMeridian`/`getOpenedMeridianCount`/`applyMeridianModifiers`/`investThongMachDan(player, availableDan, thienDiaChiKieuOwned=0)`; prefix `bat-mach:`; reads `player.openedMeridianIds`; `[M13 STATUS: PARKED]` header — no production invest caller.
  - `PlayerData` flat fields: `openedMeridianIds` (Player.ts:138), `bodyRefinementCompletedTiers` (:219), `bodyRefinementCurrentTierProgress` (:221); defaults `[]`/`0`/`0` (:386,:399-400).
  - `GameManagerRealmAdvanceOps.investBodyRefinement` (:421-431): `materialBag.getAmount(TINH_HOA)` → `investTinhHoa` → `materialBag.remove`; deps has `materialBag`, NOT `pillBag` (:60) — `pillBag` must be added to the deps object + GameManager ctor wiring.
  - Ritual reads (`RealmAdvanceOps.ts:251-259`): `player.breakthroughGrade = computeBreakthroughGrade(player)`; `mortalPerfectionAchieved = bodyRefinementCompletedTiers >= BODY_REFINEMENT_TIERS.length && all-main-stats-at-cap` — BEFORE `realmId='qi_refining'` write (:261).
  - `GameManager.ts:825`: tickOps dep `investBodyRefinement: (player) => this.realmAdvanceOps.investBodyRefinement(player)`; `GameManagerTickOps.ts:117` calls it every update.
  - `resolveKienCoGrade` (`BreakthroughGrades.ts:34-67`): reads `player.bodyRefinementCompletedTiers` (:38,:41) and `player.openedMeridianIds.length` (:42,:44); `HEAVEN_MERIDIAN_COUNT=6`, `GREAT_DAO_MERIDIAN_COUNT=MERIDIANS.length`(9), `EARTH_BODY_TIERS=3`, `HEAVEN_BODY_TIERS=6`.
  - `LuyenThePanel.vue`: imports `getActiveTierIndex`/`getTierCap`/`isActiveTierUnlocked`/`isTierRequiredRealmLevelMet` from BodyRefinementSystem (:33); reads `player.bodyRefinementCompletedTiers` (:67,:70,:103) + `player.bodyRefinementCurrentTierProgress` (:71) + `BODY_REFINEMENT_TIERS` (:32,:61).
  - `EarlyGameSession.ts:203`: `investRefinement()` wraps `realmAdvanceOps.investBodyRefinement`.
  - `saveShapeValidation.ts`: flat checks at :232-233 (`requireNonNegativeNumber` x2) and :475-479 (`requireArray` + `validateStringEntries` for `openedMeridianIds`); P1-M6 module-dispatch block at :447-449 (`pathModule.validatePersistedState?.(player, issue => issues.push(issue))`) — the body delegation joins this region; `ShapeIssue={path,message}` (:36-40); helpers `isObject`/`isFiniteNumber`/`isNonNegativeFiniteNumber`/`requireArray`.
  - `preflightSaveRegistryReferences` (`GameManagerSaveRestore.ts:108-220`): throw-style hard-fail seam; technique contract :159-199; mortalBasicSkillId :201-219 — body integrity entry joins at the end.
  - `restoreFromSave` (`GameManagerSaveRestore.ts:231-555`): `getActivePlayer` dep exists (:62); composition `restoreGameSession` (SaveSystem.ts:266-300) calls player.restoreFromSave → setActivePlayer → saveOps.restoreFromSave → setEquipmentModifiers — so inside saveOps, `getActivePlayer()` IS the restored player; `lastAppliedPayloadHash` commits at :552 after all slices — body rehydrate runs BEFORE that commit (a rehydrate throw leaves payload uncommitted).
  - `player.modifiers` IS persisted (part of PlayerData → detachSaveValue) — body slices ride in it today; rehydration makes chapter state the only authority (spec §3.7).
  - `restoreGameSession` is THE composition seam (boot + cloud-sync retries both flow through useAppLifecycle → restoreGameSession); saveOps.restoreFromSave is also called directly by tests — rehydrate inside saveOps covers every path.
  - `createDefaultPlayer` (:316-419): required-field literal; `bodyProgression` joins as a required key (no Pinia optional-field trap — always present).
  - `saveVersion.ts:87-93` v71 comment + `CURRENT_SAVE_VERSION=71`; `saveTypes.ts` changelog ends ~v65.
  - `Player.ts` imports: `core/*` value+type imports already dense — `type BodyProgressionState` + `createDefaultBodyProgression` from `core/realm/body/BodyChapter` adds no cycle (chapters only `import type { PlayerData }`; `BodyChapter.ts` imports the concrete chapter consts — one-directional runtime dep).
  - Production readers of the 3 flat fields (complete census): `BodyRefinementSystem`, `MeridianSystem`, `GameManagerRealmAdvanceOps` (:258), `BreakthroughGrades` (:38-44), `LuyenThePanel` (:67-71,:103), `saveShapeValidation` (:232-233,:475-479), `Player.ts` decls. NOTHING else in production.
  - `applyMeridianModifiers`/`getOpenedMeridianCount`/`nextMeridian`: ZERO production callers outside MeridianSystem itself (resolver reads `openedMeridianIds.length` directly).
  - Fixture/test files carrying flat-field writes (grep census): `BodyRefinementSystem.test.ts` (34 hits), `MeridianSystem.test.ts` (28), `useTribulation.dotPha.test.ts` (12), `BreakthroughGrades.test.ts` (12), `TribulationOutcomeService.test.ts` (4), `TribulationOutcomeSettlement.test.ts` (3), `TribulationDirector.test.ts` (:26,:28), `GameManager.dotPha.test.ts` (:35), `GameManager.r5Refinement.reaudit.test.ts` (:17,:21-22,:36), `saveShapeValidation.test.ts` (:1659 it.each entry), `SaveRoundTrip.test.ts` (:81-108), `player.restoreFromSave.test.ts` (:32-33), `player.artifact.test.ts` (:30-31), `player.talentM2.test.ts` (:38-39), `player.legacyGatedModifier.qa.test.ts` (:35-36), `player.aiStrategy.test.ts` (:28-29), `App.wiring.test.ts` (:283-288 comments). Plus any `validSave()`/`baseSave()` helpers (createDefaultPlayer-based — free via the new default).
  - `GameManagerSaveRestore.boundary.test.ts`/`preflight.test.ts`/`onceOnlySettle.test.ts`/`replace.test.ts`, `SaveSystem.*.test.ts`, `useAppLifecycle.test.ts` — createDefaultPlayer-based saves; free via the new field; version-literal assertions migrate with v72.
  - `GameManager.authoredParity.test.ts:257` (pill ids), `EnemyDropSinkInvariant.test.ts` (material ids), `HiddenBeastDrops.test.ts` — unaffected (content ids unchanged).
  - `GameRoot.vue:22,123` + `stores/ui.ts` — panel registration untouched ('luyen_the' stays).

## Task 1 — Contract types + `PlayerData.bodyProgression` (additive) (TDD)

New `src/core/realm/body/` module directory.

`BodyChapter.ts` — contract types + canonical zero-state (no registry/chapter imports yet — registry lands T4):

```ts
export type BodyChapterId = 'body_refinement' | 'meridian'
export interface BodyRefinementChapterState { completedTiers: number; currentTierProgress: number }
export interface MeridianChapterState { openedIds: string[] }
export interface BodyProgressionState { body_refinement: BodyRefinementChapterState; meridian: MeridianChapterState }
export interface BodyChapterCurrency { bag: 'material' | 'pill'; id: string }
export interface BodyProgressionIssue { path: string; message: string }
export interface BodyChapterDefinition {
  readonly id: BodyChapterId
  readonly modifierPrefix: string
  readonly currency: BodyChapterCurrency
  readonly auxCurrency?: BodyChapterCurrency
  invest(player: PlayerData, available: number, auxOwned: number): number
  applyModifiers(player: PlayerData): void
  progress(player: PlayerData): { completed: number; total: number }
  isComplete(player: PlayerData): boolean
  validatePersistedState(slice: unknown, basePath: string, emit: (issue: BodyProgressionIssue) => void): void
  integrityIssues(player: PlayerData): string[]
}
export function createDefaultBodyProgression(): BodyProgressionState  // literal {body_refinement:{completedTiers:0,currentTierProgress:0}, meridian:{openedIds:[]}} - inline literal, zero chapter deps
```

`Player.ts` (same task — the field must exist BEFORE any chapter module can compile):
- `import { createDefaultBodyProgression } from '../realm/body/BodyChapter'` + `import type { BodyProgressionState }`.
- `PlayerData` gains `bodyProgression: BodyProgressionState` (required — no Pinia optional-field trap; ASCII comment).
- `createDefaultPlayer` seeds `bodyProgression: createDefaultBodyProgression()`.
- Flat fields stay (T7 removes). Everything still compiles — nothing reads the new field yet.

Tests — `BodyChapter.test.ts` (red first):
- `createDefaultBodyProgression` returns the canonical zero-state (shape + zero values).
- `createDefaultPlayer()` carries `bodyProgression` with both zero-state slices (guards the seed).

## Task 2 — `BodyRefinementChapter.ts` + ported tests (TDD)

`BodyRefinementChapter.ts` — ports `BodyRefinementSystem` verbatim onto `player.bodyProgression.body_refinement` (compiles because T1 already added the field):

- `export const bodyRefinementChapter: BodyChapterDefinition` — `id:'body_refinement'`, `modifierPrefix:'luyen-the:'`, `currency:{bag:'material', id:TINH_HOA_PHAM_THE_MATERIAL_ID}`, `invest` (verbatim port of `investTinhHoa` minus the internal `applyTierModifiers` call — the SYSTEM owns the rebuild call per spec §3.5), `applyModifiers` (port of `applyTierModifiers`+`buildTierModifiers`), `progress` → `{completed: completedTiers, total: TOTAL_TIERS}`, `isComplete` → `completedTiers >= TOTAL_TIERS`, `validatePersistedState` (slice record; `completedTiers`/`currentTierProgress` each `isNonNegativeFiniteNumber` → emit `{basePath.field, message}`), `integrityIssues` (integer + 0..TOTAL + progress<active cap / `===0` at TOTAL — spec §3.7 pinned set).
- Chapter-specific player-level reads the panel needs (same names as the ported module): `getActiveTierIndex`, `getTierCap`, `isTierRequiredRealmLevelMet`, `isActiveTierUnlocked`, `getRefinementCurrentTierProgress`, `getRefinementCompletedTiers` (explicit chapter-scoped names for the two raw-state reads; the derived trio keeps verbatim names).
- `computeRefinementBreakthroughGrade(player)` — the `clamp(completed,1,TOTAL)` formula (renamed read; `computeBreakthroughGrade` name stays owned by the system export in T4 to keep the ritual call-site vocabulary).

Tests — `BodyRefinementChapter.test.ts` (port `BodyRefinementSystem.test.ts` behavior table onto `player.bodyProgression.body_refinement` fixtures + `bodyRefinementChapter` calls):
- pace gate: mortal `requiredRealmLevel` unmet → `isActiveTierUnlocked` false + `invest` 0; post-mortal bypass → invest works.
- sequential: `completedTiers=2` → `getActiveTierIndex`=2; invest clamps to missing (available 1 → consumed 1, no overflow to next tier).
- retired talent pipeline (REVIEW-PINNED): `luyen_the_ky_tai` resolves multiplier 1 — invest 1 essence → consumed 1 / progress 1; full cap → tier complete; `cap-5` residue + 100 available → consumed 5 no-overflow; the `getBodyRefinementProgressMultiplier` call is preserved verbatim inside `invest` (pipeline intact, no retired-effect resurrection).
- tier-complete transition: progress >= cap → completed+1, progress=0.
- `applyModifiers` emits `luyen-the:<tierId>:<stat>` ids with `percentAtFullTier*ratio` (completed=full, active=linear) and rebuilds idempotently (call twice → same count).
- `progress`/`isComplete`/`getRefinementCompletedTiers`/`getRefinementCurrentTierProgress` reads.
- `validatePersistedState` emits issues for missing/non-record/non-numeric slice members; `integrityIssues` covers integer/0..6/cap/`-at-6-progress-must-be-0`.

Red first: test file written, fails (module absent), then implement.

## Task 3 — `MeridianChapter.ts` + ported tests (TDD)

`MeridianChapter.ts` — ports `MeridianSystem` verbatim onto `player.bodyProgression.meridian` + the PARKED header note:

- `export const meridianChapter: BodyChapterDefinition` — `id:'meridian'`, `modifierPrefix:'bat-mach:'`, `currency:{bag:'pill', id:THONG_MACH_DAN_MATERIAL_ID}`, `auxCurrency:{bag:'material', id:THIEN_DIA_CHI_KIEU_MATERIAL_ID}`, `invest` (verbatim `investThongMachDan` port minus the internal `applyMeridianModifiers` call), `applyModifiers` (verbatim), `progress` → `{completed: openedIds.length, total: MERIDIANS.length}`, `isComplete` → all opened, `validatePersistedState` (slice record; `openedIds` array-of-strings), `integrityIssues` (every id ∈ MERIDIANS ids AND strict prefix of canonical order — spec §3.7).
- Chapter read `getMeridianOpenedCount(player)` (the resolver's read; the generic `getOpenedMeridianCount` name stays on the system in T4).

Tests — `MeridianChapter.test.ts` (port `MeridianSystem.test.ts`):
- sequential order, cost gate (insufficient dan → 0), qi_refining pace gate + post-realm bypass, final meridian `requiresThienDiaChiKieu` aux gate (aux present but NOT consumed), consumed = `thongMachDanCost`, `bat-mach:` modifier rebuild, `progress`/`isComplete`/`getMeridianOpenedCount`, `validatePersistedState`/`integrityIssues` (non-prefix, unknown id).

## Task 4 — Registry + persisted-validation dispatch + `BodyProgressionSystem.ts` (TDD)

Extend `BodyChapter.ts` (imports the two concrete chapter consts — one-directional runtime dep; chapters only `import type` back):

- `export const BODY_CHAPTERS: readonly BodyChapterDefinition[] = [bodyRefinementChapter, meridianChapter]` (iteration order = canonical chapter order).
- `export const BODY_CHAPTER_BY_ID: Readonly<Record<BodyChapterId, BodyChapterDefinition>>`.
- `export function getBodyChapterDefinition(id: BodyChapterId): BodyChapterDefinition` (throw on unknown — the id union already constrains callers, defense-in-depth).
- `export function validateBodyProgressionPersistedState(playerPayload: unknown, emit: (issue: BodyProgressionIssue) => void): void` — `isRecord(player.bodyProgression)` → else emit `player.bodyProgression phải là object`; then `for (const chapter of BODY_CHAPTERS) chapter.validatePersistedState(record[chapter.id], 'player.bodyProgression.'+chapter.id, emit)` (P1-M6 convention: the authority owns its whole slice including the presence check; boundary only delegates). (`createDefaultBodyProgression` already landed in T1 — zero-state lives beside the record type this module owns.)

New `src/core/realm/body/BodyProgressionSystem.ts` — the single authority, stateless module functions (same shape as the leaf systems it replaces):

```ts
export function investBodyChapterState(player, chapterId: BodyChapterId, available: number, auxOwned: number): number {
  const chapter = getBodyChapterDefinition(chapterId)
  const consumed = chapter.invest(player, available, auxOwned)
  if (consumed > 0) chapter.applyModifiers(player)   // pinned exactly-once rebuild (spec §3.5)
  return consumed
}
export function applyAllBodyModifiers(player): void   // rehydrate — every chapter, canonical order
export function getBodyChapterProgress(player, chapterId): { completed: number; total: number }
export function getBodyRefinementCompletedTiers(player): number   // delegates to chapter read
export function getOpenedMeridianCount(player): number            // delegates to chapter read
export function computeBreakthroughGrade(player): number          // delegates to refinement formula
export function assertBodyProgressionIntegrity(player): void      // collects chapter.integrityIssues -> throw Error
```

Tests — `BodyChapter.test.ts` additions + `BodyProgressionSystem.test.ts`:
- registry: `BODY_CHAPTERS` has exactly `['body_refinement','meridian']` in order; `BODY_CHAPTER_BY_ID` resolves both; `getBodyChapterDefinition` returns them.
- `validateBodyProgressionPersistedState`: missing/non-object `bodyProgression` → issue at `player.bodyProgression`; malformed `body_refinement` slice (string members) → issue at `player.bodyProgression.body_refinement.completedTiers`; `openedIds` non-array/non-string-member → issue at `player.bodyProgression.meridian.openedIds[…]`; valid default → no issues.
- `investBodyChapterState` routes by id, returns consumed, and calls applyModifiers exactly-once ONLY on consumed>0 (spy-able: modifier ids present after invest; a gated invest adds none).
- `applyAllBodyModifiers` rebuilds both prefixes from state (seed state, wipe `player.modifiers`, call → prefixes reappear; persisted-stale entries corrected).
- `getBodyChapterProgress`/`getBodyRefinementCompletedTiers`/`getOpenedMeridianCount`/`computeBreakthroughGrade` read chapter state (grade clamp 1..6 incl. 0-tier→1).
- `assertBodyProgressionIntegrity` throws on each spec §3.7 violation (non-integer tiers, progress>=cap, progress!=0 at 6, unknown meridian id, non-prefix openedIds) and passes the default + valid mid states.

## Task 5 — Ops + all production consumer re-points (with their gameplay fixtures)

`GameManagerRealmAdvanceOps.ts`:
- deps: add `pillBag: PillBag` (ctor object + GameManager wiring site).
- `investBodyChapter(player, chapterId: BodyChapterId): number` — currency dispatch: `bagFor(currency)` → `deps.pillBag`/`deps.materialBag` (both satisfy `getAmount`/`remove`); `available = bag.getAmount(currency.id)`; `auxOwned = auxCurrency ? auxBag.getAmount(aux.id) : 0`; `consumed = investBodyChapterState(player, chapterId, available, auxOwned)`; `consumed>0 → bag.remove(currency.id, consumed)`; return consumed.
- `investBodyRefinement` stays until T7 (tick/tests still reference) — implementation delegates to `investBodyChapter(player,'body_refinement')` immediately so both names share one path.
- Ritual: `computeBreakthroughGrade` import → `core/realm/body/BodyProgressionSystem`; `mortalPerfectionAchieved` reads `getBodyRefinementCompletedTiers(player) >= BODY_REFINEMENT_TIERS.length`.

`GameManagerTickOps.ts`: deps member `investBodyRefinement` → `investBodyChapter: (player, chapterId) => number`; call site `this.deps.investBodyChapter(activePlayer, 'body_refinement')`.
`GameManager.ts:825`: re-wire the dep; add `pillBag` to the realmAdvanceOps ctor object.
`BreakthroughGrades.ts`: `resolveKienCoGrade` reads `getBodyRefinementCompletedTiers(player)` + `getOpenedMeridianCount(player)` from `BodyProgressionSystem` (imports replace the two data imports' field usage; `BODY_REFINEMENT_TIERS`/`MERIDIANS` data imports stay for counts).
`LuyenThePanel.vue`: import re-point to `core/realm/body/BodyRefinementChapter` + `getBodyChapterProgress` from `BodyProgressionSystem`; `player.bodyRefinementCompletedTiers` → `chapterProgress.completed`; `player.bodyRefinementCurrentTierProgress` → `getRefinementCurrentTierProgress(player.$state)`; the 4 read calls keep verbatim names. Mechanical only — no template/IA change.
`EarlyGameSession.ts:203`: `investRefinement()` delegates to `investBodyChapter(this.player,'body_refinement')` (session API name kept).

Test updates in this task — EVERY gameplay fixture that drives a re-pointed consumer migrates in the same task (a fixture seeding a retired flat field against a re-pointed consumer asserts stale behavior — review finding). Mechanical mapping: `player.bodyRefinementCompletedTiers = n` → `player.bodyProgression.body_refinement.completedTiers = n`; `player.bodyRefinementCurrentTierProgress` → `…currentTierProgress`; `player.openedMeridianIds = ids` → `player.bodyProgression.meridian.openedIds = ids`. Census (Task 0): `useTribulation.dotPha.test.ts` (12), `BreakthroughGrades.test.ts` (12), `TribulationOutcomeService.test.ts` (4), `TribulationOutcomeSettlement.test.ts` (3), `TribulationDirector.test.ts` (2), `GameManager.dotPha.test.ts` (1), `GameManager.r5Refinement.reaudit.test.ts` (spy → `investBodyChapter` + nested progress reads). Save-literal fixtures (`player.*.test.ts` x5, saveShapeValidation, SaveRoundTrip, boundary/preflight helpers) wait for T6 — the shape validator only starts requiring `bodyProgression` there.
- New focused op test: `investBodyChapter` pill-channel dispatch (seed `pillBag` with thong_mach_dan at qi_refining → meridian opens + dan removed + `bat-mach:` modifier present); material channel (tinh_hoa path unchanged); gated paths return 0 without bag mutation.

## Task 6 — Save contract v72 (with save-boundary fixtures)

- `saveVersion.ts`: v72 comment block + `CURRENT_SAVE_VERSION = 72` (pattern: v71 entry, one paragraph — chapter-keyed `player.bodyProgression` replaces the 3 flat fields; v71 rejected).
- `saveTypes.ts`: changelog line for v72.
- `saveShapeValidation.ts`: delete :232-233 + :475-479 flat checks; add `validateBodyProgressionPersistedState(player, issue => issues.push(issue))` adjacent to the P1-M6 module-dispatch block (~:449) with an ASCII comment.
- `GameManagerSaveRestore.preflightSaveRegistryReferences`: at the end, `assertBodyProgressionIntegrity(save.player)` — throw-style, before any owner mutation.
- `GameManagerSaveRestore.restoreFromSave`: before `lastAppliedPayloadHash = payloadIdentity` (:552), `const bodyPlayer = this.deps.getActivePlayer(); if (bodyPlayer) applyAllBodyModifiers(bodyPlayer)` — chapter-state-authoritative rehydrate.
- Literal v71 rejection test (M2/M4 convention): a v71 payload → `loadGame`/shape → incompatible/corrupted.
- Shape tests: `validSave()`-based — add cases: missing `bodyProgression` → `player.bodyProgression` issue; malformed slices (string `completedTiers`, `openedIds` non-array/member) → chapter paths; update the `'openedMeridianIds'` it.each entry → `player.bodyProgression.meridian.openedIds`.
- Preflight tests (`GameManagerSaveRestore.preflight.test.ts` or boundary): each integrity violation → throws BEFORE owner mutation (reuse the live-bag-untouched assertion pattern).
- Restore-rehydrate test: save carrying correct `bodyProgression` + stale `player.modifiers` (e.g. luyen-the entries removed or wrong percent) → `restoreGameSession`/saveOps restore → `luyen-the:`/`bat-mach:` slices match chapter state.
- Round-trip (`SaveRoundTrip.test.ts`): mid-progress + complete states serialize/restore byte-faithful.
- Save-literal fixtures gain `bodyProgression` in THIS task — the shape validator starts requiring it here: `player.restoreFromSave.test.ts` (:32-33), `player.artifact.test.ts` (:30-31), `player.talentM2.test.ts` (:38-39), `player.legacyGatedModifier.qa.test.ts` (:35-36), `player.aiStrategy.test.ts` (:28-29), `saveShapeValidation.test.ts` (`validSave()`/the `'openedMeridianIds'` it.each entry), `SaveRoundTrip.test.ts` (:88), plus any other hand-built player literal the suite surfaces (grep the 3 retired names at task start).

## Task 7 — Delete flat fields + old engines + residual migration

- `Player.ts`: delete `bodyRefinementCompletedTiers`/`bodyRefinementCurrentTierProgress`/`openedMeridianIds` declarations + their comments; delete the 3 defaults.
- Delete `core/realm/BodyRefinementSystem.ts`, `core/realm/MeridianSystem.ts`, and their `.test.ts` files (logic+tests now live under `body/`).
- `GameManagerRealmAdvanceOps`: delete `investBodyRefinement` (all callers re-pointed in T5).
- Residual migration: gameplay/save fixtures were migrated in T5/T6 — what remains is any stray reference the suite surfaces plus `player.*.test.ts` literals carrying flat members (delete them — flat members in a v72 payload are tolerated unknown keys anyway, but the literals should reflect the canonical shape).
- `App.wiring.test.ts:283-288` comments mention `investBodyRefinement()` — update names (comment-only).
- Stale comment sweep: `data/realm/BodyRefinement.ts`, `data/realm/Meridians.ts`, `data/realm/RealmPassives.ts:22`, `data/materials/materials.ts:23-25`, `data/pill/pills.ts:67` (`MeridianSystem.investThongMachDan` ref), `GameManagerPillOps.ts:58` (`MeridianSystem` ref), `saveVersion.ts:5`/`SaveSystem.ts:98-101`/`saveTypes.ts` (historical entries — LEAVE, they are changelog), `stores/ui.ts:58` (LuyenThePanel mention — still accurate), `LuyenThePanel.vue` header (BodyRefinementSystem refs → body module). Minimal edits; touched comments ASCII-ified.
- Residue census: `rg` the full retired identifier list → zero production hits outside `core/realm/body/` + mission docs.

## Task 8 — Verification + gates

- `npm run type-check` after each task; focused vitest scope after each task.
- Full `npm run verify` (major architecture + save/root-state change → P3 `full` mandatory).
- Residue census clean.
- Then P18 OCR → P13/P14 runtime (Luyen The panel numbers identical pre/post; tick auto-invest live; ritual grade/perfection snapshot live; v72 boot + a restored body-modifier rehydrate spot check) → P4 QA → P5 three passes → external review → commit.
