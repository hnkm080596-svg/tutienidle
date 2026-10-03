# Art Requests — Scene 07 · Skill Tree / Kỹ Năng (Huyền Kim)

One row per art asset Minh must draw or confirm. Every scaffold surface marked `class="art-needed"` carries the same `data-art-id` shown here.

Reference: `game/docs/design/references/huyen-kim/scenes/07-skill.jpg`.
Design space: 1672×941 (runtime 1280×720, ×0.7655). Scene regions per `huyen-kim-scene-layout-spec.json` scene 07.
Palette anchors: ink `#101718` · jade `#315f55` · muted gold `#b99a55` · ivory paper. Element identity colors stay on the existing `--el-*` tokens.

## Art inventory

| # | Component | data-art-id | Design-px size (w×h) | Type | Visual description (per ref) | Layer / stack order |
|---|-----------|-------------|----------------------|------|------------------------------|---------------------|
| 1 | `SkillTreeCanvas` → `NodeTreePanel` | `skill-tree-00-sky` *(delivered)* | 640×470 region (canvas-sized) | vista | Night-sky ink wash behind the constellation tree | Parallax L0 (order 0, static, opaque base) |
| 2 | `SkillTreeCanvas` → `NodeTreePanel` | `skill-tree-01-far-mountains` *(delivered)* | 640×470 | vista | Far ink-mountain silhouettes under the star field | Parallax L1 (order 1, far-slow, drift ≤3×2) |
| 3 | `SkillTreeCanvas` → `NodeTreePanel` | `skill-tree-02-celestial-field` *(delivered)* | 640×470 | vista | Gold constellation/star field the orbit nodes sit in | Parallax L2 (order 2, celestial-slow, drift ≤5×2) |
| 4 | `SkillTreeCanvas` → `NodeTreePanel` | `skill-tree-03-atmosphere` *(delivered)* | 640×470 | vista | Low mist/glow atmosphere at the canvas base | Parallax L3 (order 3, ground, drift ≤8×4) |
| 5 | `SkillWayCard` | `skill-way-emblem` | ~72×72 | chrome | Flaming way emblem — ornate ring, fire/spirit glyph per the committed way (ref's flame disc); temp uses delivered `skill` symbol | Card top, left of identity |
| 6 | `SkillWayCard` | `skill-help-orb` | ~16×16 | chrome | Small '?' help dot beside the identity line | Card top-right |
| 7 | `SkillElementTabs` | `skill-element-tab-seal` | ~86×34 | chrome | Swallowtail seal tab per Ngũ Hành element; tint per element, committed = filled glow, selected = outline | element-tabs row |
| 8 | `SkillModeTabs` | `skill-mode-tab-seal` | ~86×34 | chrome | Same tab-seal family for Tree/Detail toggle; selected = jade | mode-tabs row |
| 9 | `NodeTreePanel` nodes | `skill-orbit-node` (suggestion) | ~56×56 | chrome | Ref's ornate orbit medallions: flame/lotus/rune glyph in a gold ring w/ Lv badge + padlock overlay for locked | Tree z2 (runtime `rune-node` mask today — draw per-state ring set) |
| 10 | `NodeTreePanel` edges | `skill-edge-glow` (suggestion) | variable | prop | Glowing gold connecting lines between orbit medallions (ref's light-veins) | Tree z1 under nodes (runtime `SkillConnections` strokes today) |
| 11 | `SkillDetailRail` | `skill-detail-skillicon` (suggestion) | ~64×64 | prop | Per-skill art tile for the detail header (ref's "Viêm Long Trảo" claw icon); runtime shows text header only | Detail top-left |

## Covered by delivered chrome (no drawing needed)

| Component surface | Delivered asset |
|---|---|
| Detail rail / way-column panel | `surface-m-panel` (ready) |
| Element + mode tabs | `tab-seal` (ready, tintable — element/jade tint) |
| Tree node glyph | `rune-node` (ready, tintable — state-tinted mask) |
| Node inspector rows | `list-row` (ready) |
| "Tăng Cấp" upgrade CTA | `button-ceremonial` via `GameButton` (ready) |
| Cost/state chips | `seal-chip` (ready) |
| Way emblem inner glyph | `skill` stable symbol (delivered) |
| Scroll envelope, rollers, plaque, close, nav rail | shared `imperial-scroll` shell (sibling work) |

## Flagged ambiguities — coordinator decisions needed (not self-decided)

| Ref element | Finding | Action taken |
|---|---|---|
| Radial core+orbit layout (center "Hỏa Tâm Quyết Lv 3/10" + ring of orbit nodes) | Audit: EXACT pattern / CORRECTED data — center = way core, orbit = branch nodes. Canonical layout is `skillGraphLayout` (columnar depth tree inside `NodeTreePanel`); a true radial layout is a layout-engine change beyond scaffold. | Kept canonical layout; flagged — needs coordinator call on whether a radial engine pass is in scope. |
| Way flavor paragraph ("Lấy Hỏa làm gốc…") | `PathWayDefinition` has no description field — no canonical source. | Omitted from `SkillWayCard`; flagged (needs authored per-way text). |
| Ref currencies ("Hỏa Nguyên Quyển 12/5", "Linh Khí 328.4K") | Invented per audit — real costs = skillInsight/materials via `NodeInspector`. | Kept canonical cost rows. |
| Ref role tag "Kỹ Năng Cơ Bản" + current/next effect cards | Detail surface = `NodeInspector` (node rows + gates) or `SkillDetailView`; no role tag on detail today. | Kept canonical detail; role-grammar rows exist on `SkillRoleStrip` below (beta-filtered: Ultimate hidden). |
| Q/W hotkey badges | RESERVED per audit (unverified). | Not scaffolded. |
| Ultimate slot | Hidden in beta per `betaCombatRolesFor`. | Not rendered. |
