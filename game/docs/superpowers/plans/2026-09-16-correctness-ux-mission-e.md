# Mission E — Correctness & UX Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the independent confirmed defects — gameplay id mismatches, silent resource loss, tribulation correctness, stale UI, paid-preview honesty, raw-id leaks — as one batch of small, independently verifiable tasks.

**Architecture:** Each task is self-contained: failing regression test first, smallest domain/presentation fix second. UI consumes domain truth (A7); every semantic rule keeps one owner (A2/A9). No cross-task dependencies; same-area tasks may share one dispatch (see Batching).

**Tech Stack:** TypeScript, Vue 3, Vitest, Pinia, Vue I18n, Phaser.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission E (E1–E12). Audit: `docs/qa/2026-09-16-full-project-scout-audit.md` — T3-16, T1-10, T1-11, T3-21/23/25/26, T4-31..39, T5-48, T6-54, T8-71/75.

**Worktree:** `.agent-worktrees/correctness-ux` — **branch:** `fix/correctness-ux`.

## Global Constraints

- **Dev-stage rule:** no live players — never write migrations or old-save compat shims; delete legacy bridges instead of preserving them.
- P8: no `any`. P15: comments English ASCII only in `.ts`/`.vue` files. P16: new/changed user-visible strings go through `t()` — check **both** `src/locales/vi.json` and `src/locales/en.json` for an existing key before adding one; new keys go in both files (key parity is guarded by `tests/architecture/i18nKeyParity.test.ts`).
- A2/A9: UI never recomputes domain rules — where UI duplicates a rule, route through the owner. A3: paid/random preview results are domain-owned; commit validates current eligibility.
- Verification per task (P3 quick): `npm run type-check` + `npx vitest run <task scope>`.
- Wiring-critical tasks (App.vue, useAppLifecycle, scene listeners) also need the matching Playwright spec per P13.
- Tasks are independent — see **Batching** under each task for same-area dispatch groups.

## Audit verification status (checked against current source 2026-09-16)

| Audit ref | Verdict | Evidence |
|---|---|---|
| T3-16 | **Confirmed** | `EnemySystem.spawn` mints `id = template.id + '_' + uuid` (`EnemySystem.ts:20`); `BattleLootSystem` passes `battleEnemy.entity.id` to `questSystem.onEnemyDefeated` (~:371) and `hiddenBeast.onEnemyDefeated` (~:393); consumers compare template ids (`QuestSystem.ts:272`, `HIDDEN_BEAST_ENEMY_ID='huyet_mong'` in `HiddenBeastSystem.ts`). |
| T1-10 | **Confirmed** | `usePillDetailed` (`GameManagerPillOps.ts:61-115`): material pills have `effects:[]` → `isProfessionPill=false` → legacy path → `pillBag.remove` with zero effect. `PillBagSection.vue:302` binds `drinkPill` on every stack. |
| T1-11 | **Confirmed** | `QuestSystem.claim` debits `materialBag.remove` at :153-155 **before** `rewardSystem.give` at :157-159. A throwing receiver loses the cost. |
| T3-21 | **Confirmed** | `TribulationDirector.ts:280-283` comment documents per-second HP regen; code only calls `emitState()` — no regen applied. `ghost.stats.hpRegenPerTurn` is snapshotted but unused. |
| T3-23 | **Partially stale** | The overlay already reads `stateVersion.value` (`TribulationSceneOverlay.vue:11`), so computeds DO re-run per tick — "freezes at first render" is no longer accurate. Remaining defect: `TribulationDirector.getState()` (:634-642) returns the **mutable internal** `active` object; `getPresentationSnapshot` (:156-169) already returns a detached `{ ...this.active, hp: this.snapshotHp }`. Fix = same detach in `getState` + hardcoded-string i18n. |
| T3-25 | **Deferred (E11)** | Dead-end content stays in source; roadmap section only. See Task 18. |
| T3-26 | **Confirmed** | `player.ts:335` computes theoretical `offline`; actual post-cap delta `offlineGained` IS computed (:438-447) for the insight accumulator but the function still **returns the theoretical value** (:479). |
| T4-31 | **Confirmed (partially fixed)** | `BuildingConstructionGate.vue:29` already reads `stateVersion` in `instance`, but `canBuild` (:55-63) does not. `useBuildingNavigation.ts` exposes plain functions; `HomeBuildingIcons.vue` never imports `useStateVersion` → badges/tooltips stale. |
| T4-32 | **Confirmed** | `AlchemyView.vue:205-211`: failure → `console.warn` only; `alchemy.reason.*` keys exist in both locales (missing `retired` — add it); the start button (:302) is never disabled. |
| T4-33 | **Confirmed (partially fixed)** | Ticket machinery is correct (paid preview, membership generation, snapshot revalidation, consume-on-attempt in BOTH `commitWashAffixes:404` and `commitRefineValues:202`). Remaining defects: `WashTab.washAffixCompareRows` (:188-202) iterates **current** affixes and indexes `pending[position]` — extra rolled lines hidden, zero-line roll renders as "notRolled" (lie) or `noAffixes` (invisible); `doWashKeep` (:132-140) clears local ticket only on success → dead armed "Giữ" button; no `onBeforeUnmount` discard (RefineTab has one). Min-range note: `rollWashAffixes` (:110-114) uses `0..max` and ignores `ITEM_QUALITY_SUBSTATS_RANGE[quality].min` — numerically identical today (all mins are 0) but the contract should read both ends. |
| T4-34 | **Confirmed** | `useEquipmentTooltip.ts:207` renders `template.maxEnhanceLevel` (per-item legacy field); the authoritative slot cap is `MAX_SLOT_ENHANCE_LEVEL = 100` (`EnhanceCurve.ts:31`, enforced at `EquipmentSystem.ts:524`, exposed via `EquipmentOpsSystem.getSlotMaxEnhanceLevel`). |
| T4-35 | **Confirmed** | `OVERLAY_LAYERS.announcement=2000` > `modal=1900` (`OverlayLayers.ts:31-33`); `WorldAnnouncementOverlay.vue` typeTimer never cleaned on unmount; no Escape/dismissal semantics; store auto-close is a bare `setTimeout` guarded by content identity. |
| T4-36 | **Confirmed** | `CompanionPanel.vue:422` renders `selected.definition[slot]!.id` raw; `BattleLogPanel.vue:40-54` renders raw `actorId`/`skillId`/`targetIds` + hardcoded strings. `TURN_SKILL_DISPLAY_META` already covers companion skills (`TurnSkillDisplayMeta.ts:130+` — explicitly authored "for the HUD skill bar and companion panel"); `TurnBattleParticipant.entity.name` gives actor names. |
| T4-37 | **Confirmed** | `GameManager.ts:~258-263` pushes mojibake literals `d?t c?p`/`tang ... c?p` with no `messageKey` — `NotificationEvent.messageKey`/`messageParams` channel already exists and is rendered by `App.vue` + `ActionFeedbackLog.vue`. |
| T4-38 | **Confirmed** | `StageSelectPanel.vue:197-201`: `startAutoFarm()` returns `boolean` (`GameManagerAutoFarmOps.ts:53`) but the panel closes unconditionally; `mode` ref never resets on stage change. |
| T4-39 | **Stale wording, real residual gap** | `phap_tu_an` no longer exists as a path id — save v66 collapsed `_an` paths into base path + `cultivationWay:'ngo_dao'`. `CultivationPathId = 'kiem_tu' \| 'phap_tu' \| 'the_tu'` (`CultivationPathKit.ts:44`); `the_tu` currently falls through `resolvePlayerVisualProfileId` to `mortal` (`PlayerVisualForm.ts:22-31`). |
| T5-48 | **Confirmed** | `useAppLifecycle.ts:282-287` shows the offline modal AND invokes `onRestoreOk`, whose App.vue handler (:559-563) shows it **again** — two owners, same values (idempotent-looking but double-owned). |
| T6-54 | **Confirmed** | `TribulationScene.ts:98` listens `'damage'`, but tribulation damage flows through `EntityVitalsSystem` → `'entity_vitals_changed'` (`EntityVitalsSystem.ts:198`); the existing `vitalsHandler` (:26-30) only sets alpha. `EntityVitalsChangedEvent` carries `entityId`/`amount`/`reason`/`killed` — enough to render `-N`. |
| T8-71 | **Confirmed** | `DropRoll.ts:43` — `weightedRandom([])` evaluates `entries[-1]!.value` → TypeError. |
| T8-75 | **Confirmed** | `NodeSystem.ts:49` — unknown prereq `realmId` → `getRealmIndex` −1 → `playerIndex >= -1` silently passes. |

