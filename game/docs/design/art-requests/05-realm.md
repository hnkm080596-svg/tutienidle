# Art Requests — Scene 05 · Realm Ladder / Thiên Lộ (Huyền Kim)

One row per art asset Minh must draw or confirm. Every scaffold surface marked `class="art-needed"` carries the same `data-art-id` shown here.

Reference: `game/docs/design/references/huyen-kim/scenes/05-realm.jpg`.
Design space: 1672×941 (runtime 1280×720, ×0.7655). Scene regions per `huyen-kim-scene-layout-spec.json` scene 05.
Palette anchors: ink `#101718` · jade `#315f55` · muted gold `#b99a55` · ivory paper.

## Art inventory

| # | Component | data-art-id | Design-px size (w×h) | Type | Visual description (per ref) | Layer / stack order |
|---|-----------|-------------|----------------------|------|------------------------------|---------------------|
| 1 | `RealmAscentMap` | `realm-ascent-00-sky` *(delivered)* | 812×610 | vista | Night-sky wash + moon haze behind the ascent vista | Parallax L0 (order 0, static, opaque base) |
| 2 | `RealmAscentMap` | `realm-ascent-01-far-mountains` *(delivered)* | 812×610 | vista | Farthest layered mountain silhouettes in mist | Parallax L1 (order 1, far-slow, drift ≤3×2) |
| 3 | `RealmAscentMap` | `realm-ascent-02-mid-ascent` *(delivered)* | 812×610 | vista | Mid-ground ascending ridge the trail climbs | Parallax L2 (order 2, mid, drift ≤6×3) |
| 4 | `RealmAscentMap` | `realm-ascent-03-summit-architecture` *(delivered)* | 812×610 | vista | Golden summit pagoda cluster at the path's top (the goal) | Parallax L3 (order 3, ground, drift ≤8×4) |
| 5 | `RealmAscentMap` | `realm-ascent-04-low-mist` *(delivered)* | 812×610 | vista | Valley cloud/mist banks crossing the lower path | Parallax L4 (order 4, mist-slow, drift ≤10×5) |
| 6 | `RealmAscentTrack` | `realm-path-trail` | ~4×560 | prop | Luminous winding trail the medallions ride — climbed share glows jade, unclimbed stays ink; ref shows a gently curving light-vein, not a straight line | Track z under medallions |
| 7 | `RealmAscentTrack` | `realm-summit-mist` | ~220×46 | prop | Soft mist veil at the top of the track — the release-ceiling rungs fade into it | Track overlay above spine, under node content |
| 8 | `RealmAscentNode` | `realm-node-medallion` | ~46×46 | chrome | Circular rune medallion (delivered `rune-node` glyph + ornate ring) carrying the rung ordinal; states: jade filled complete, jade pulse current, gold trace next, ink locked/future | Node z1, centered on trail |
| 9 | `RealmAscentNode` | `realm-banner-plaque` | ~34×120 | chrome | Vertical hanging realm banner (ref's "Trúc Khí"/"Trúc Cơ" plaques): narrow dark plaque, pointed swallow-tail bottom, upright realm name, gold header pin | Beside medallion, alternating sides of trail |
| 10 | `RealmIdentityCard` | `realm-medallion` | ~96×96 | chrome | Ornate circular realm medallion — glowing crystal-mountain glyph inside a gold ring (ref's card emblem); temp uses the delivered `realm` symbol | Card top-left |
| 11 | `RealmCultivationBar` | `realm-icon-flame` | ~20×20 | chrome | Flame glyph for the "Tốc Độ Tu Luyện" rate chip; icon-set gap | Inline, left of chip text |
| 12 | `RealmCultivationBar` | `realm-icon-hourglass` | ~20×20 | chrome | Hourglass glyph for the "Ước Tính" ETA chip; icon-set gap | Inline, left of chip text |
| 13 | `RealmSectionTitle` | `realm-section-gem` | ~12×12 | chrome | Small gold lozenge/diamond bullet before each rail section title | Inline before title text |

## Covered by delivered chrome (no drawing needed)

| Component surface | Delivered asset |
|---|---|
| Right rail panel | `surface-m-panel` (ready) |
| Cultivation progress bar | `entity-bar` via `Bar` (ready, tintable) |
| Passive rows | `list-row` (ready) |
| Requirement chips | `seal-chip` (ready, tintable — jade met / cinnabar unmet) |
| Đột Phá CTA | `button-ceremonial` via `GameButton lg` (ready) |
| Node glyph inside medallion | `rune-node` (ready, tintable — mask-tinted per state) |
| Medallion inner glyph | `realm` stable symbol (delivered) |
| Scroll envelope, rollers, plaque, close, nav rail | shared `imperial-scroll` shell (sibling work) |

## Flagged ambiguities — coordinator decisions needed (not self-decided)

| Ref element | Finding | Action taken |
|---|---|---|
| Bottom realm stepper "Luyện Khí Tầng 1-18 → Trúc Cơ Tầng 1-18" | Not a scene-05 spec region — maps to the shared `imperial_scroll` `footer-safe` band (288/794/1244/56). Also no canonical "floor 1-18 per realm" read-model for a stepper. | NOT scaffolded — shared-shell surface, out of scope. |
| Realm description line under the title ("Hấp thu linh khí trời đất…") | Audit says EXACT, but `RealmData` has no description field — no canonical source. | Omitted; flagged for design (needs authored per-realm text). |
| Material requirement chips (Linh Thạch 12k/10k, Thanh Linh Thảo, Ngưng Khí Đan) | Ref invents material gates; canonical model returns only `level` + `chapterClear` rows. | Rendered real gate rows as seal chips; material chips not built. |
| Ref's numbered rungs 1–18 (per-realm floors) | Canonical ladder = realm RUNGS (`betaRealmLadderNodes()` — mortal + Kiến Cơ + Trúc Cơ in beta), not per-realm floors. | Kept canonical rungs (spec `visibility_rule`); rung medallions show ordinal index. |
| Left rail (Cảnh Giới/Tu Luyện/Công Pháp/Kỵ Ngộ) + top bar | Audit CORRECTED → shared imperial-scroll nav-rail/top-bar, sibling-owned. | Not touched. |
| Player portrait in rail card | Ref shows a realm medallion, not the cultivator portrait. | Replaced portrait with `realm-medallion` + kept `player.name` as subtitle. Flag if the portrait must stay. |
