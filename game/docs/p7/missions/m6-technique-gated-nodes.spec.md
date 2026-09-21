# P7-M6 — Technique-Gated Node Prerequisites — Spec

Status: draft v1 (pending external SPEC review)
Depends on: M3 (canonical Technique authority — committed `e9a0bd32`)
Mission-graph scope: `requiredTechniqueRank`/`requiredTechniqueGrade` schema + evaluator + tests; **no authored gates**.

## 1. Intent

Give the node tree a way to gate purchases on the player's canonical
technique progression (rank inside the current grade, and grade). This is
infrastructure only: the schema variant, its evaluator, the state mirror
the evaluator reads, and tests. No existing node gains a technique gate
in this mission.

## 2. Decision — prerequisite channel, not ownership field

The mission-graph names the concept `requiredTechniqueRank`/
`requiredTechniqueGrade`. Two shapes were considered:

| Shape | Semantics |
|---|---|
| A. `NodePrerequisite` variants `{kind:'techniqueRank'}`/`{kind:'techniqueGrade'}` | Gate the 0→1 purchase only; AND-composable with other prereqs; works in `revealWhen`; plugs into `hasPrerequisite` + `NodeInspector.lockedReasons` for free. |
| B. Top-level fields `requiredTechniqueRank?: number` (like `requiredWay`) | Ownership gate: re-checked at purchase, upgrade, AND every aggregator — a purchased node's effects switch off when the gate stops holding. |

**Chosen: A.** Rationale:

1. `advanceTechniqueGrade()` resets `rank` to 0 on every grade advance —
   rank is *non-monotonic* across normal progression. Under ownership
   semantics a node bought at rank 10 would silently stop aggregating
   after the advance; under prerequisite semantics the purchased node is
   permanent (same contract as `kind:'realm'` — realm also never
   regresses).
2. The mission title is "technique-gated node **prerequisites**" — the
   prerequisite channel is the domain-correct place for a
   progression-requirement check.
3. Prerequisites compose: a future authored gate can combine
   `realm` + `techniqueRank` + `node` in one AND-list, and `revealWhen`
   accepts the same variant for hidden-until-technique nodes.

The variant field names carry the mission's intent:
`{kind:'techniqueRank'; rank}` implements "requiredTechniqueRank";
`{kind:'techniqueGrade'; grade}` implements "requiredTechniqueGrade".

## 3. Schema

```ts
// ProgressionNode.ts — NodePrerequisite union gains:
| { kind: 'techniqueRank'; rank: number }
| { kind: 'techniqueGrade'; grade: number }
```

- `rank` = required technique rank (0..10 within a grade; authored gates
  should use >= 1 — schema permits 0, which a no-technique player would
  trivially satisfy).
- `grade` = required technique grade (>= authored threshold).
- Both are `>=` thresholds, consistent with `kind:'realm'`
  (index comparison) and `kind:'skillCastCount'` (count comparison).

## 4. Evaluator — `hasPrerequisite`

```ts
case 'techniqueRank':
  return (player.techniqueProgress?.rank ?? 0) >= prerequisite.rank
case 'techniqueGrade':
  return (player.techniqueProgress?.grade ?? 0) >= prerequisite.grade
```

Absent mirror → `0` → any positive requirement fails closed. A
`rank: 0`/`grade: 0` gate would pass — data discipline (not schema)
keeps authored thresholds >= 1; irrelevant in M6 (no authored gates).

### Consumers that pick the behavior up unchanged

- `meetsPrerequisites` → `canPurchaseNode` (purchase gate).
- `canPurchaseNode`'s `revealWhen` re-check (hidden-node reveal gate).
- `devResetBranch` orphan-cascade: keyed to `kind:'node'` only —
  technique kinds never cascade-orphan (correct: grade-advance rank
  resets are normal progression, not invalidation).
- `NodeTreePanel` edge building (`kind:'node'` filter): unaffected.

## 5. The mirror — `player.techniqueProgress`

