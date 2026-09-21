# P7-M7 — Progression UI Consolidation — Plan

Status: draft v1 (external review unavailable — awehitch send path down; see spec status)
Spec: `m7-progression-ui-consolidation.spec.md`
Depends on: M2–M6 committed. Pure presentation consolidation — save stays v72.

## Task order (TDD — test first each task)

### T1 — i18n key relocation (foundation for T2/T3)

Mechanical, no test needed (key renames verified by the T2/T3 suites):

1. `locales/vi.json` + `en.json`, key-for-key parity:
   - `panels.technique.*` (title/heroLabel/emptyNoBonus/emptyNoTechnique) → `panels.skillPath.technique.*`
   - `panels.luyenThe.*` (title/summary/note/tierLock/empty) → `panels.realm.bodyRefinement.*`
   - `panels.skillPath.subtitle` → deleted (replaced by data-driven way identity)
   - new `panels.skillPath.mortalName` = 'Phàm Nhân'
   - new `panels.realm.meridian.*`: `title` ('Kỳ Kinh Bát Mạch'), `summary` ('Đã mở: {completed}/{total}'), `stateOpened` ('Đã mở'), `stateNext` ('Kế tiếp'), `stateLocked` ('Chưa mở'), `cost` ('{count} Thông Mạch Đan'), `realmGate` ('Phàm Nhân tầng {level}'), `auxGate` ('cần Thiên Địa Chi Kiều')
2. TechniquePanel/LuyenThePanel still exist at this point — their `t('panels.technique.*')`/`t('panels.luyenThe.*')` calls move to the new keys in the same commit (deleted in T4; keeping the tree green between tasks).

### T2 — TechniqueBand + way identity (SkillPathPanel)

**Tests first** — new `components/panels/skill-path/TechniqueBand.test.ts` (jsdom mount pattern from M6 `NodeInspector.test.ts`: createApp+h+provide, real i18n, pinia player, GAME_MANAGER_KEY stub, STATE_VERSION/BUMP keys):

- Player with a technique → renders hero card region + at least one section row + grade button with cost label.
- `upgradeGrade` click → stub `realmAdvanceOps.tryAdvanceTechniqueGrade` called once; `bumpState` invoked on success only.
- No technique (mortal) → `emptyNoTechnique` EmptyState, no button.
- `canUpgradeGrade` false (insufficient material / rank<10 / ceiling) → button disabled.

**SkillPathPanel test additions** (existing or new file):

- Way identity line: fixture `sword:sword_pathway` player → subtitle shows the way `name`; mortal player → 'Phàm Nhân'.

**Implementation:**

1. `panels/skill-path/TechniqueBand.vue` — ports TechniquePanel's script block verbatim (equippedTechnique/techniqueSections/gradeUpgradeCost/canUpgradeGrade/materialName/ownedAmount/upgradeGrade via `useGameManager`+`useStateVersion`); template = hero `TechniqueSlotCard` + sections StatRows + EmptyState(emptyNoBonus) + grade button OR `EmptyState(emptyNoTechnique)` when no technique. Keys under `panels.skillPath.technique.*`.
2. `SkillPathPanel.vue` — subtitle slot: always render, content `wayIdentity` computed (`getActiveWayDefinition(player)?.name ?? t('panels.skillPath.mortalName')`); mount `<TechniqueBand />` between `__body` columns and `NodeInspector` (full-width band above the 3 cols — actually above `__body`, under header: a dedicated `.skill-path-panel__band` row); import repointed for moved NodeTreePanel (T4 does the git mv — import path updated there).

Layout note: band sits between subtitle and `__body` (`flex: 0 0 auto`), `__body` keeps `flex: 1 1 auto`.

### T3 — RealmPanel body chapter sections

**Tests first** — `components/panels/realm/` (new test file `RealmBodySections.test.ts` or extend `RealmPanel.test.ts` — check existing file first):