## Batching (same-area dispatch groups)

- **Batch T (tribulation):** Tasks 4, 5, 6.
- **Batch Q (quest/bag domain):** Tasks 1, 2, 3.
- **Batch U (panel staleness):** Tasks 8, 9, 10.
- **Batch E (equipment hall):** Tasks 11, 12.
- **Batch P (presentation labels):** Tasks 14, 15.
- **Batch C (core fail-closed):** Tasks 16, 17.
- Tasks 7, 13, 18 dispatch alone.

Each task remains independently testable and committable even inside a shared dispatch.

---

### Task 1: Kill-quest + hidden-beast template id (E1 / T3-16)

**Scope:** spawned enemy instances mint `id = '<templateId>_<uuid>'`; kill consumers compare template ids. Carry the template id through to the consumers.

**Files:**
- Modify: `src/core/enemy/Enemy.ts` (add optional `templateId?: string` to `Enemy` — optional because authored templates in `src/data/enemy/**` are also `Enemy`-shaped and must not all need the field), `src/core/enemy/EnemySystem.ts:12-31` (spawn stamps it), `src/core/game/BattleLootSystem.ts` (~:371, ~:393 — pass `enemy.templateId ?? enemy.id` to both consumers).
- Test: `src/core/game/BattleLootSystem.questHook.test.ts` (new file using the existing `battleLootTestSetup.ts` fixture) + `src/core/enemy/EnemySystem.test.ts` (new — spawn stamping).

**Interfaces:**
- `createLootTestSetup()` returns `{ killEnemy, deps, player, ... }`; `deps.questSystem.onEnemyDefeated` and `deps.hiddenBeast.onEnemyDefeated` are `vi.fn()`s. Fixture `enemy` stub lives at `battleLootTestSetup.ts:106-112` — add `templateId` there when needed (it's a `src/` test-support file; keep the change minimal).
- Consumers unchanged in signature: `questSystem.onEnemyDefeated(registry, manager, enemyId, zoneId)`, `hiddenBeast.onEnemyDefeated(player, enemyId, enemyRealmId)` — the fix changes WHICH id arrives, not the API.

- [ ] **Step 1: Failing tests.**

```ts
// src/core/enemy/EnemySystem.test.ts (new)
import { describe, expect, it } from 'vitest'
import { EnemySystem } from './EnemySystem'
import { EnemyManager } from './EnemyManager'
import type { Enemy } from './Enemy'

const TEMPLATE = {
  id: 'wild_wolf', name: 'Dã Lang', level: 1, realmId: 'qi_refining',
  stats: {} as Enemy['stats'], currentHp: 10, maxHp: 10, alive: true,
} as unknown as Enemy

it('spawn stamps templateId while minting a unique instance id', () => {
  const system = new EnemySystem(new EnemyManager())
  const spawned = system.spawn(TEMPLATE)
  expect(spawned.id).not.toBe('wild_wolf')
  expect(spawned.id.startsWith('wild_wolf_')).toBe(true)
  expect(spawned.templateId).toBe('wild_wolf')
})
```

```ts
// src/core/game/BattleLootSystem.questHook.test.ts (new)
import { describe, expect, it, vi } from 'vitest'
import { createDeadEnemy, createLootTestSetup } from './battleLootTestSetup'

it('quest kill hook receives the enemy TEMPLATE id, not the instance id', () => {
  const { loot, deps } = createLootTestSetup()
  // Simulate a spawned instance: entity id differs from the template id.
  loot.processDefeatedEnemies([createDeadEnemy('wild_wolf_abc-123')], null)
  const calls = vi.mocked(deps.questSystem.onEnemyDefeated).mock.calls
  expect(calls[0]?.[2]).toBe('wild_wolf') // or the fixture enemy's templateId — see Step 3
})

it('hidden-beast reset hook receives the template id', () => {
  const { loot, deps } = createLootTestSetup()
  loot.processDefeatedEnemies([createDeadEnemy('huyet_mong_abc-123')], null)
  expect(vi.mocked(deps.hiddenBeast.onEnemyDefeated).mock.calls[0]?.[1]).toBe('huyet_mong')
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/core/enemy/EnemySystem.test.ts src/core/game/BattleLootSystem.questHook.test.ts`). The loot tests fail because mocks receive `'wild_wolf_abc-123'`.
- [ ] **Step 3: Implement.**
  - `Enemy.ts`: add `templateId?: string` with a one-line English comment (P15): `// Template id this instance was spawned from; set by EnemySystem.spawn.`
  - `EnemySystem.spawn`: `templateId: template.id` in the object literal alongside the `id:` override.
  - `battleLootTestSetup.ts` fixture `enemy` stub: add `templateId: 'mob'` (or per-test override — give the fixture an option only if a test needs a different one).
  - `BattleLootSystem.ts`: at both call sites pass `enemy.templateId ?? enemy.id` — the `?? enemy.id` fallback preserves behavior for `Enemy` records that never went through `spawn` (raw templates used directly, e.g. `defineEnemy` results registered without instance minting).
  - Note: do NOT fix this by string-splitting the instance id — the id's `_uuid` suffix is minted in exactly one place; an explicit field is the durable contract.
- [ ] **Step 4: Run — expect PASS.** Also run `npx vitest run src/core/game/HiddenBeastSystem.test.ts src/core/game/GameManager.questLifecycle.test.ts` (adjacent coverage must stay green).
- [ ] **Step 5: Commit** `fix(quest): match kills on template id, not instance id`

**Dependencies:** none. **Batch:** Q (Tasks 1–3).

---

### Task 2: Material pills are not consumables (E2 / T1-10)

**Scope:** `thong_mach_dan`/`truc_co_dan` (`pills.ts`, `type:'material'`, `effects:[]`) fall through the legacy path in `usePillDetailed` and are silently destroyed. Domain rejects; UI stops offering drink for them.

**Files:**
- Modify: `src/core/game/GameManagerPillOps.ts:33-116` (reason union + early reject), `src/components/panels/bag-sections/PillBagSection.vue:180-233,302` (no drink binding for `type==='material'`; reason ternary → i18n keys).
- Locales: `src/locales/vi.json` + `src/locales/en.json` — add keys for pill-use reasons (see below).
- Test: `src/core/game/GameManager.pillOps.test.ts` (new, or the existing pill-ops test file if one exists — check `find src -name "*pill*test*"` first).

