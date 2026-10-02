# Scene 08 — BODY (Đạo Thể / Kinh Mạch) art inventory

Reference: `game/docs/design/references/huyen-kim/scenes/08-body.jpg`
Regions (design space 1672×941): `chapter-rail` 288/176/132/610 · `figure-focus` 436/176/640/520 · `tier-chips` 436/704/640/56 · `detail-panel` 1092/176/440/610.

Temporary CSS art is in place today; every surface below carries `art-needed` + `data-art-id` for the replacement pass. Palette in use: ink `#101718`, jade `#315f55`, muted gold `#b99a55`, ivory paper, cinnabar `#B54432`.

## Inventory

| component | data-art-id | design-px (w×h) | type | description | layer order |
|---|---|---|---|---|---|
| `BodyChapterSeal` | `body-chapter-seal-{chapterId}` (×3) | ~120×70 | vertical seal | Chapter seal card on the left rail — nav-seal-vertical family. One per chapter (body_refinement/meridian/zhou_tian); active = gold rim, locked = ink + dashed edge, complete = jade counter. | 1 art bg + seal medallion + text |
| `BodyFigureFocus` vista | `body-vista` | 640×520 | backdrop | Ink-wash landscape plate behind the figure: jade sky gradient, sun disc over the crown, two ink ridge bands, dark valley floor. Fills the whole figure-focus region. | below figure |
| `BodyFigureFocus` dais | `body-dais` | ~300×50 | oval aura | Soft cinnabar/jade glow ellipse under the figure's feet (meditation dais light). | above vista, below figure |
| `BodyOrbRing` ellipse | `body-meridian-ring` | ~590×440 | orbit ring | Thin ink ellipse the eight meridian orbs sit on — barely-visible dashed orbit line around the figure. | below orbs |
| `BodyOrb` disc | `body-orb-{status}` (×3 states) | ~44×44 | dao-luan-node | Meridian node disc: grayscale node art tinted per state (opened jade glow / next gold rim / locked ink). Stable-art `dao-luan-node` already lands on the disc — request covers the finished authored version. | node art + ring |
| `BodyProgressStrip` badge | `body-progress-badge` | 26×26 | round seal | Small circular "!" medallion left of the progress bar (chapter emblem). | icon tile |
| `BodyProgressStrip` track | `body-progress-track` | ~460×8 | bar frame | Progress readout frame under the figure: label text above, ink track + jade→gold fill. | frame + fill |
| `BodyTierChip` chrome | seal-chip (shared) | ~86×44 | chip | Selector chips ("Tầng N" / "Mạch N" / milestone). Reuses the `seal-chip` manifest slot — no new art needed unless a body-specific chip skin is wanted. | shared slot |
| `BodyDetailPanel` chrome | surface-m-panel (shared) | 440×610 | panel | Right-hand card chrome. Reuses `surface-m-panel`. | shared slot |
| `BodyGainList` row icon | `body-stat-icon-{stat}` | 18×18 | stat glyph | Per-stat jade/gold badge left of each gain row (might/defense/maxHp/etc. — one glyph per StatType used by body chapters). | icon tile |
| `BodyCostSlot` icon | `body-cost-icon-{materialId}` | 30×30 | material tile | Material/pill icon tile in the requirements slots. `thong_mach_dan` already has real pill art (`/assets/pills/...`); essence materials (tinh_hoa_pham_the, tinh_hoa_phap_the) need authored icons. | icon tile |
| `BodyInvestCta` chrome | button-ceremonial (shared) | ~270×44 | button | The invest call-to-action. Reuses the `button-ceremonial` manifest slot (GameButton lg). | shared slot |

## Runtime-only elements (no art needed)

- Figure + meridian overlay are **stable-art mounts**: `body-cultivation-figure` + `body-meridian-overlay` (already authored, e2e-pinned via `.body-scene__figure-img` / `.body-scene__figure-overlay`).
- Ignite flash (landed chapter / landed step) is a CSS gold wash animation.
- InkNineSlice chrome ids consumed: `nav-seal-vertical` (rail seals), `seal-chip` (tier chips), `surface-m-panel` (detail card), `button-ceremonial` (CTA), `dao-luan-node` (orb discs).

## Ambiguities flagged for design review

- Ref labels the orbs with body points (Đỉnh/Thủ/Kiên/Ngực/Yêu/Túc/Thân); audit maps the ring to the meridian map — implementation binds the **8 authored meridians** (Kỳ Kinh Bát Mạch) with real names/states. Confirm authored naming is intended over the ref's anatomical labels.
- Ref shows 5 tier chips ("Tầng 1–5"); the authored refinement chapter has 6 tiers — chips render the real authored count (6 / 8 vessels / 2 Chu Thiên milestones).
- Ref's requirement slots show 3 materials (Cốt Tủy Đan, Huyền Thiết, Linh Thạch); authored chapters each consume exactly one currency (tinh_hoa_pham_the / thong_mach_dan / tinh_hoa_phap_the) — slots render the real currency only.
- Refinement invests through the tick; the CTA additionally consumes essence immediately via `investBodyChapter` (same authority).
