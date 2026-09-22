# M-QI-02 — Trúc Cơ Chapter Gate — spec v2

## 1. Mission

`game/docs/p7/mission-graph.md` row M-QI-02: `canTriggerBreakthrough` gains a Chapter-10 predicate (`completedStageIds ⊋ qi_refining_abyssal_pool`) alongside `realmLevel ≥ 12`.

Locked ruling (`decisions.md` QI-D5/D6): Gate = Chapter 10 clear (`qi_refining_abyssal_pool`) + Luyện Khí level 12. Both mandatory; boss special loot is not a normal requirement.

## 2. Evidence (G0)

Current state, verified against `master` @ `d6daae3b`:

- `GameManagerRealmAdvanceOps.canTriggerBreakthrough` (`src/core/game/GameManagerRealmAdvanceOps.ts:464-469`): `mortal`/`qi_refining` → `realmLevel >= CORE_REALM_LEVEL` (12); all other realms → `false`.
- `completedStageIds: string[]` is persisted `PlayerData` state (`src/core/player/Player.ts:196`); pushed exactly once per stage victory in `GameManagerBattleRewardOps.ts:159-169`.
- `qi_refining_abyssal_pool` = floor 10 of the qi_refining chapter — the chapter-final boss stage (`src/data/stage/Stages.ts:28`, built by `defineChapterStages(QI_CHAPTER)`). Stage order is sequential; clearing floor 10 proves the chapter is complete.
- Gate consumers (the ONLY readers of `canTriggerBreakthrough`):
  - `useTribulation.triggerBreakthroughAction` (`src/composables/useTribulation.ts:38`) — production admission precheck before the tribulation presentation entry.
  - `RealmPanel.vue:31` — `canBreakthrough` computed → Đột Phá button enabled state.
  - `EarlyGameSession.runTribulation` (`src/core/simulation/earlygame/EarlyGameSession.ts:302`) — sim mirror of the same admission contract.
- `gameManager.startTribulation(player, target)` does NOT consult `canTriggerBreakthrough` — it is the engine start used directly by many tests (`GameManager.dotPha.test.ts`, `useTribulation.artifact.test.ts`, `tribulationRouting.test.ts`, `TribulationOutcomeService*.test.ts`). Admission gating lives at the action layer, not the engine start. This stays unchanged.
- Mortal → qi_refining uses `chooseCultivationPath` (initiation ritual, self-gated at `realmLevel >= CORE_REALM_LEVEL`, `GameManagerRealmAdvanceOps.ts:151-158`), NOT the tribulation path. `canTriggerBreakthrough('mortal', 12) === true` is preserved for UI/sim symmetry; no stage predicate is added to mortal.
- `EarlyGameSession` sims only ever tribulate toward `'qi_refining'` (mortal→LQ); no sim drives LQ→TC today (M-QI-12 owns that journey later).

## 3. Contract

### 3.1 `canTriggerBreakthrough` after this mission

```text
realmId === 'mortal'       → realmLevel >= CORE_REALM_LEVEL            (unchanged)
realmId === 'qi_refining'  → realmLevel >= CORE_REALM_LEVEL
                             AND completedStageIds includes
                             'qi_refining_abyssal_pool'
anything else              → false                                     (unchanged)
```

Both qi_refining conditions are mandatory and independent:

- Level 12 without the chapter-final stage cleared → `false`.
- Chapter-final stage cleared below level 12 → `false`.
- Other qi_refining stage ids (floors 1–9) without `qi_refining_abyssal_pool` → `false` — the pinned id is the contract, not "any LQ stage" or a clear count.

### 3.2 Constant ownership

The pinned stage id is authored as a named constant — `QI_REFINING_BREAKTHROUGH_STAGE_ID = 'qi_refining_abyssal_pool'` — in `src/core/realm/realmSystem.ts` next to `CORE_REALM_LEVEL` (the existing breakthrough-gate constants home, already imported by the ops class). No magic string inside the ops body.

### 3.3 Out of scope (explicit non-changes)