**Interfaces:**
- `usePillDetailed` returns `{ ok, reason?: 'not_found'|'wrong_realm'|'all_main_stats_capped'|'requires_phap_tu'|'cap'|'retired', mainStat? }`. Add `'material_pill'` to the union.
- `Pill.type` — check `src/core/pill/Pill.ts` for the exact union; `pills.ts:69-92` authors `type:'material'` for `thong_mach_dan`/`truc_co_dan`.
- `PillBagSection` cell shape (`BagCell`): `onClick` is set at :302 for every stack — verify whether the cell renders without `onClick` (check `BagCell` type in the bag primitives; if `onClick` is required, keep the binding but let the domain rejection surface the toast — decide after reading `BagCell`).

- [ ] **Step 1: Failing tests.**

```ts
it('rejects material-type pills without consuming them', () => {
  // build pillBag containing 'truc_co_dan' via the real registry path;
  // call usePillDetailed('truc_co_dan', target, player)
  expect(result.ok).toBe(false)
  expect(result.reason).toBe('material_pill')
  expect(pillBag.getAmount('truc_co_dan')).toBe(before) // unchanged
})

it('drinkable pills still consume normally', () => { /* existing-path sanity, keep green */ })
```

- [ ] **Step 2: Run — FAIL** (`npx vitest run src/core/game`). Today the call returns `{ ok: true }` and the stack count drops.
- [ ] **Step 3: Implement.**
  - `GameManagerPillOps.usePillDetailed`: after the `retired` gate (:52-54), add `if (pill.type === 'material') return { ok: false, reason: 'material_pill' }`. Extend the `reason` union. This keeps the check domain-side so every future caller inherits it (A2).
  - `PillBagSection.vue`: gate the `onClick` binding — `onClick: stack.pill.type === 'material' ? undefined : () => drinkPill(stack.pill.id)` (if `BagCell.onClick` is optional; otherwise read the cell contract and pick the equivalent "no action" expression). Replace the hardcoded reason ternary (:220-231) with a `Record<reason, localeKey>` map — add `bag.pill.reason.wrong_realm | .all_main_stats_capped | .requires_phap_tu | .retired | .cap | .material_pill | .fallback` keys to BOTH locales (check `bag.*` and `actionFailure.*` first; none of these pill-specific keys exist today, so a `bag.pill.reason.*` group is the consistent new home).
- [ ] **Step 4: Run — PASS** + `npx vitest run tests/architecture/i18nKeyParity.test.ts` + `npm run type-check`.
- [ ] **Step 5: Commit** `fix(pill): reject consumption of material-type pills`

**Dependencies:** none. **Batch:** Q.

---

### Task 3: Quest claim atomicity (E3 / T1-11)

**Scope:** `QuestSystem.claim` debits the collect-quest material cost before granting rewards. Reorder so a failed grant can never consume the cost.

**Files:**
- Modify: `src/core/quest/QuestSystem.ts:139-222`.
- Test: `src/core/quest/QuestSystem.test.ts` (exists — add cases).

**Interfaces:** `claim(registry, manager, rewardSystem, receiver, bags, questId): boolean`. `rewardSystem.give` returns `void`; the material/pill item-drop grants below it return overflow counts, not failures. The atomic risk is a throwing `receiver`/`bags` call after the debit.

- [ ] **Step 1: Failing test** — in `QuestSystem.test.ts`, build an active collect-quest at full progress, then a `receiver` whose `addSpiritStone` throws:

```ts
it('does not debit quest item cost when reward grant throws', () => {
  // arrange: registry has collect quest 'q_collect' needing material 'm1' x5;
  // materialBag has 5; progress = 5; unclaimed.
  const receiver = { addTechniqueInsight: vi.fn(), addCultivation: vi.fn(),
    addSpiritStone: vi.fn(() => { throw new Error('sink exploded') }) }
  expect(() => system.claim(registry, manager, rewardSystem, receiver, bags, 'q_collect')).toThrow()
  expect(materialBag.getAmount('m1')).toBe(5)          // cost NOT debited
  expect(manager.getProgress('q_collect')?.claimed).toBe(false) // still claimable
})
```

Also assert the success path still debits exactly once (existing tests should already cover; add if absent).

- [ ] **Step 2: Run — FAIL** (`npx vitest run src/core/quest/QuestSystem.test.ts`). Material count drops to 0 today.
- [ ] **Step 3: Implement** — reorder `claim`: run `rewardSystem.give` and the `itemDrops` loop FIRST, debit `materialBag.remove(quest.condition.materialId, quest.condition.amount)` immediately before `manager.markClaimed`. `resolveClaimable` already proved `materialBag.has(...)`, so removing last cannot fail a leg that succeeded earlier. Keep the overflow-notification blocks unchanged. Add an English comment noting the ordering contract (`// Grant before debit: a throwing grant must not consume the cost.`).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `fix(quest): claim is atomic — no cost without reward`

**Dependencies:** none. **Batch:** Q.

---

### Task 4: Tribulation HP regen (E4 / T3-21)

**Scope:** `TribulationDirector.update` documents per-second HP regen "theo stats thật" but never applies it.

**Files:**
- Modify: `src/core/tribulation/TribulationDirector.ts:270-299` (regen inside the step loop).
- Test: `src/core/tribulation/TribulationDirector.test.ts` (exists — add a regen case; check existing harness for how `start` is driven).

**Interfaces:**
- The director snapshots `playerStats` onto `this.ghost` (`baseStats`/`stats` = real `Stats`, includes `hpRegenPerTurn`) and owns `this.vitals: EntityVitalsSystem`.
- `EntityVitalsSystem.applyTurnRegen(target, { hp }, sourceId?)` clamps to `maxHp`, applies `healingEffectivenessPercent`, emits one `'regen'` vitals event, no-ops at full HP, rejects dead targets (:137-179) — reuse it; do NOT hand-add `snapshotHp += regen` (that would fork the clamp/event rules, A9).

- [ ] **Step 1: Failing test** — start a tank chapter tribulation with `hpRegenPerTurn > 0`, apply one lightning strike so `snapshotHp < max`, then `update(1)`:

```ts
it('applies hpRegenPerTurn per elapsed second during ongoing tribulation', () => {
  // arrange: director.start(player, statsWithHpRegen(2), false, 'qi_refining');
  // force one strike (or damage via test hook used by existing tests) so hp drops;
  const hpBefore = director.getState()!.hp
  director.update(1)
  expect(director.getState()!.hp).toBeGreaterThan(hpBefore)
  expect(director.getState()!.hp).toBeLessThanOrEqual(director.getState()!.maxHp)
})
```

Add the clamp case: hp 1 below max with regen 5 → lands exactly at max (never above).

- [ ] **Step 2: Run — FAIL** (`npx vitest run src/core/tribulation/TribulationDirector.test.ts`). HP does not move today.
- [ ] **Step 3: Implement** — inside the `while` step loop (or once per `tickStep`), after the chapter tick, call:

```ts
const applied = this.vitals.applyTurnRegen(this.ghost!, { hp: (this.ghost!.stats.hpRegenPerTurn ?? 0) * step }, 'player')
if (applied.hp > 0) { this.snapshotHp = this.ghost!.currentHp }
```

Record the semantic mapping in a comment: `hpRegenPerTurn` is reused as the per-second rate inside tribulation's 1-second step — tribulation has no turns; the vitals owner still applies clamp/healing-effectiveness/event rules. Keep `emitState()` mirroring `snapshotHp` into `active.hp` afterwards.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `fix(tribulation): apply documented hp regen through vitals owner`

**Dependencies:** none. **Batch:** T.

---