`hasPrerequisite(player, prereq)` receives only `PlayerData`; the
canonical technique holder lives in `TechniqueManager` (live) /
`gameSave.techniques` (save). This is the *exact* problem the codebase
already solved for `skillCastCount`: `player.skillCastCounts`/
`player.skillLevels` are read-only save mirrors maintained by the
domain writer through a sink — the Player.ts comment says they exist
"vi NodeSystem.hasPrerequisite() chi nhan PlayerData".

Same pattern, shape following the `player.artifact` optional-record
precedent:

```ts
// PlayerData
techniqueProgress?: { rank: number; grade: number }
```

- Present iff the player holds a technique; absent = no technique (the
  holder is 0-or-1 — no list, no unequip).
- One record keeps `{rank, grade}` atomic — `advanceTechniqueGrade`
  changes both in one mutation; a flat field pair could drift.
- Read-only mirror: NodeSystem/tests read it; nobody else writes it.
- `createDefaultPlayer()` **must** declare `techniqueProgress: undefined`
  (spec-review fix): `player.ts` convention — every optional field gets
  a default key — is load-bearing here twice over:
  1. `stores/player.ts restoreFromSave` whitelists payload keys by
     `Object.keys(createDefaultPlayer())` — an undeclared key is
     stripped before the spread, so a persisted mirror would never
     reach live state.
  2. The store's key-drop pass iterates `$state` against the restored
     shape; an undeclared key would be deleted each restore.
  `undefined` in defaults preserves "honest absence": `Object.keys`
  sees the key, `JSON.stringify` omits it, `structuredClone` carries it.

### Sink — `TechniqueSystem.setProgressSink`

```ts
setProgressSink(sink: (progress: { rank: number; grade: number } | null) => void): void
```

`TechniqueSystem` is the single progression writer (M3); the sink fires
exactly where the mirrored pair can change:

| Site | Fires | Payload |
|---|---|---|
| `grant` (success) | yes | `{rank: 0, grade: granted.grade}` |
| `gainMastery` | only when `rankUps > 0` (mastery alone isn't mirrored) | `{rank, grade}` |
| `advanceTechniqueGrade` (success) | yes | `{rank: 0, grade: new}` |
| `setTechniqueQuality` | no (quality unmirrored) | — |
| `restore(techniques)` (new, sec. 6) | yes | holder `{rank,grade}` or `null` when empty |

GameManager wires the sink to `activePlayer.techniqueProgress`
(assign record / delete key on `null` — honest absence, no
`undefined`-valued key in the serialized save). No active player →
sink no-ops, same as `castCountSink`.



## 6. Restore — `TechniqueSystem.restore`

`GameManagerSaveRestore` currently calls `techniqueManager.restore`
directly — that bypasses the writer authority and would leave the
mirror stale. New wrapper on `TechniqueSystem`:

```ts
restore(techniques: Technique[]): void {
  this.manager.restore(techniques)
  this.progressSink?.(this.manager.getActive()?.progress() ?? null)
}
```

(Exact accessor per implementation — the point: one call restores the
holder AND republishes the mirror from the canonical state.)

- `GameManagerSaveRestore` re-points `techniqueManager.restore` →
  `techniqueSystem.restore`. Restore order (verified M5): store
  REPLACE applies `save.player` → `setActivePlayer` → saveOps — so
  the sink writes the live player *after* the saved mirror lands:
  **the canonical holder always wins**; a drifted/forged persisted
  `techniqueProgress` self-corrects on restore (same philosophy as
  M5's body-modifier rehydration).
- `BattleSimulation` **must** route through the canonical publication
  seam (spec-review fix — the earlier "leave it" was wrong twice):
  1. `runBattle` DOES reach the prerequisite path: `postRitual`
     writes include `purchase_node` → `progressionOps.purchaseNode` →
     `canPurchaseNode` → `hasPrerequisite`. A technique-gated node
     purchased in a sim build would silently fail.
  2. Its `techniqueManager.restore` currently runs BEFORE
     `setActivePlayer` — a sink fired there would no-op on the missing
     `activePlayer` even after re-pointing to `techniqueSystem.restore`.
  Fix: bind the player first, then restore through the system —
  `setActivePlayer(player)` → `techniqueSystem.restore(build.techniques)`
  (the player's `persistentTimedEffects` strip already precedes
  `setActivePlayer`; technique restore has no ordering constraint
  against it). A test pins `player.techniqueProgress` correctness in
  a sim build so authored gates post-M6 work in simulation too.

## 7. Save boundary — no version bump

- `techniqueProgress` is **optional** — a v72 save without it is
  already schema-valid; the mirror repopulates on restore from the
  canonical `techniques[0]`. No bump: the field is derived state and
  M8 owns the final save-version decision.
- `validateSaveShape` type-checks the optional record if present:
  object with `rank`/`grade` non-negative finite integers (same
  discipline as `skillLevels`/`skillCastCounts`/`artifact` blocks).
  No cross-field consistency check needed — restore rehydrates.
- `structuredClone` carries the field through save automatically
  (plain PlayerData member).

## 8. UI — NodeInspector lock reasons

The `lockedReasons` if-else chain gets explicit branches for both
kinds (today they'd fall through to the misleading `'skillUpgrade'`
label "Upgrade the related skill"). New i18n keys in
`panels.skillPath.nodeInspector.lockedReasons`, en + vi:

- `techniqueRank`: e.g. "Requires technique rank {rank}"
- `techniqueGrade`: e.g. "Requires technique grade {grade}"

No other UI: no authored gates exist to display.

## 9. Tests (TDD)

1. `hasPrerequisite` — `techniqueRank`/`techniqueGrade`: pass at/above
   threshold, fail below, fail closed on absent mirror, `0`-threshold
   edge documented.
2. `canPurchaseNode` / `purchaseNode` — a fixture node carrying a
   technique gate: blocked below threshold (no insight deducted),
   purchasable at threshold.
3. `revealWhen` accepts a technique-kind prereq (hidden node gate).
4. `TechniqueSystem` sink — fires on grant, on rank-changing
   `gainMastery` only, on `advanceTechniqueGrade`, on `restore`
   (holder payload / `null` on empty); silent on quality and on
   mastery-only gains.
5. GameManager wiring — `player.techniqueProgress` written through
   the sink; key removed (back to the `undefined` default) when the
   holder empties via `restore([])`.
6. Restore rehydration — a persisted `techniqueProgress` disagreeing
   with `techniques[0]` is overwritten by canonical state.
7. `validateSaveShape` — absent/`undefined` OK; malformed record /
   non-integer / negative rejected.
8. `BattleSimulation` — after bind+restore, `player.techniqueProgress`
   mirrors `build.techniques[0]` (and a postRitual `purchase_node`
   fixture can exercise a technique gate end-to-end if authored —
   the mirror publication is the pinned contract).
9. **No-authored-gates invariant** — data test asserting no node in
   the authored registries uses `kind:'techniqueRank'`/`'techniqueGrade'`
   (pins the mission constraint; remove when M-later authors gates).

## 10. Non-goals

- No authored technique gates on any node (mission constraint).
- No technique-gate UI beyond the lock-reason strings.
- No upgrade/aggregate gating (prerequisite semantics — purchase only).
- No orphan-cascade on technique kinds (rank resets are normal).
- No save-version bump (M8 decides final versioning).
- No quality-axis mirror (display-level, unneeded by prerequisites).

## 11. Risks

- *Mirror drift between writes:* sink fires on every mutation site of
  the single writer; restore republishes — same trust model as
  `skillCastCounts`.
- *Direct `manager.setActive`/`manager.restore` callers:* unit-test
  setups bypass the sink — acceptable (they never run purchase
  checks); `BattleSimulation` is NOT exempt — it purchases via
  postRitual writes, so it must use the canonical seam (sec. 6).
- *Rank-0-after-advance confusion:* prerequisite semantics mean a
  purchased node stays purchased — deliberate (sec. 2).
