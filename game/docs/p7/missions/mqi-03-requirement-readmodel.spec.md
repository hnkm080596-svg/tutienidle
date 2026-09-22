# M-QI-03 — Breakthrough Requirement Read-Model — spec v2

## 1. Mission

`game/docs/p7/mission-graph.md` row M-QI-03 (depends on M-QI-02, merged `09593b86`): "Normal UI shows exactly `[LQ tầng 12]` + `[Chương 10 hoàn thành]`; hidden foundation inputs never surface."

Locked ruling (`decisions.md` QI-D6): the two mandatory admission inputs are the only requirement lines a normal player ever sees; the hidden foundation/grade inputs (`truc_co_dan`, body tiers, meridian completion, perfection, talents) stay resolver-internal.

## 2. Evidence (G0)

Current state, verified against `master` @ `91222373`:

- `canTriggerBreakthrough` (`GameManagerRealmAdvanceOps.ts`, post-M-QI-02) is the single admission authority: mortal → `realmLevel >= CORE_REALM_LEVEL`; qi_refining → that AND `completedStageIds.includes(QI_REFINING_BREAKTHROUGH_STAGE_ID)`; else `false`.
- `RealmPanel.vue:31` derives only `canBreakthrough` — a disabled button gives the player NO explanation of what's missing. No requirement lines exist anywhere in normal UI.
- `BreakthroughRequirementPanel.vue` is a post-eligibility confirm dialog ("Độ kiếp cũng là độ thân" + confirm/cancel) — opens only when `canBreakthrough` is already true, so it is the wrong surface for unmet requirements.
- Hidden foundation inputs exist and DO affect the tribulation grade (`startTribulation` resolves human/earth/heaven/great_dao from `truc_co_dan`, `bodyProgression.body_refinement.completedTiers`, meridian `openedIds`, `mortalPerfectionAchieved`, talents) — per QI-D6 none of these may appear in the normal requirement UI.
- Stage display names come from `STAGES` data (`Stages.ts`); the pinned final stage renders as "Quật 10". `QI_REFINING_BREAKTHROUGH_STAGE_ID` is exported from `realmSystem.ts`.
- i18n is the display-string authority; `RealmPanel` already uses `t()` everywhere; `MeridianSection` precedent shows components read data catalogs directly when needed.

## 3. Contract

### 3.1 Domain read-model — single source for both gate and UI

`GameManagerRealmAdvanceOps` gains:

```ts
interface BreakthroughRequirementRow {
  key: 'level' | 'chapterClear'
  met: boolean
}

getBreakthroughRequirements(player: PlayerData): BreakthroughRequirementRow[]
```

- `mortal` → `[{ key:'level', met: realmLevel >= CORE_REALM_LEVEL }]`
- `qi_refining` → `[{ key:'level', ... }, { key:'chapterClear', met: completedStageIds.includes(QI_REFINING_BREAKTHROUGH_STAGE_ID) }]`
- anything else → `[]`

`canTriggerBreakthrough` is re-expressed over the read-model — `requirements.length > 0 && requirements.every(r => r.met)` — so the admission gate and the UI can never diverge (one predicate owner; the M-QI-02 boolean outcomes are preserved exactly).

The mortal row exists for gate-delegation only — it is a domain contract, not a UI surface (see §3.2 scope).

### 3.2 UI surface — RealmPanel requirement block (Trúc Cơ scope only)

The visible requirement block is scoped to the **normal Trúc Cơ gate** per the locked ruling: it renders inside `realm-panel__actions`, under the breakthrough button, **only when `player.realmId === 'qi_refining'`**. Mortal and `foundation_establishment`+ render no requirement block — the mission's UI surface is exactly the two Trúc Cơ lines, and the mortal "Quán Khí" flow keeps its current line-less presentation (a mortal requirement UI would be a separate product decision, not this mission).

- Per-row line: status marker (met/unmet) + label text.
- `level` label → `t('panels.realm.requirements.level', { realm: <current realm name>, level: 12 })` — renders "Luyện Khí tầng 12".
- `chapterClear` label → `t('panels.realm.requirements.chapterClear')` — renders exactly the locked ruling text **"Chương 10 hoàn thành"** (en: "Chapter 10 complete"). The label is an i18n-owned semantic string; the pinned `QI_REFINING_BREAKTHROUGH_STAGE_ID` stays the domain predicate identity and is NOT used to derive display text (stage leaf names are Vietnamese content — interpolating them would corrupt the English locale).
- Unmet rows render visually distinct (muted/✗); met rows satisfied (✓).
- Rows are reactive (`computed`) — clearing the stage or gaining the level flips the marker live.

### 3.3 Hidden-input exclusion (acceptance invariant)

The requirement block must render EXACTLY the read-model rows — never `truc_co_dan`, body-refinement tier, meridian, perfection, or talent text. A test asserts the block's text equals only the expected labels.

### 3.4 Explicit non-changes

- `BreakthroughRequirementPanel` (confirm dialog) — unchanged; it post-dates eligibility.
- `startTribulation`, grade resolution, hidden inputs — unchanged, stay internal.
- Save shape, stage data, `completedStageIds` writer — unchanged.
- `canTriggerBreakthrough` semantics — identical outcomes for every input; only its implementation delegates to the read-model.
- No new stores; read-model is a pure ops method like `investBodyChapter`.

## 4. Test invariants

Domain (`GameManager.progressionScope.test.ts` or a dedicated block):

1. mortal L11 → `[level:unmet]`; L12 → `[level:met]`; gate agrees.
2. qi_refining L12 no clear → `[level:met, chapterClear:unmet]`; with clear → both met.
3. qi_refining L11 with clear → `[level:unmet, chapterClear:met]`.
4. `foundation_establishment`/`golden_core` → `[]` and gate `false`.
5. `canTriggerBreakthrough` outcomes unchanged across the matrix (delegation preserves M-QI-02).

UI (`RealmPanel.test.ts`):

6. qi_refining L12 no clear → renders exactly 2 lines; level shows met, chapter shows unmet; button disabled. Seed clear → chapter flips met; button enabled.
7. mortal (any level) → requirement block does NOT render (Trúc Cơ-scoped surface); `foundation_establishment` → also absent. The mortal gate outcome itself stays pinned by domain oracles 1/5.
8. Requirement block text contains none of: `truc_co_dan`, `Trúc Cơ Đan`, `Luyện Thể`/body-tier, `Kinh Mạch`/meridian, `Hoàn Mỹ`/perfection, talent names — only the read-model labels.

## 5. Files

- `src/core/game/GameManagerRealmAdvanceOps.ts` — `getBreakthroughRequirements` + `canTriggerBreakthrough` delegation + type export.
- `src/components/panels/RealmPanel.vue` — requirement block (markup + minimal scoped CSS matching panel conventions).
- `src/locales/vi.json`, `src/locales/en.json` — `panels.realm.requirements.{level,chapterClear,met,unmet}` keys.
- `src/core/game/GameManager.progressionScope.test.ts` — read-model cases.
- `src/components/panels/RealmPanel.test.ts` — rendering + hidden-input exclusion.
