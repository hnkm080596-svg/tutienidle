# Art Requests — Scene 13 · Tribulation / Độ Kiếp · Lôi Kiếp (Huyền Kim)

One row per art asset Minh must draw or confirm. Every scaffold surface marked `class="art-needed"` carries the same `data-art-id` shown here.

Reference: `game/docs/design/references/huyen-kim/scenes/13-tribulation.jpg`.
Design space: 1672×941 (runtime 1280×720, ×0.7655). Ref `13-tribulation.jpg` maps to **spec scene 14 "Tribulation"** (world shell, full-bleed storm vista via `TribulationScene` Phaser canvas).
Palette anchors: ink `#101718` · jade `#315f55` · muted gold `#b99a55` · ivory paper. Scene tokens `--scene-tribulation-*` stay authoritative.

## Region → component map

| Spec region (scene 14) | Box (design px) | Component |
|---|---|---|
| chapter-tracker | 536/44/600/66 z12 | `TribulationChapterTracker` (dao-luan-node pips, dynamic count, not selectable) |
| status-card | 60/560/420/220 z12 | `TribulationStatusCard` (plaque + chapter + progress + chapter timer + strike flames + tank hint) |
| mind-card | 1090/200/522/380 z12 | `TribulationMindCard` (question + dynamic answers + timer-ring + time track) |
| hp-cluster | 616/736/440/84 z12 | `TribulationHpCluster` (entity-bar framed HP + resolve caption) |
| result | 536/340/600/220 z30 | `TribulationResultBanner` (victory/defeat) |
| realm card (ref top-right) | ref ~1400/60 | `TribulationRealmCard` (realm label + progress + flame row) — CORRECTED content, ref-derived placement |

## Art inventory

| # | Component | data-art-id | Design-px size (w×h) | Type | Visual description (per ref) | Layer / stack order |
|---|-----------|-------------|----------------------|------|------------------------------|---------------------|
| 1 | `TribulationStatusCard` | `tribulation-strike-pip` | ~13×18 each | prop | Lightning-flame pip per strike taken — lit gold flame (ref's status flame counters) | Inside status card tank block |
| 2 | `TribulationRealmCard` | `tribulation-realm-flame` | ~14×20 each | prop | Gold flame row under the realm card (ref's 5-flame meter under "Độ Kiếp Tầng 9") | realm card bottom |
| 3 | `TribulationMindCard` answers | `tribulation-answer-seal` (suggestion) | ~470×44 per row | chrome | Ref's ornate answer rows: gold letter seal (A–D) left + flame icon right | answers column |
| 4 | hp-cluster | `tribulation-meditator-medallion` (suggestion) | ~90×90 | prop | Meditating figure medallion between the bottom bars (ref's bottom-center figure) | hp-cluster top |
| 5 | `TribulationScene` canvas | `tribulation-vista` (suggestion) | 1672×941 | vista | Storm-eye lightning vista — **Phaser scene art, excluded from DOM scaffold** | z0 under DOM |

## Covered by delivered chrome (no drawing needed)

| Component surface | Delivered asset |
|---|---|
| Chapter pip medallions | `dao-luan-node` (ready) |
| Status plaque | `scroll-title-plaque` (ready) |
| Question timer | `timer-ring` (ready) |
| HP bar frame | `entity-bar` (ready) |
| Card panels | `surface-m-panel` via `InkNineSlice` (ready) |
| Answer buttons | `GameButton` (button-standard family, ready) |

## Audit blocks NOT scaffolded

| Ref element | Verdict | Action |
|---|---|---|
| Bottom quick-nav (Nhân Vật/Túi Đồ/Kỹ Năng/Trận Pháp) | INVALID — tribulation is immersive; Trận Pháp scope-hidden | Not scaffolded |
| Tự Động / Bỏ Qua controls | INVALID — no auto/skip contract | Not scaffolded |
| Second resource bar (Linh Lực) | INVALID — single HP bar canonical | Not scaffolded |
| "Độ Tâm Ma 72%" / attempt counters | INVALID — invented fields | Not scaffolded (real = `questionSecondsRemaining` + `lightningStrikesTaken`) |
| "14. Độ Kiếp ?" nav title + flavor quote | Scene-chrome dressing (shell), not a spec region | Not scaffolded; flag below |

## Flagged ambiguities — coordinator decisions needed (not self-decided)

| Ref element | Finding | Action taken |
|---|---|---|
| "Độ Kiếp Tầng 9" top-right card | Not a spec region — ref-only. Audit CORRECTED content: realm label from `targetRealmId`, progress = chapter x/y. | Built `TribulationRealmCard` with `getCurrentRealm(targetRealmId).name` + progress; flagged for placement confirmation. |
| 8 pips under bottom bars | Audit: pips → chapter/strike markers. | Rendered strike flames on the realm card + status card (lit = `lightningStrikesTaken`); flagged — could also be read as per-chapter markers. |
| Status card "Thời gian còn lại 01:28" | Real field = `secondsRemaining` (chapter-level) — it reads 0 during the question phase, so the row hides then. | Rendered conditionally; flagged. |
| Ref flavor quote under nav title ("Cửu thiên lôi động…") | No authored per-realm flavor field. | Omitted; `overlay.resolve` caption added under HP for the bottom motto instead. |
