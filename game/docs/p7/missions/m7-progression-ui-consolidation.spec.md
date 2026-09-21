# P7-M7 — Progression UI Consolidation — Spec

Status: v1 — external review UNAVAILABLE (awehitch bridge send path hard-down: 8 attempts across 2 chats + doctor-clean infra, SEND_FAILED on every send incl. `[C2C] ping`; page-side DOM verification broken). Proceeding on required gates (P3/P18/P13-14/P4/P5); retry at impl stage.
Date: 2026-09-22
Depends on: M2 (way realmRewards), M3 (canonical 0-or-1 technique), M4 (resolved roles contract), M5 (BodyProgression authority), M6 (technique-gated prerequisites)
Locked inputs: mission-graph.md M7 entry — "SkillPathPanel = way identity + technique card + node tree + resolved roles; RealmPanel = realm + body chapter subviews; remove TechniquePanel, LuyenThePanel, loadout widgets; Scripture Pavilion -> lore-only; wheel catalog + i18n updates."

---

## 1. Context and intent

M1–M6 rebuilt the progression authorities. The presentation layer still maps to the pre-consolidation world: four standalone progression overlays (`skill`, `technique`, `realm`, `luyen_the`), a Scripture Pavilion technique catalog tab, and wheel slots routing to each. The canonical state already flows through single authorities — the panels are the last duplicated surface.

M7 consolidates presentation onto those authorities. Two progression panels survive:

- **SkillPathPanel** — the "way progression" view: way identity + canonical technique card + node tree + resolved combat roles + skill library.
- **RealmPanel** — the "realm + body" view: realm identity/cultivation/breakthrough + realm passive ladder + body chapter subviews (Luyen The tiers + Bat Mach list).

Everything else retires — panel ids, mounts, wheel slots, tab state, codex tab, dead i18n. This is a presentation consolidation only: no gameplay data, formula, save-shape, or authority change (save stays v72).

## 2. Current state — evidence map

| Concern | Today | File |
|---|---|---|
| SkillPathPanel | 3-col: `SkillPathList` / `NodeTreePanel` or `SkillDetailView` / `SkillLoadoutStrip`; `NodeInspector` bottom; subtitle static `panels.skillPath.subtitle` ("Con đường Ngũ Hành" — spell-flavored, wrong for other ways) | `components/panels/SkillPathPanel.vue` |
| TechniquePanel | Standalone overlay: `TechniqueSlotCard` hero + `buildTechniqueSections` StatRows + `Nâng Cảnh` button (`realmAdvanceOps.tryAdvanceTechniqueGrade`) | `components/panels/TechniquePanel.vue` |
| LuyenThePanel | Standalone overlay: tier rows via `getBodyChapterProgress`/`getRefinementCurrentTierProgress`/`getTierCap`/`isTierRequiredRealmLevelMet` — already chapter-scoped reads (M5) | `components/panels/LuyenThePanel.vue` |
| RealmPanel | Realm identity, cultivation bar, breakthrough button, `REALM_PASSIVE_NODES` grid, `realmStatPassiveRows` | `components/panels/RealmPanel.vue` |
| Meridian UI | NONE — `meridian` chapter has no display surface; invest is `[M13 PARKED]` | `core/realm/body/MeridianChapter.ts`, `data/realm/Meridians.ts` |
| Scripture Pavilion | TabBar `scripturePavilionTab`: `TechniqueCodex` (full catalog incl. locked) / `LoreCodex` | `ScripturePavilionPanel.vue`, `scripture/TechniqueCodex.vue`, `scripture/LoreCodex.vue` |
| ui store | `scripturePavilionTab` state + `setScripturePavilionTab` action + `ScripturePavilionTab` type | `stores/ui.ts` |
| Panel ids | `StandalonePanel` includes `'technique'` + `'luyen_the'` | `presentation/contracts/panelIds.ts` |
| Mounts | `GameRoot.vue` lazy-loads both retired panels | `components/layout/GameRoot.vue` |
| Wheel | `COMMAND_WHEEL_SLOTS`: `technique` (ring 1), `luyen_the` (ring 2) — literal `label` strings, icons resolve by `slot.id` | `data/ui/commandWheelCatalog.ts` |
| Technique card | `TechniqueSlotCard` (normal/hero) — reads `techniqueManager.getActive()` directly, tooltip via `buildTechniqueSections` | `loadout-sections/TechniqueSlotCard.vue` |
| Way identity | `PathWayDefinition.name` is self-describing ('Kiếm Tu — Ngự Kiếm Tâm Kinh'); `getActiveWayDefinition(player)` is the canonical read | `core/player/CultivationPathKit.ts` |