- BodyRefinementSection: fixture `bodyProgression.body_refinement {completedTiers:1,currentTierProgress:10}` mortal rl:5 → summary '1/6', row[0] done, row[1] active w/ progress, row[2+] realm_locked or locked.
- MeridianSection: `openedIds:['nham_mach','doi_mach']` → summary '2/9', row[0..1] opened, row[2] next (cost + realmGate shown), row[3+] locked; `ky_kinh_thien_dia_chi_kieu` row shows auxGate when it is `next`.

**Implementation:**

1. `panels/realm/BodyRefinementSection.vue` — verbatim port of LuyenThePanel's computed block (activeTierIndex/tierUnlocked/chapterProgress/tierRows) + tier markup/styles, panel chrome stripped (no OverlayPanel, no close()); keys `panels.realm.bodyRefinement.*`.
2. `panels/realm/MeridianSection.vue` — `MERIDIANS` × `openedIds`: `progress = getBodyChapterProgress(player.$state,'meridian')`; row state = `opened` (id ∈ openedIds) / `next` (index === completed) / `locked`; next row shows `cost` + `realmGate` + `auxGate` when `requiresThienDiaChiKieu`; stats via `statLabel()`; display-only.
3. `RealmPanel.vue` — `.realm-panel__body` block after `__passives`: section titles via `Eyebrow`, mount both components.

### T4 — Retirements + file moves

**Implementation** (deletion sweep — compile-checked):

1. `git mv` `panels/loadout-sections/{NodeTreePanel,SkillConnections,TechniqueSlotCard}.vue` → `panels/skill-path/`; fix imports (SkillPathPanel, TechniqueBand, InkWashMediumSurfaces.test, NodeTreePanel's `./SkillConnections.vue` stays relative); `rmdir loadout-sections`.
2. Delete `TechniquePanel.vue`, `LuyenThePanel.vue`, `scripture/TechniqueCodex.vue`.
3. `panelIds.ts` — drop `'technique'`/`'luyen_the'` from `StandalonePanel` (compile error surfaces any leftover consumer — fix all).
4. `GameRoot.vue` — remove both defineAsyncComponent + mounts.
5. `commandWheelCatalog.ts` — delete `technique` + `luyen_the` slot entries.
6. `ui.ts` — remove `scripturePavilionTab` state + `setScripturePavilionTab` + `ScripturePavilionTab` type.
7. `ScripturePavilionPanel.vue` — remove TabBar + tab binding; render `<LoreCodex />` directly; delete `panels.scripture.tabs` from both locales.
8. Stale-comment sweep on touched files (ASCII ratchet — new comments ASCII-only).

**Test updates** (same task): grep-and-fix every test referencing retired ids —
`DongFuCommandWheel.test.ts` (technique/luyen_the slot assertions), `ScripturePavilionPanel` tests (tab expectations → lore-only), `ui.ts` tests (scripturePavilionTab), `InkWashMediumSurfaces.test.ts` (import path), any `standalonePanel === 'technique'|'luyen_the'` fixture.

### T5 — Sweep + full verification

- Production grep sweep: zero refs to `TechniquePanel|LuyenThePanel|TechniqueCodex|scripturePavilionTab|loadout-sections|'technique'|'luyen_the'` outside history comments.
- `npm run verify` (full — Pinia ui-store state change + panel topology).
- P18 OCR over the diff → P13/P14 runtime (open wheel, each surviving panel; technique band grade button; realm body sections; scripture lore-only) → P4 QA → P5 → external review retry → commit.

## Cross-cutting

- Way identity must resolve through `getActiveWayDefinition` — never a way-id literal in the template.
- Technique reads stay inside `techniqueManager.getActive()`; body reads stay chapter-scoped (`getBodyChapterProgress` + chapter helpers) — the UI adds no new authority.
- ASCII ratchet: every NEW comment line ASCII-only (translate-or-drop Vietnamese in ported comments — same convention as M4/M5/M6 touched-line rule: lines I author must be ASCII; untouched ported lines keep their bytes).
- Deleted-panel orphans: `useTechniqueSections` survives (band + card tooltip); `LoreCodex` survives.