### Task 5: Tribulation `getState` detached snapshot + overlay i18n (E4 / T3-23, corrected scope)

**Scope:** the "frozen overlay" half of T3-23 is already fixed (`stateVersion` read at `TribulationSceneOverlay.vue:11`). Remaining: `getState()` returns the **mutable** `active` object — any consumer mutation corrupts domain state (A3). Also migrate the overlay's hardcoded strings.

**Files:**
- Modify: `src/core/tribulation/TribulationDirector.ts:634-642`, `src/components/game/tribulation/TribulationSceneOverlay.vue:18-23,34,39,43-44,61`.
- Locales: add `tribulation.overlay.*` to both `vi.json`/`en.json` (no overlay keys exist today — only `tribulation.stillEquipped.*` and `announce.tribulation.*`, which are different surfaces; reuse nothing, add new).
- Test: `src/core/tribulation/TribulationDirector.test.ts`.

- [ ] **Step 1: Failing test:**

```ts
it('getState returns a detached snapshot — mutations do not leak into the director', () => {
  // start tribulation; grab state
  const state = director.getState()!
  const hpBefore = state.hp
  state.hp = -999
  expect(director.getState()!.hp).toBe(hpBefore) // internal state untouched
})
```

- [ ] **Step 2: Run — FAIL.** Mutating the returned object mutates `active`.
- [ ] **Step 3: Implement** — `getState()` mirrors the already-correct `getPresentationSnapshot` (:156-169):

```ts
getState(): ActiveTribulationState | null {
  if (!this.active) return null
  this.active.hp = this.snapshotHp
  return { ...this.active }
}
```

If `ActiveTribulationState` contains nested mutable fields (check the type — e.g. `currentQuestion`), shallow-spread those too (`currentQuestion: this.active.currentQuestion ? { ...this.active.currentQuestion } : null`). Then migrate overlay strings — `resultTitle`/`resultText` (:18-23), `Chương` (:34), `HP` (:39), `Lôi đã đỡ`/`Trụ vững` (:43-44), `s` suffix (:61) — to `t('tribulation.overlay.*')` keys with `{count}`/`{hp}` params; add `useI18n` to the component.
- [ ] **Step 4: Run — PASS** + `npx vitest run tests/architecture/i18nKeyParity.test.ts`.
- [ ] **Step 5: Commit** `fix(tribulation): detached getState snapshot + overlay i18n`

**Dependencies:** none (Task 4 touches `update`, this touches `getState`/overlay — no conflict, but they may share a dispatch). **Batch:** T.

---

### Task 6: Tribulation scene damage numbers (E4 / T6-54)

**Scope:** `TribulationScene` listens for `'damage'` events that tribulation never emits; real damage arrives as `'entity_vitals_changed'`.

**Files:**
- Modify: `src/game/scenes/TribulationScene.ts:24-30,98,129-140` (`vitalsHandler` renders the number; drop or repurpose the dead `'damage'` subscription).
- Test: `src/game/scenes/` — check for an existing scene test harness; if Phaser scenes aren't unit-testable, cover the handler logic by extracting `showVitalsDamage(event)` as a testable method or via the e2e spec below.
- E2E: `tests/e2e/tribulation-flow.spec.ts` exists — add an assertion that a damage number node appears during a tank chapter if the spec already drives that far (P13: scene lifecycle = wiring-critical).

**Interfaces:** `EntityVitalsChangedEvent { entityId, sourceId?, reason, hpBefore, hpAfter, amount, killed, ... }` (`EntityVitalsSystem.ts:8-23`). Damage-type reasons: `'damage' | 'dot' | 'heavenly_tribulation' | 'reaction' | 'reflection' | 'ward_break'` — non-damage reasons (`healing`, `leech`, `regen`) must not render `-N`.

- [ ] **Step 1: Failing test/evidence** — the cleanest headless assertion: after `vitalsHandler` renders, a text object is created for a `hpAfter < hpBefore` event on `entityId==='player'` and NOT for a `'regen'`/`'healing'` event. If the scene can't mount headlessly, capture the conditional into a pure helper (`vitalsDamageAmount(event): number | null`) in the scene file and unit-test that; the wiring itself is proven by the e2e.
- [ ] **Step 2: Run — FAIL** (or confirm the e2e shows no damage number today).
- [ ] **Step 3: Implement** — inside `vitalsHandler`, after the alpha update:

```ts
if (event.entityId === 'player' && event.hpAfter < event.hpBefore) {
  this.showDamageText(event.hpBefore - event.hpAfter)
}
```

Refactor `showDamage`'s text spawn (:128-137) into `showDamageText(amount: number)` so both the legacy path and the vitals path share it. Remove the dead `bus.on('damage', this.damageHandler)` subscription + its `off` + handler **only if** nothing else in the tribulation channel emits `'damage'` — grep `emit.*'damage'` under `src/core/tribulation` first; if some path does emit it, keep the listener.
- [ ] **Step 4: Run — PASS** + `npx playwright test tests/e2e/tribulation-flow.spec.ts` (P13 wiring check — run inside the implementation worktree per current P14; the old worktree deferral is retired — a genuine environment failure is an explicit blocker in the task report).
- [ ] **Step 5: Commit** `fix(tribulation): render damage numbers from entity_vitals_changed`

**Dependencies:** none. **Batch:** T.

---

### Task 7: Offline summary actual gain + single modal owner (E5 / T3-26, T5-48)

**Scope:** `restoreFromSave` returns theoretical pre-cap cultivation; two layers show the modal.

**Files:**
- Modify: `src/stores/player.ts:335,438-479` (return actual), `src/App.vue:559-563` (delete duplicate `offlineSummary.show` inside `onRestoreOk`).
- Test: `src/stores/player` restore tests (find the existing offline-restore test file — grep `offline` under `src/stores/*.test.ts`; `useAppLifecycle.test.ts` exists for the owner side).

**Interfaces:** `OfflineResult { elapsedSeconds, cultivation }` (`OfflineProgressSystem.ts:1-4`). `offlineGained` (actual post-cap delta including `cultivationOvercharge`) is already computed at `player.ts:444-447`. `lastRestoredPayloads` stores `{ identity, offline }` (:477) — the stored object must be the corrected one so the identity-guard replay path returns actual too.

- [ ] **Step 1: Failing tests:**

```ts
it('reports actual post-cap offline cultivation, not theoretical', () => {
  // player near realm cap: cultivationPerSecond * elapsed > remaining headroom
  // restore → returned offline.cultivation === actual gained < theoretical
})

it('repeat restore of the same payload returns the same ACTUAL number', () => {
  // second restoreFromSave(sameSave) hits the identity guard — must not
  // re-report theoretical either
})
```

- [ ] **Step 2: Run — FAIL** (`npx vitest run src/stores`).
- [ ] **Step 3: Implement** — after `offlineGained` is computed, build `const offlineResult: OfflineResult = { ...offline, cultivation: offlineGained }`; store and return `offlineResult` (both the `lastRestoredPayloads.set` payload and the `return`). Delete the `offlineSummary.show` block at `App.vue:559-563` — `useAppLifecycle` (:282-287) is the single owner (it already fires before `onRestoreOk` with the same payload). Keep the skill-grant code in `onRestoreOk` untouched.
- [ ] **Step 4: Run — PASS** + `npx vitest run src/composables/useAppLifecycle.test.ts` + `npm run type-check`.
- [ ] **Step 5: Commit** `fix(offline): report actual post-cap gains; single summary owner`

**Dependencies:** none. Dispatches alone.

---

### Task 8: Building staleness — canBuild + home icons (E6 / T4-31)

