# P7-M6 — Technique-Gated Node Prerequisites — Plan

Status: draft v1 (pending external PLAN review)
Spec: `m6-technique-gated-nodes.spec.md` (SPEC_PASS v2)
Depends on: M3 committed. Adds NO authored gates.

## Task order (TDD — test first each task)

### T1 — Schema + evaluator + mirror field

**Tests first** — `core/progression/NodeSystem.test.ts`:

- `hasPrerequisite` `{kind:'techniqueRank'; rank}`: passes at/above
  `player.techniqueProgress.rank`, fails below, fails closed when
  `techniqueProgress` is `undefined`. Same matrix for `techniqueGrade`.
- `canPurchaseNode`/`purchaseNode` on a fixture node with a technique
  prereq: rejected below threshold (insight untouched, no nodeLevels
  write), allowed at threshold.
- `revealWhen` carrying a technique kind blocks purchase before reveal.

**Implementation:**

1. `core/progression/ProgressionNode.ts` — add union variants:
   ```ts
   | { kind: 'techniqueRank'; rank: number }
   | { kind: 'techniqueGrade'; grade: number }
   ```
   with ASCII comment (P7-M6, `>=` threshold semantics, mirror source).
2. `core/player/Player.ts` — `PlayerData.techniqueProgress?:
   { rank: number; grade: number }` (read-only mirror comment, ASCII,
   pointing at TechniqueSystem sink); `createDefaultPlayer()` declares
   `techniqueProgress: undefined` beside `mortalBasicSkillId` — load-
   bearing for the restore whitelist + Pinia state shape.
3. `core/progression/NodeSystem.ts` — two `hasPrerequisite` cases:
   `(player.techniqueProgress?.rank ?? 0) >= prerequisite.rank` / grade.

### T2 — Sink + `TechniqueSystem.restore`

**Tests first** — `core/technique/TechniqueSystem.test.ts`:

- `setProgressSink` fires on `grant` with `{rank:0, grade:template.grade}`.
- `gainMastery` fires ONLY when `rankUps > 0` (mastery-only accrual silent).
- `advanceTechniqueGrade` fires `{rank:0, grade:new}`.
- `setTechniqueQuality` does not fire.
- `restore([tech])` fires holder `{rank,grade}`; `restore([])` fires `null`.
- `grant` same-id noop / different-id refuse: no fire.

**Implementation** — `core/technique/TechniqueSystem.ts`:

```ts
private progressSink?: (progress: { rank: number; grade: number } | null) => void
setProgressSink(sink): void { this.progressSink = sink }
private publishProgress() { const t = this.manager.getActive(); this.progressSink?.(t ? {rank:t.rank, grade:t.grade} : null) }
restore(techniques: Technique[]): void { this.manager.restore(techniques); this.publishProgress() }
```

Fire `publishProgress()` after the mutation in `grant` (success path
only), `gainMastery` (when `rankUps > 0`), `advanceTechniqueGrade`
(success). NOT in `setTechniqueQuality`.

### T3 — GameManager wiring + saveOps repoint

**Tests first:**

- `GameManager.techniqueMirror` cases (new describe in the closest
  technique test file — `GameManager.combatTechnique.test.ts` or new
  `GameManager.techniqueProgress.test.ts`): grant via ritual/ops writes
  `player.techniqueProgress`; mastery rank-up republishes; grade
  advance republishes `{rank:0, grade+1}`; `saveOps.restoreFromSave`
  with `techniques:[]` clears the mirror to `undefined`.
- `GameManagerSaveRestore.boundary.test.ts`: persisted
  `player.techniqueProgress` disagreeing with `techniques[0]` is
  overwritten by canonical state after restore.

**Implementation:**

1. `GameManager.ts` constructor (beside `castCountSink`, ~:470):
   ```ts
   this.techniqueSystem.setProgressSink((progress) => {
     if (!this.activePlayer) return
     this.activePlayer.techniqueProgress = progress ?? undefined
   })
   ```
2. `GameManagerSaveRestore.ts` — deps: replace `techniqueManager` with
   `techniqueSystem: TechniqueSystem`; `:300` → `techniqueSystem.restore(
   restoredTechniques)`; update the deps interface + GameManager wiring
   (`techniqueSystem: this.techniqueSystem`); drop the now-unused
   TechniqueManager import if unreferenced.

