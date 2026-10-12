# Audit — Thanh Van stage naming (2026-10-12)

Owner ruling: every ai on the merged Thanh Van vista is displayed as
`Thanh Vân 1-N`, N = global index 1..30 in `zones[thanh_van].stageIds`
(mortal_dong_1..10 -> 1-1..1-10, qi_refining_* -> 1-11..1-20,
foundation_floor_* -> 1-21..1-30). No `Chương 1/2/3` + per-chapter
floors. Domain ids (`stage.id`, `stage.chapter`, `stage.floor`,
zone ids) unchanged — display naming only.

## Surface inventory (location -> shows today -> should show)

| Location | Shows today | Should show |
|---|---|---|
| `src/data/stage/Stages.ts` `names()` -> `stage.name` (feeds every name surface below) | `Động N` (mortal), `Quật N` (qi), `Màn 3.N` (foundation) | `Thanh Vân 1-N` (global index) |
| `ExplorationSurface.vue` `paperStage.title` -> inspector `.stage-title` | `1-3 Động 3` (`${chapter}-${floor} ${name}`) | `Thanh Vân 1-3` (name only) |
| `ExplorationSurface.vue` `paperStage.chapter` -> inspector `.chapter-name` | `Chương 1 · Luyện Khí` (`chapterPrefix` + realm) | `Thanh Vân · Luyện Khí` |
| `ExplorationPaperMap.vue` node `aria-label` via `exploration.stageLabel` | `Thanh Vân · Tầng 3 · Đã Phá` (stage = per-chapter floor 1-10) | `Thanh Vân 1-3 · Đã Phá` (stage = unified name) |
| `disabledReasonLabel.ts` floor case -> `panels.stageSelect.locked.clearFloor` | `Hoàn thành Tầng 10 trước` (prev stage's per-chapter floor) | `Hoàn thành Thanh Vân 1-10 trước` (prev stage's name) |
| `panels.stageSelect.locked.progress` | `Hoàn thành tầng trước để mở khóa` | `Hoàn thành ải trước để mở khóa` |
| `panels.realm.requirements.chapterClear` (realm gate row, `qi_refining_abyssal_pool`) | `Chương 10 hoàn thành` | `Hoàn thành Thanh Vân 1-20` |
| `exploration.armedFarm` row + `AutoFarmIndicator` `autoFarm.running` | `Đang tự động: Động 3` | `Đang tự động: Thanh Vân 1-3` (auto via stage.name) |
| `CombatTopBar.vue` title | `Động 3` | `Thanh Vân 1-3` (auto via stage.name) |
| `CombatIntroOverlay.vue` | `Thanh Vân • Động 3` | `Thanh Vân • Thanh Vân 1-3` (auto; zone•ai format kept — slight redundancy, owner may trim) |
| `useVictorySceneModel.stageName` -> VictoryScene + CombatDefeatPanel subtitle | `Động 3` | `Thanh Vân 1-3` (auto via stage.name) |
| `QuaTangTab.vue` `quaTang.context.stageCompleted` | `Vượt Động 10 — tặng đồng đội` | `Vượt Thanh Vân 1-10 — …` (auto via stage.name) |
| `src/data/quest/quests.ts` descriptions (7 lines) | `Động 4–6`, `Quật 1–3/4–6/7–9/10` | `Thanh Vân 1-4 đến 1-6`, `Thanh Vân 1-20`, … |
| `ui-preview/explorationMessages.ts` `stageLabel` + `ExplorationPreview.vue` fixture labels | `{chapter} · Tầng {stage}`, node label `1..30`, title `{code} · Sườn Thanh Vân` | mirror production |
| `exploration.chapters` nav aria-label | `Chương` | kept — rail is still a chapter-card rail (one `Thanh Vân` card) |
| `panels.stageSelect.*` old-panel keys (aria.filters, zoneFilter, chapterFilter, floorPrefix, sections, empty, progress.title, eliteChance) | dead keys in locales | left in place (no src consumer) |

## Out of scope (chapter/floor wording, different domain)

- `onboarding.chapter.*`, `tribulation.overlay.chapter`, `body.chapters`,
  `panels.body.chapters.*` — tutorial/tribulation/body chapters, not ai naming.
- `panels.stageSelect.locked.requireRealm` (`Cần {realm} tầng {level}`) —
  realm-level gate, not a stage name.
- `RealmPanel` `Tầng N / 18` — realm levels.
- ThienCo entries (`useThienCoEntries.ts`) — no stage-name references.
- `panels.realm.requirements.chapterClear` gate predicate — only its label changes.