**Scope:** `canBuild` never re-reads domain state; `HomeBuildingIcons` badges/tooltips never invalidate; both files carry hardcoded strings.

**Files:**
- Modify: `src/components/panels/BuildingConstructionGate.vue:55-63` (+ i18n: `:98,102,114-116`), `src/components/game/HomeBuildingIcons.vue` (add `useStateVersion`; i18n: `:82-83,160-162`), `src/composables/useBuildingNavigation.ts` (no change expected — it exposes plain functions; the reactive contract lives in consumers).
- Locales: `homeBuildings.status.built` (`Đã mở · Cấp {level}/{max}`), `homeBuildings.status.notBuilt` (`Chưa mở · Nhấn để xem yêu cầu`), `homeBuildings.level` (`Cấp {level}`), `homeBuildings.notBuilt` (`Chưa mở`), `buildingGate.*` (`costLabel`/`free`/`build`/`confirmTitle`/`confirmMessage`) — check existing `homeBuildings.*` (only `aria.*` today) and `panels.*` for a building-gate home before adding.
- Test: component test — check `src/components/**` test conventions (`mount()` + jsdom exist, e.g. `ActionFeedbackLog.test.ts`); if mounting the gate is too heavy, extract nothing — assert via a computed-level test by spying on `buildingSystem.canBuild` call count before/after `bumpState()`.