### T4 — BattleSimulation canonical seam

**Test first** — `core/simulation/BattleSimulation.test.ts`:

`runBattle` exposes neither the cloned player nor the GameManager, and
M6 forbids authored gates — the observable seam is a prototype spy
(plan-review fix):

```ts
const boundPlayers: PlayerData[] = []
const spy = vi.spyOn(GameManager.prototype, 'setActivePlayer')
  .mockImplementation(function (this: GameManager, p: PlayerData) {
    boundPlayers.push(p)
    return original.call(this, p) // call-through
  })
runBattle({ ...build with techniques:[tech] ... })
expect(boundPlayers[0]?.techniqueProgress).toEqual({rank, grade})
```

The captured reference IS the live `activePlayer` — the sink mutates it
in place during `techniqueSystem.restore`, so the assertion reads the
post-restore mirror with no new production hook and no authored gate.

**Implementation** — `core/simulation/BattleSimulation.ts`:

- Move technique restore AFTER `setActivePlayer(player)` and repoint
  `gameManager.techniqueManager.restore` → `gameManager.techniqueSystem.restore`
  (sink needs the bound player; `skillManager.restore` stays put — it
  has no player dependency; the timedEffects strip ordering is
  unchanged).

### T5 — Save shape validation

**Tests first** — `services/save/saveShapeValidation.test.ts`:
absent OK; `undefined` OK; non-object rejected; `rank`/`grade`
non-integer or negative rejected; valid record accepted.

**Implementation** — `saveShapeValidation.ts` beside the
`skillLevels`/`skillCastCounts` block (~:306): optional object with
`rank`/`grade` non-negative integers (use existing `isObject` /
`isNonNegativeFiniteNumber` + integer check consistent with
`completedTiers` validation style). No cross-field consistency check —
restore rehydrates.

### T6 — NodeInspector lock reasons + i18n

**Test first** — new `components/panels/skill-path/NodeInspector.test.ts`
(jsdom; project mount pattern — `createApp`+`h`+`provide`, no
vue/test-utils; real `i18n`; pinia player store; GAME_MANAGER_KEY stub
with `nodeRegistry.get`/`progressionOps.getNextNodeCost`/`skillManager.get`;
STATE_VERSION_KEY/BUMP_STATE_KEY like CombatDefeatPanel.test.ts):

- Mount `NodeInspector` with a fixture node carrying
  `{kind:'techniqueRank'; rank:3}` and a player whose
  `techniqueProgress.rank` is below → rendered reasons contain the
  dedicated technique-rank string (not the `skillUpgrade` fallback).
- Same for `techniqueGrade`.
- A satisfied technique gate contributes no reason.

**Implementation:**

- `NodeInspector.vue` `lockedReasons`: explicit branches for
  `techniqueRank`/`techniqueGrade` before the fallback.
- `locales/en.json` + `vi.json`:
  `panels.skillPath.nodeInspector.lockedReasons.techniqueRank`
  ("Requires technique rank {rank}") and `.techniqueGrade`
  ("Requires technique grade {grade}") + vi equivalents.

### T7 — No-authored-gates invariant

**Test** — `GameManager.deadIds.test.ts`: for every authored node
registry (PHAP_TU_NODES, PHAP_TU_AN_NODES, KIEM_TU_NODES, THE_TU_NODES,
THE_TU_AN_NODES) assert no `prerequisites`/`revealWhen` entry has
`kind:'techniqueRank'|'techniqueGrade'` (pins mission constraint).

## Cross-cutting

- **No save bump** — optional derived field; v72 stays current.
- **ASCII ratchet** — all NEW comments ASCII-only.
- **Restore-order invariant** — canonical holder always republishes the
  mirror (persisted mirror is advisory, self-corrects).

## Gates after implementation

P3 `npm run verify` (Pinia root-state field + save validation → full
mode) → P18 OCR → P13/P14 (Pinia root state + restore path → boot,
grant technique, inspect save `player.techniqueProgress`, reload,
verify republish) → P4 QA → P5 sequential passes → external IMPL review
→ commit.