- `startTribulation` engine start — unchanged; direct-start tests keep working without `completedStageIds`.
- `chooseCultivationPath` — unchanged; mortal initiation keeps level-only gating.
- Save shape — `completedStageIds` already persists; no migration, no new fields.
- Stage data / `defineChapterStages` — unchanged.
- `RealmPanel` requirement-line read-model — M-QI-03 owns the two visible requirement lines; this mission only changes the enabled/disabled outcome the button already derives.
- Tribulation grade resolution (`truc_co_dan`, body tiers, perfection) — unchanged; the grade inputs stay resolver-internal per QI-D6.
- Meridian/Body investment — unchanged.
- No tick/auto behavior — the gate is evaluated on demand only.

## 4. Test invariants (acceptance oracles)

Domain (`GameManager.progressionScope.test.ts` — the existing gate home):

1. `qi_refining` level 12 + `completedStageIds` contains `qi_refining_abyssal_pool` → `true`.
2. `qi_refining` level 12 + empty/partial `completedStageIds` (e.g. floors 1–9 only) → `false`.
3. `qi_refining` level 11 + `qi_refining_abyssal_pool` cleared → `false`.
4. `mortal` level 12, no stage clears → `true` (mortal gate unchanged).
5. `foundation_establishment`/`golden_core` → `false` (existing pins kept).

UI (`RealmPanel.test.ts`):

6. `qi_refining` level 12 without the stage clear → Trúc Cơ button stays disabled; after seeding `completedStageIds` with `qi_refining_abyssal_pool` → enabled. (Existing test updated to seed the clear before asserting enabled.)

Action layer (`useTribulation.dotPha.test.ts`):

7. `triggerBreakthroughAction` at `qi_refining`/12 with the stage cleared → `true` (existing auto-unequip test updated to seed the clear); without it → `false`, no tribulation state created.

Integration journey (`cultivationRitualFlow.integration.test.ts`):

8. The mortal→LQ ritual → LQ L12 → `triggerBreakthroughAction` sequence (line 53-55) seeds `completedStageIds = ['qi_refining_abyssal_pool']` before the LQ→TC action — fixture seeding, not a played chapter (M-QI-12 owns the real E2E journey).

### 4.1 Affected-caller census (complete)

Every `canTriggerBreakthrough`/`triggerBreakthroughAction` positive-path caller was swept:

| Caller | Realm fixture | Affected? |
|---|---|---|
| `useTribulation.ts:38` | production precheck | gate owner — changed |
| `RealmPanel.vue:31` | live player | button outcome changes for uncleared LQ-12 |
| `EarlyGameSession.ts:302` | sim mirror — all calls target `'qi_refining'` (mortal) | unaffected |
| `GameManager.progressionScope.test.ts` | qi_refining L12 | seed + new cases |
| `RealmPanel.test.ts` | qi_refining L12 | seed |
| `useTribulation.dotPha.test.ts` (auto-unequip) | qi_refining L12 | seed + refusal case |
| `cultivationRitualFlow.integration.test.ts` | qi_refining L12 post-ritual | seed |
| `tribulationRouting.test.ts` (trigger calls) | mortal L12 only | unaffected |
| `sessionHandoff.test.ts` | mortal L12 | unaffected |
| `GameManager.realmAdvanceUnequip.test.ts` | `chooseCultivationPath` (mortal) | unaffected |
| `CharacterPanel.vue:29` | comment reference only | unaffected |
| All `startTribulation` direct calls | engine start, no gate consult | unaffected by design |

## 5. Files

- `src/core/realm/realmSystem.ts` — new exported constant.
- `src/core/game/GameManagerRealmAdvanceOps.ts` — predicate + doc-comment sync (the docblock currently describes a level-only gate).
- `src/core/game/GameManager.progressionScope.test.ts` — updated/new gate cases.
- `src/components/panels/RealmPanel.test.ts` — seed `completedStageIds` for the enabled assertion.
- `src/composables/useTribulation.dotPha.test.ts` — seed `completedStageIds` where the action is expected to admit.
- `src/composables/cultivationRitualFlow.integration.test.ts` — seed `completedStageIds` before the LQ→TC action.
- `src/core/simulation/earlygame/EarlyGameSession.ts` — comment sync only: the mirror note cites the admission contract, which now includes the stage predicate.

No locale keys, no new UI strings, no production code beyond the predicate + constant.