- [ ] **Step 1: Failing tests:**
  - Gate: mount (or minimal-harness) `BuildingConstructionGate`, force `canBuild` evaluation once, mutate `materialBag` (add the missing material), `bumpState()` → `canBuild` recomputes true. Assert by re-reading the computed/disabled state.
  - Icons: `statusFor(buildingId)` result changes after a building materializes + `bumpState()` — requires `stateVersion` read inside the render path (the functions are plain; the fix is making the component's render depend on `stateVersion.value` — e.g. a `const sv = computed(() => stateVersion.value)` read inside `presentationFor`/`statusFor` or a wrapper computed).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement:**
  - `BuildingConstructionGate`: add `stateVersion.value` as first statement inside the `canBuild` computed (:55). Migrate the five hardcoded strings to `t()` keys.
  - `HomeBuildingIcons`: `import { useStateVersion } from '@/composables/useGameState'`; read `stateVersion.value` inside a computed that wraps the per-building projection the template uses (simplest honest fix: convert `presentationFor`/`statusFor` call sites to per-building computeds created in `sceneBuildings` map, or read `stateVersion.value` at the top of each function — verify the function runs inside a tracked render context; a plain function called from template DOES track if it reads a ref during render). Migrate the four hardcoded strings.
- [ ] **Step 4: Run — PASS** + i18n parity + `npm run type-check`.
- [ ] **Step 5: Commit** `fix(ui): building gates and badges consume stateVersion`

**Dependencies:** none. **Batch:** U.

---

### Task 9: Alchemy failure surface + disabled button (E6 / T4-32)

**Scope:** `startAlchemyJob` failures go to `console.warn`; `alchemy.reason.*` keys exist but render nowhere; the brew button never disables.

**Files:**
- Modify: `src/components/panels/AlchemyView.vue:200-218,302` (+ migrate the file's remaining hardcoded strings while touching it — P16 encouraged: `Đan lô hiện tại`, `ĐAN PHƯƠNG`, `Linh Thảo`, `Chi phí khác`, `Xem trước lần luyện`, `Chắc chắn ... viên`, `Lò đang luyện`, `Huỷ (mất nguyên liệu)`).
- Locales: `alchemy.reason.retired` is MISSING from both files — add it; all other `startJob` reasons (`not_found`, `room_not_built`, `job_slots_full`, `wrong_herb`, `missing_herb`, `missing_fuel_wood`, `missing_spirit_stone`) already have keys. Add `alchemy.*` labels for the migrated strings (`alchemy.currentCauldron`, `alchemy.recipe`, `alchemy.herb`, `alchemy.otherCosts`, `alchemy.preview`, `alchemy.outcome`, `alchemy.duration`, `alchemy.jobs`, `alchemy.cancelJob`) — verify each against existing keys first.
- Test: component test for `AlchemyView` if mountable, else extend a domain test asserting `startAlchemyJob` reason codes cover the key set (guard-style: every reason string the ops can return has an `alchemy.reason.*` entry — a data-driven test reading the locale JSON).

- [ ] **Step 1: Failing tests:**
  - Reason→key completeness: collect the literal reason strings returned by `GameManagerAlchemyOps.startAlchemyJob` + `AlchemySystem.startJob` (`'not_found' | 'retired' | 'room_not_built' | 'job_slots_full' | 'wrong_herb' | 'missing_herb' | 'missing_fuel_wood' | 'missing_spirit_stone'`) and assert `vi['alchemy']['reason'][reason]` exists for each — fails on `retired`.
  - UI: on failed `startJob`, `useNotificationStore`/feedback receives the resolved `t('alchemy.reason.<x>')` instead of a console warn (mock the notification store; assert `push` called with localized text — or if the codebase prefers feedback keys, push `{ messageKey: 'alchemy.reason.x' }` via the existing `NotificationEvent.messageKey` channel — pick the channel `useNotificationStore().push` actually supports; check its signature first).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** — `startJob` failure → `useNotificationStore().push('warning', t(...))` or a keyed push per the store's contract; add a `canBrew` computed (`stateVersion` read; recipe+herb selected, variant `enough`, fuel/stone rows sufficient, `jobs.length < maxSlots` — read the slot cap the same way the preview does, do NOT recompute job-slot rules locally: if a domain availability query doesn't exist, the button stays enabled and relies on the surfaced reason — record that choice) → `:disabled="!canBrew"` on the GameButton. Migrate listed strings to new `alchemy.*` keys in both locales.
- [ ] **Step 4: Run — PASS** + i18n parity + type-check.
- [ ] **Step 5: Commit** `fix(alchemy): surface craft failure reasons, disable dead brew action`

**Dependencies:** none. **Batch:** U.

---

### Task 10: StageSelectPanel auto-farm gating (E6 / T4-38)

**Scope:** panel closes even when `startAutoFarm` returns `false`; `mode` stays armed across stage changes.

**Files:**
- Modify: `src/components/panels/StageSelectPanel.vue:185-204`.
- Test: component/composable-level — `mode` is a local `ref`; test via mount or by extracting nothing and asserting through the component (check existing StageSelect tests: grep `StageSelectPanel` under `src/**/*.test.ts`).

- [ ] **Step 1: Failing tests:**
  - `startAutoFarm` stubbed to return `false` → after `start()`, `ui.leftPanelMode` is still set (panel did NOT close).
  - `mode = 'perfect_farm'` then `selectStage(other)` → `mode` back to `'manual'` (or whatever the disarm contract becomes — pick `'manual'` as the documented reset).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement:**

```ts
if (mode.value === 'perfect_farm') {
  if (gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player.$state, selectedStage.value.id)) {
    ui.leftPanelMode = null
  }
  return
}
```

Disarm: `watch(selectedStageId, () => { mode.value = 'manual' })` — the `selectedStageId` watchers at :100-118 already re-pick the stage on zone/chapter change, so one watcher covers all change paths (verify: `selectStage` is the only other writer of `selectedStageId`). If `mode` should persist for non-perfect modes, reset only when the new stage isn't perfect-clear: `mode.value = isSelectedStagePerfectClear.value ? mode.value : 'manual'` — choose and document; recommended: unconditional reset to `'manual'` (predictable, no stale armed state).
- [ ] **Step 4: Run — PASS** + type-check.
- [ ] **Step 5: Commit** `fix(stage-select): close on successful autofarm only; disarm mode on stage change`

**Dependencies:** none. **Batch:** U.

---

### Task 11: Wash/refine paid-preview honesty (E7 / T4-33)

**Scope:** the ticket domain machinery is already correct (paid roll, membership generation, snapshot revalidation, consume-on-attempt in BOTH commits). Remaining: preview rows hide rolled lines and mislabel zero-line results; WashTab keeps a dead armed "Giữ"; no unmount discard; the min-affix end of the range is ignored.

**Files:**
- Modify: `src/components/panels/equipment-hall/WashTab.vue:70-76,116-140,186-202` (discard-on-unmount, unconditional clear, rolled-list iteration), `src/core/equipment/EquipmentWash.ts:110-114` (range uses `min`), `src/core/equipment/ItemQualityBalance.ts` (no change — `min` is 0 today for all qualities; the contract fix is reading it, not changing data).
- Test: `src/core/game/GameManager.washTransaction.test.ts` (exists) for the domain contract; component-level for row rendering if WashTab mounts under jsdom — otherwise extract `washAffixCompareRows` input into a testable pure function or assert via the computed's logic on fixture data.

**Interfaces:**
- `pendingWashAffixes` = display copy from `washPreviewAffixes(ticketId)` — the **rolled** list. `selectedAffixes` = current. Compare must be indexed over `max(current.length, pending.length)`.
- `commitWashAffixes` consumes the ticket on EVERY attempt (:404 `set(null)` before validation) — the documented policy (R9/AR-21, refine-style). **Decision (record in commit message + code comment): paid tickets are consumed on any commit attempt; UI mirrors that by clearing local ticket state unconditionally.**

- [ ] **Step 1: Failing tests:**
  - Row coverage: pending has 2 lines, current has 1 → compare rows length 2 and row 2 shows `afterLabel` with no `beforeLabel` (new line row).
  - Zero-line: pending `[]`, current has 1 → row shows a dedicated "removed/rolled-none" label, NOT `panels.equipmentHall.status.notRolled` (that key means "no roll pending"). Add `panels.equipmentHall.status.removed`/`rolledNone` to both locales if needed (check first).
  - Dead-keep: `doWashKeep` with a commit that returns `false` → `pendingWashTicket` is `null` afterwards (the domain already ate the ticket; keeping it armed is the bug).
  - Unmount: `onBeforeUnmount` calls `washDiscard` when a ticket is pending (mirror `RefineTab`'s existing cleanup).
  - Domain range: `rollWashAffixes` with `random() → 0.99` yields `max` lines and `→ 0` yields `min` lines (today's mins are all 0 so the boundary test documents intent rather than changing numbers — write it anyway).
- [ ] **Step 2: Run — FAIL** (`npx vitest run src/core/game/GameManager.washTransaction.test.ts` + the component test).
- [ ] **Step 3: Implement:**
  - `washAffixCompareRows`: iterate `Math.max(selectedAffixes.length, pending.length)` positions; emit `{ before?: current[pos], after?: pending[pos] }` rows; template renders a "removed" marker when `before` exists but `after` doesn't, and a "new" marker for `after`-only rows (new locale keys, both files).
  - `doWashKeep`: `washCommit(...)` then `pendingWashTicket.value = null` unconditionally (result already surfaced via `withSyncAndResult` feedback).
  - Add `onBeforeUnmount(() => discardPendingTicket())`.
  - `EquipmentWash.rollWashAffixes`: `const range = ITEM_QUALITY_SUBSTATS_RANGE[instance.quality]; const lineCount = range.min + Math.floor(random() * (Math.min(GLOBAL_MAX_AFFIXES - 1, range.max) - range.min + 1))` — comment that min is currently 0 for every quality so this is contract-correctness, not a balance change.
- [ ] **Step 4: Run — PASS** + `npx vitest run src/core/game/GameManager.refineTransaction.test.ts` + i18n parity + type-check.
- [ ] **Step 5: Commit** `fix(equipment): honest wash previews, unified ticket lifecycle`

**Dependencies:** none. **Batch:** E.

---

### Task 12: Tooltip enhance cap (E7 / T4-34)

**Scope:** tooltip shows `+N/{template.maxEnhanceLevel}` (legacy per-item field) while slot enhance caps at `MAX_SLOT_ENHANCE_LEVEL = 100`.

**Files:**
- Modify: `src/composables/useEquipmentTooltip.ts:207`.
- Test: find the tooltip test file (`useEquipmentTooltip` tests — grep `useEquipmentTooltip` under `src/**/*.test.ts`).

- [ ] **Step 1: Failing test** — tooltip for an item in a slot with `enhanceLevel: 45` shows `+45/100`, not `+45/{template.maxEnhanceLevel}`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** — import `MAX_SLOT_ENHANCE_LEVEL` from `@/core/equipment/EnhanceCurve` (the constant's owner; `EquipmentOpsSystem.getSlotMaxEnhanceLevel` currently returns it unconditionally — if the tooltip builder has gameManager access prefer the ops getter for future per-slot variance, else the constant import is correct; check the function signature at `useEquipmentTooltip.ts:94` and pick the least-invasive correct source). Replace `template.maxEnhanceLevel` in the `Cường Hóa` row. Do not delete `Equipment.maxEnhanceLevel` — that's G-sweep scope.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `fix(tooltip): enhance row uses the slot cap`

**Dependencies:** none. **Batch:** E.

---

### Task 13: WorldAnnouncementOverlay layering + lifecycle (E8 / T4-35)

**Scope:** announcement (z 2000) sits above modals (1900) and swallows dialog clicks for up to 5s; typewriter timer not cleaned on unmount; no dismissal semantics.

**Files:**
- Modify: `src/core/presentation/OverlayLayers.ts:31-33`, `src/components/common/WorldAnnouncementOverlay.vue`, `src/stores/worldAnnouncement.ts:22-28` (store the auto-close handle so `show()`/`hide()` can clear it).
- Test: `tests/architecture/overlayLayers.test.ts` (exists — it maps components to layer entries; update/add ordering assertion), plus a component test for Escape/unmount if mountable.

**Decision (recorded):** announcements are ambient/ephemeral (auto-close, click-to-dismiss); blocking modals must win. `OVERLAY_LAYERS.announcement` drops below `modal` (e.g. `1850`, between `panel:1800` and `modal:1900`) — NOT a scoped-pointer-events hack (the scrim is intentional ceremony while no modal is up).

- [ ] **Step 1: Failing tests:**
  - Arch test: `expect(OVERLAY_LAYERS.announcement).toBeLessThan(OVERLAY_LAYERS.modal)`.
  - Component: `onBeforeUnmount` clears the interval — assert `clearInterval` called on unmount (fake timers), and `Escape` keydown hides the announcement.
- [ ] **Step 2: Run — FAIL** (`npx vitest run tests/architecture/overlayLayers.test.ts`).
- [ ] **Step 3: Implement:**
  - `OverlayLayers.ts`: `announcement: 1850` with a comment (English, matching file style) that announcements are ambient and must never cover blocking modals.
  - `WorldAnnouncementOverlay.vue`: `onBeforeUnmount(stopTyping)`; `@keydown.escape` or a document-level keydown listener (symmetric add/remove) → `store.hide()`; add `role="dialog"`/`aria-modal="true"`/`aria-live` as appropriate to the scrim while it intercepts input.
  - `worldAnnouncement.ts`: keep a module-scoped `let autoCloseHandle` inside the store action — clear it at the top of `show()` and inside `hide()` (the identity check stays as the stale-callback guard).
- [ ] **Step 4: Run — PASS** + type-check. P14: verify a modal (e.g. offline summary) isn't blocked by a firing announcement in a real browser — run inside the implementation worktree per current P14 (no deferral to a non-worktree checkout; a genuine environment failure is an explicit blocker, record the evidence).
- [ ] **Step 5: Commit** `fix(ui): announcements below modal layer, Escape + timer cleanup`

**Dependencies:** none. Dispatches alone.

---

### Task 14: Raw ids → display names (E9 / T4-36)

**Scope:** `CompanionPanel` prints `ho_ly_tinh_basic`; `BattleLogPanel` prints `actorId`/`skillId`/`targetIds`.

**Files:**
- Modify: `src/components/panels/CompanionPanel.vue:421-422`, `src/components/game/combat/BattleLogPanel.vue:40-54,64,67`.
- Reuse: `turnSkillDisplayMetaOf(id)` from `src/data/skill/TurnSkillDisplayMeta.ts` (companion skill ids are authored there explicitly for this panel); `TurnBattleParticipant.entity.name` for actor/target names.
- Locales: `companion.skills.unknown` (fallback when meta misses — never the raw id); `combat.log.*` (`turn` = `Lượt {turn}: {actor} dùng {skill}{targets}` or split keys: `entry`, `entryCcBlocked` = `Lượt {turn}: {actor} bị khóa (CC)`, `basicAttack` = `đòn thường`, `toggle` = `Nhật ký`) — add to both files.
- Test: component test `BattleLogPanel.test.ts` (new) — feed a fake `useTurnBattleInfo`/battle object; assert rendered text contains names not ids. If the composable can't be mocked cheaply, extract `describe(entry, nameOf)` to a pure helper and unit-test it.

- [ ] **Step 1: Failing tests:**
  - BattleLog: entry `{ turn:3, actorId:'wild_wolf_1', skillId:'hoa_cau_thuat', targetIds:['player'] }` renders `Hỏa Cầu Thuật` (meta name) and the participant's `entity.name` — never `hoa_cau_thuat` or `wild_wolf_1`.
  - `ccBlocked` line renders the localized string; empty `skillId` renders `basicAttack` fallback.
  - Companion: skill slot whose id has meta → meta name; unknown id → `t('companion.skills.unknown')`, never the raw id.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement:**
  - `BattleLogPanel`: build `nameOf(id)` = `battle.value?.participants.find(p => p.id === id)?.entity.name ?? t('combat.log.unknownActor')` — pull `battle` (already exported from `useTurnBattleInfo`) or extend the composable with a `participantNameOf(id)` helper; `describe()` → `t('combat.log.entry', { turn, actor, skill, targets })` with `skill = entry.skillId ? turnSkillDisplayMetaOf(entry.skillId)?.name ?? t('combat.log.unknownSkill') : t('combat.log.basicAttack')`. Toggle button text → `t('combat.log.toggle')` (keep the ▸/▾ glyph as presentation).
  - `CompanionPanel`: `turnSkillDisplayMetaOf(selected.definition[slot]!.id)?.name ?? t('companion.skills.unknown')`.
- [ ] **Step 4: Run — PASS** + i18n parity + type-check.
- [ ] **Step 5: Commit** `fix(ui): display names instead of raw skill/entity ids`

**Dependencies:** none. **Batch:** P.

---

### Task 15: Skill-level notification mojibake → `messageKey` (E9 / T4-37)

**Scope:** `GameManager.ts:~258-263` pushes `d?t c?p`/`tang ... c?p` literals; the `messageKey`/`messageParams` channel already exists (`NotificationEvent.ts`, rendered at `App.vue` and `ActionFeedbackLog.vue`).

**Files:**
- Modify: `src/core/game/GameManager.ts` (skill-level-up `notifications.push`).
- Locales: add `notifications.skillLevelUp` = `{name} đạt cấp {level}` / `{name} reached level {level}` and `notifications.skillLevelUpMulti` = `{name} tăng {gained} cấp, đạt cấp {level}` / `{name} gained {gained} levels, reaching {level}` — verify no existing key fits first (`panels.skillPath.nodeInspector.lockedReasons.skillLevel` = "cấp {level}" is a different semantic — prerequisite label, not a level-up announcement).
- Test: `NotificationQueue.test.ts` exists — add a case asserting the pushed event carries `messageKey` + `messageParams` and that `t()` resolves it in both locales (or assert via `i18nKeyParity` + a render test in `ActionFeedbackLog.test.ts` which already mounts).

- [ ] **Step 1: Failing test** — level a skill through `SkillSystem`'s level-up callback → captured `NotificationEvent` has `messageKey: 'notifications.skillLevelUp'` (or `…Multi`) with `{ name, level, gained? }` params, and `message` is a correct Vietnamese fallback (`đạt cấp`, `tăng ... cấp` — proper diacritics).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** — replace the literal with:

```ts
this.notifications.push({
  kind: 'upgrade',
  message:
    levelsGained === 1
      ? `${skill.name} đạt cấp ${skill.level}`
      : `${skill.name} tăng ${levelsGained} cấp, đạt cấp ${skill.level}`,
  messageKey: levelsGained === 1 ? 'notifications.skillLevelUp' : 'notifications.skillLevelUpMulti',
  messageParams: { name: skill.name, level: String(skill.level), gained: String(levelsGained) },
})
```

Add both keys to `vi.json` and `en.json` under a new `notifications` group.
- [ ] **Step 4: Run — PASS** + i18n parity + type-check.
- [ ] **Step 5: Commit** `fix(notifications): keyed skill-level messages, remove mojibake`

**Dependencies:** none. **Batch:** P.

---

### Task 16: Fail-closed core nits — `weightedRandom` + realm prereq (E10 / T8-71, T8-75)

**Scope:** two one-line-class defects: empty roll crashes with TypeError; unknown realm prereq silently passes.

**Files:**
- Modify: `src/core/reward/DropRoll.ts:43`, `src/core/progression/NodeSystem.ts:49`.
- Test: find/create `src/core/reward/DropRoll.test.ts` (check for an existing one first) + `src/core/progression/NodeSystem.test.ts` (exists).

- [ ] **Step 1: Failing tests:**

```ts
// DropRoll.test.ts
it('throws a descriptive error on empty entries', () => {
  expect(() => weightedRandom([])).toThrow('weightedRandom: empty entries')
})

// NodeSystem.test.ts
it('unknown prerequisite realm id does NOT pass the gate', () => {
  const node = { prerequisite: { kind: 'realm', realmId: 'realm_that_does_not_exist' }, ... }
  expect(hasPrerequisite(player, node.prerequisite)).toBe(false)
})
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement:**
  - `DropRoll.weightedRandom`: `if (entries.length === 0) throw new Error('weightedRandom: empty entries')` at the top. Also guard `totalWeight <= 0` → same throw family (`weightedRandom: non-positive total weight`) — a zero-weight table has the same `entries[-1]` crash path; add it only if a caller can actually produce it (check `resolveDrops` callers — if unreachable, keep just the empty guard).
  - `NodeSystem.hasPrerequisite` `case 'realm'`: resolve both indices; `const required = getRealmIndex(prerequisite.realmId); if (required < 0) return false` — fail closed, never silently pass. Check whether a warning channel exists in scope (`console.warn` is used elsewhere in core for content drift — match the file's convention; if the node layer has a notification dep use it, otherwise `console.warn` + comment). Also confirm the player's own `realmId` unknown case (`getRealmIndex(player.realmId) < 0`) — fail closed there too (`return false` when required >= 0 but player index < 0 is already correct via `>=`; only the prereq side needs the guard).
- [ ] **Step 4: Run — PASS** (`npx vitest run src/core/reward src/core/progression`).
- [ ] **Step 5: Commit** `fix(core): fail loudly on empty roll and unknown realm prereq`

**Dependencies:** none. **Batch:** C.

---

### Task 17: Player visual form — `the_tu` profile (E12 / T4-39, corrected)

**Scope:** audit said `phap_tu_an` falls to mortal — that path id no longer exists (v66 collapsed it into `phap_tu` + `cultivationWay:'ngo_dao'`). The real residual gap: `the_tu` is a valid `CultivationPathId` and resolves to `mortal`.

**Files:**
- Modify: `src/core/player/PlayerVisualForm.ts:8,22-31` (union + case), `src/presentation/art/PlayerVisualProfiles.ts` (add a `the_tu` profile entry reusing mortal art — the kiem_tu precedent).
- Test: find/create `src/core/player/PlayerVisualForm.test.ts`; presentation lookup test wherever `PlayerVisualProfiles` is consumed (check for an existing profile test).

**Interfaces:** `PlayerVisualProfileId = 'mortal' | 'phap_tu' | 'kiem_tu'` → add `'the_tu'`. `resolvePlayerVisualProfileId` switches on `cultivationPath`. Scenes consume the id through `playerStore.visualProfileId` → presentation lookup — the art layer owns the fallback-to-mortal-art policy, not the resolver.

- [ ] **Step 1: Failing tests:**

```ts
it('resolves the_tu to its own logical profile', () => {
  expect(resolvePlayerVisualProfileId({ cultivationPath: 'the_tu' })).toBe('the_tu')
})

it('unknown path ids still fall back to mortal', () => {
  expect(resolvePlayerVisualProfileId({ cultivationPath: 'phap_tu_an' })).toBe('mortal') // legacy id — NOT revived
})

it('every PlayerVisualProfileId has a presentation profile entry', () => {
  // iterate the union — the_tu must resolve to a profile (mortal art reuse is fine)
})
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** — add `'the_tu'` to the union, add the `case 'the_tu': return 'the_tu'`, and add a `the_tu` entry in `PlayerVisualProfiles` mirroring `kiem_tu` (all mortal art, comment noting dedicated art is future content — same comment style as the kiem_tu policy note). Do NOT add `ngo_dao`-way branching — the hidden way is a `cultivationWay` discriminator, not a path id; visual form stays keyed on `cultivationPath`.
- [ ] **Step 4: Run — PASS** + `npx vitest run tests/architecture` (art/profile guards may enumerate profiles — check `entityVisualLifecycle.test.ts`/`artExtentDeclared.test.ts` for a profile list that needs the new id).
- [ ] **Step 5: Commit** `fix(player): the_tu resolves its own visual profile id`

**Dependencies:** none. **Batch:** C.

---

### Task 18: Deferred-content roadmap section (E11 / T3-25) — docs only

**Scope:** locked decision — dead-end content stays in source, unwired and undeleted; the only change is a roadmap tracking section.

**Files:**
- Modify: `docs/roadmap.md` — new `# 0.16. Deferred content — pre-beta (audit T3-25 / spec E11)` section, inserted after `# 0.15. Roadmap operating rule` (ends ~:2378) and before `# Historical sections` (~:2379).

- [ ] **Step 1: Write the section** listing each deferred item with its current location and unblock condition:

```md
# 0.16. Deferred content — pre-beta (audit T3-25 / spec E11)

Locked decision (2026-09-16): these items stay in source, unwired and
undeleted, until the listed prerequisite lands. No gameplay wiring, no
deletion — this section is the tracking record.

- `alchemy_thong_mach_dan` — craftable pill (alchemyRecipes.ts) whose sink
  `MeridianSystem.investThongMachDan` is a parked system. Task E2 stops
  players from destroying it via the drink path. Unblock: MeridianSystem
  revival decision.
- `great_dao_seed` — gated on `requiresModifier:'boss'`, but `bandit` is
  never a `bossEnemyId` (MortalEnemies.ts / StageWaveSystem.ts). Unblock:
  boss-flag content pass.
- `heaven` / `great_dao` breakthrough grades + `pham_nhan_chi_cot`
  (BreakthroughGrades.ts:42-44, GameManagerRealmAdvanceOps.ts:429-434) —
  gated on content that doesn't exist yet. Unblock: grade-content pass.
- `phap_tu`/`kiem_tu` top-tier nodes gated on `golden_core`
  (PhapTuNodes.builders.ts:182-185) — unreachable while beta caps at
  foundation_establishment (D2 decision). Unblock: post-beta realm unlock.
- Artifact (Pháp Bảo) combat reimagine — runtime files parked by product
  decision; combat-effect advertising already removed/hidden per the
  artifact decision. Unblock: dedicated artifact rework mission.
```

- [ ] **Step 2: Verify** — `git diff docs/roadmap.md` shows ONLY the added section; no source file touched.
- [ ] **Step 3: Commit** `docs(roadmap): track deferred pre-beta content`

**Dependencies:** none (recommended last, after Tasks 1–17 land so cross-references stay accurate). Dispatches alone.

---

## Mission E done-criteria

- Kill quests + hidden-beast reset fire on template ids; material pills can't be destroyed; quest claims never debit cost without reward.
- Tribulation: per-second regen applied through the vitals owner; `getState()` hands out detached snapshots; damage numbers render from `entity_vitals_changed`; overlay text is keyed.
- Offline modal reports actual post-cap cultivation and has exactly one owner (`useAppLifecycle`).
- No stale gates: `canBuild`, building badges/tooltips, and the alchemy brew action re-evaluate on `stateVersion`; alchemy failures surface localized reasons; stage panel closes only on a real auto-farm start and disarms on stage change.
- Paid previews show exactly what will be committed (extra lines, zero-line, removed lines); one ticket-consumption policy across wash/refine; pending tickets die on unmount; tooltip shows the real slot cap.
- Announcements never cover blocking modals; Escape/unmount cleanup in place.
- No raw ids or mojibake reach the player; display names resolve through `TURN_SKILL_DISPLAY_META`/entity names; notifications use `messageKey`.
- `weightedRandom` and realm prereqs fail closed; `the_tu` resolves its own visual profile id.
- `docs/roadmap.md` has the deferred-content section; nothing deferred was wired or deleted.
- `npm run type-check` + scoped vitest green per task; P4 quick QA on the mission diff; P5 three-lens review round before merge.

## Final report (fill in at mission close)

- Total tasks: **18** (Tasks 1–18; spec items E1–E12 all mapped).
- Audit claims corrected: **T3-23** (freeze half already fixed — task scoped to mutable-state exposure + i18n), **T4-39** (`phap_tu_an` stale; real gap is `the_tu`), **T4-33** (ticket machinery already correct — task scoped to UI honesty/lifecycle), **T4-31** (partially fixed — `instance` computed already versioned), **T3-26** (actual delta already computed — task wires it into the return value).
- Concerns: `hpRegenPerTurn` reused as a per-second rate inside tribulation (documented in Task 4); wash min-range change is contract-only today (all mins are 0); `BagCell.onClick` optionality must be confirmed at implementation time (Task 2 Step 3); announcement-vs-modal ordering is a recorded product choice (Task 13).
- Confirmation: this plan is documentation-only; no non-`.md` files were modified while authoring it.