Invariants to preserve: `Nâng Cảnh` is the only player-facing technique mutation and keeps running through `tryAdvanceTechniqueGrade` (cost/ceiling/in-combat rejects inside the op); Luyen The stays read-only auto-invest; meridian invest stays PARKED (display only, no action surface); `SkillLoadoutStrip` role display + mortal precursor chooser unchanged; node tree/inspector/skill detail unchanged; way identity read through `getActiveWayDefinition`, never a concrete way id.

## 3. Target design

### 3.1 SkillPathPanel = way progression view

- **Way identity** — subtitle slot always renders (currently `v-if="showTree"`): content = `getActiveWayDefinition(player)?.name ?? t('panels.skillPath.mortalName')` ('Phàm Nhân'). Replaces the static spell-flavored `panels.skillPath.subtitle` key (removed).
- **Technique band** — a full-width section between header and the 3-column body, rendered only when relevant:
  - `TechniqueSlotCard` (`size="hero"`, label `panels.skillPath.technique.heroLabel`) — canonical `techniqueManager.getActive()` read stays inside the card.
  - Inline detail sections (`buildTechniqueSections` StatRows, ported from TechniquePanel) + `EmptyState` when zero sections (`emptyNoBonus`).
  - `Nâng Cảnh` button with cost label — same computed trio (`gradeUpgradeCost`/`canUpgradeGrade`/`upgradeGrade`) ported verbatim, `bumpState()` on success.
  - Mortal (no technique): band collapses to the `emptyNoTechnique` EmptyState — teaches the Nhập Môn step, no dead space.
- **Right column** — `SkillLoadoutStrip` stays as the resolved Basic/Special/Ultimate display (M4 contract); mortal precursor chooser inside it unchanged. Column title key stays.
- Left column (`SkillPathList`), center (`NodeTreePanel`/`SkillDetailView` + element tabs), `NodeInspector` — unchanged.

### 3.2 RealmPanel = realm + body progression view

Existing blocks unchanged (identity/cultivation bar/breakthrough/passive nodes/stat rows). Below them, one "body progression" area with two chapter subviews:

- **`realm/BodyRefinementSection.vue`** — the LuyenThePanel tier block ported verbatim: summary `{completed}/6`, note line, tier rows (name/stats/desc/lock line/progress bar/percent) driven by the same chapter-scoped reads. `EmptyState` when complete (`empty` key).
- **`realm/MeridianSection.vue`** — NEW read-only view over `MERIDIANS` × `player.bodyProgression.meridian.openedIds` (read via `getBodyChapterProgress(player.$state,'meridian')` + the chapter slice for row state — the panel-level read mirrors LuyenThePanel's pattern: `getBodyChapterProgress` for the count, chapter state for per-row membership):
  - Per-row state: `opened` (id in openedIds) / `next` (index === openedIds.length; shows `thongMachDanCost` + `requiredRealmLevel`) / `locked` (later). `requiresThienDiaChiKieu` on the last meridian shown as part of the next-row requirement line.
  - Summary `opened/total`; stat labels via `statLabel()`; description per meridian.
  - NO invest action (M13 parked) — rows are status display only.

### 3.3 Retirements — removed, not hidden

- Deleted files: `TechniquePanel.vue`, `LuyenThePanel.vue`, `scripture/TechniqueCodex.vue`.
- `StandalonePanel`: `'technique'` + `'luyen_the'` removed from the union — dead routes leave the type, not just the catalog.
- `GameRoot.vue`: async imports + mounts for both removed.
- `commandWheelCatalog.ts`: `technique` + `luyen_the` slots deleted (ring 1 -> Nhân Vật/Cảnh Giới/Kỹ Năng; ring 2 -> Nhiệm Vụ/Pháp Bảo/Phù(future)/Trận/Đồng Đội).
- `ui.ts`: `scripturePavilionTab` state + `setScripturePavilionTab` + `ScripturePavilionTab` type removed.
- `ScripturePavilionPanel.vue`: TabBar removed; renders `LoreCodex` directly (lore-only).
- `loadout-sections/` dissolves: `NodeTreePanel.vue`, `SkillConnections.vue`, `TechniqueSlotCard.vue` move to `components/panels/skill-path/` (the surviving feature folder); import paths updated (`git mv`, mechanical).

### 3.4 i18n

- `panels.technique.*` (4 keys) -> `panels.skillPath.technique.*` — namespace follows the new home; `title` becomes the band's section label.
- `panels.luyenThe.*` (5 keys) -> `panels.realm.bodyRefinement.*` — same rule.
- New `panels.realm.meridian.*`: `title`, `summary` ({completed}/{total}), `stateOpened`/`stateNext`/`stateLocked`, `cost` ({count} Thông Mạch Đan), `realmGate` (Phàm Nhân tầng {level}), `auxGate` (cần Thiên Địa Chi Kiều).
- New `panels.skillPath.mortalName` ('Phàm Nhân'); `panels.skillPath.subtitle` removed; `panels.scripture.tabs` removed; `panels.skillPath.technique.*` per §3.4-1.
- en.json mirrors vi.json key-for-key.

### 3.5 Component map (new/changed)

| File | Disposition |
|---|---|
| `panels/SkillPathPanel.vue` | + technique band + way identity; NodeTreePanel import repointed |
| `panels/skill-path/TechniqueBand.vue` (new) | hero card + sections + Nâng Cảnh + mortal empty state |
| `panels/RealmPanel.vue` | + body progression area mounting the two sections |
| `panels/realm/BodyRefinementSection.vue` (new) | ported tier block |
| `panels/realm/MeridianSection.vue` (new) | read-only meridian list |
| `panels/skill-path/{NodeTreePanel,SkillConnections,TechniqueSlotCard}.vue` | moved from `loadout-sections/` |
| `panels/{TechniquePanel,LuyenThePanel}.vue`, `scripture/TechniqueCodex.vue` | deleted |
| `ScripturePavilionPanel.vue` | TabBar removed, LoreCodex direct |
| `stores/ui.ts`, `panelIds.ts`, `commandWheelCatalog.ts`, `GameRoot.vue` | retired-member removal |

`useTechniqueSections.ts` stays (card tooltip + band sections). `SkillLoadoutStrip` stays untouched.

## 4. Explicit non-goals

- No gameplay/save changes — v72 unchanged, no migration.
- No meridian invest UI (M13 parked) — the section is display-only.
- No technique catalog relocation — the codex dies with the tab; the canonical technique is already fully visible on its card (locked-catalog browsing was a preview, not progression state).
- No SkillLoadoutStrip/NodeInspector/NodeTree behavior changes.
- No wheel ring re-layout beyond slot removal (layout is data-driven by index).
- No QuanKhi/Character/Companion panel changes.

## 5. Test plan (summary — plan details)

- SkillPathPanel: way identity line (way name vs Phàm Nhân), technique band renders active technique + sections + cost label, grade button calls `tryAdvanceTechniqueGrade`, mortal empty state.
- RealmPanel: BodyRefinementSection rows (done/active/realm_locked/locked + summary), MeridianSection rows (opened/next/locked + aux note on Kỳ Kinh), both via fixture player state.
- ScripturePavilionPanel: no tabs, LoreCodex mounts.
- Wheel: catalog no longer exposes `technique`/`luyen_the`; existing slot tests updated.
- Type-level: `StandalonePanel` union no longer admits retired ids (compile-enforced); ui store `scripturePavilionTab` gone.
- Move sweep: `loadout-sections/` gone, imports resolve, InkWashMediumSurfaces test repointed.

## 6. Open questions

None blocking. Notes for review:
- MeridianSection reads `bodyProgression.meridian.openedIds` directly for per-row membership (same pattern as LuyenThePanel reading chapter state for row progress) — `getBodyChapterProgress` supplies the count; a membership helper is not added just for display.
- Technique inline sections are kept (not tooltip-only) — preserves TechniquePanel's information density and serves touch users with no hover.
