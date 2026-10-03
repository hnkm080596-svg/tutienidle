# Art Requests — Scene 15 · Defeat / Thất Bại (Huyền Kim)

One row per art asset Minh must draw or confirm. Every scaffold surface marked `class="art-needed"` carries the same `data-art-id` shown here.

Reference: `game/docs/design/references/huyen-kim/scenes/15-defeat.jpg`.
Design space: 1672×941 (runtime 1280×720, ×0.7655). Ref `15-defeat.jpg` maps to **spec scene 16 "Defeat"** — ceremonial-scroll shell (same family as Victory, cinnabar tint), z31 overlay.
Palette anchors: ink `#101718` · jade `#315f55` · muted gold `#b99a55` · ivory paper · cinnabar `--cinnabar` / crimson `--crimson`.

## Region → component map

| Spec region (scene 16) | Box (design px) | Component |
|---|---|---|
| title | 576/140/520/96 z31 | `DefeatTitleBand` (ceremony-ribbon, cinnabar filter — delivered; "THẤT BẠI" + subtitle motto) |
| hint | 526/260/620/80 z31 | `DefeatHintBlock` ("Nguyên Nhân Thất Bại" header + seal + `isCultivationGap` text) |
| rewards | 526/360/620/110 z31 | `DefeatRewardBlock` ("Thưởng Nhận Được" header + `RewardList`, `hasAnyReward` gated) |
| actions | 526/690/620/80 z31 | `DefeatActionRow` (danger retry + secondary return, countdowns) |
| scroll shell | — | `CombatDefeatPanel` root (`surface-xl-scroll` + `frame-xl-ceremony` cinnabar tint + `InkWashBackdrop`) |

## Art inventory

| # | Component | data-art-id | Design-px size (w×h) | Type | Visual description (per ref) | Layer / stack order |
|---|-----------|-------------|----------------------|------|------------------------------|---------------------|
| 1 | `DefeatHintBlock` | `defeat-hint-seal` | ~40×40 | prop | Cinnabar '!' seal medallion — dark red orb, gold rim, warning glyph | hint block, left of header |
| 2 | title band | `defeat-title-flourish` (suggestion) | ~520×96 | chrome | Ref's black-ink flourish + skull glyph inside the ribbon, more ornate than delivered `ceremony-ribbon` — delivered asset used meanwhile | title region, behind title text |
| 3 | `DefeatRewardBlock` slots | `defeat-reward-slot` (suggestion) | ~72×72 each | chrome | Framed reward tiles (jade orb, coin, shard, scroll icons) — currently reuses delivered `RewardList` row style | rewards region |
| 4 | scroll backdrop | `defeat-vista` (suggestion) | 1672×941 | vista | Moonlit battlefield with fallen cultivator + red petals — game world behind the scroll stays the combat scene, not a drawn vista | z0 under overlay (excluded) |

## Covered by delivered chrome (no drawing needed)

| Component surface | Delivered asset |
|---|---|
| Scroll surface | `surface-xl-scroll` (ready) |
| Scroll frame (cinnabar) | `frame-xl-ceremony` + `tint-var="--cinnabar"` (ready) |
| Title ribbon | `ceremony-ribbon` (ready; cinnabar sepia filter applied) |
| Wash mountains/mist | `InkWashBackdrop` left-mountain + bottom-mist (ready) |
| Buttons | `GameButton` danger + secondary (ready) |
| Reward rows | `RewardList` + `list-row` (ready) |

## Audit blocks NOT scaffolded

| Ref element | Verdict | Action |
|---|---|---|
| "Thử Lại" + "Trở Về Chính Phủ" | EXACT — real contract | Rendered `combat.defeat.retry` (danger + 3s repeat-mode countdown) + `combat.defeat.returnHome` (10s fallback) |
| Reward icons row | EXACT — `hasAnyReward` + `RewardList` | Kept delivered list; flag: ref shows 4 framed slots (EXP/Linh Thạch/Huyền Tinh/Tàn Quyến) vs canonical summary fields |
| Defeated-figure vista | EXACT shell dressing | Not scaffolded — backdrop is the live combat scene per shell contract |

## Flagged ambiguities — coordinator decisions needed (not self-decided)

| Ref element | Finding | Action taken |
|---|---|---|
| Subtitle motto "Đạo tâm chưa vững, tiếp tục rèn luyện." | Not in existing `combat.defeat` keys | Added `combat.defeat.subtitle` (en/vi) — flag if copy is owned elsewhere |
| "Nguyên Nhân Thất Bại" section header | Ref splits hint into header + body | Added `combat.defeat.reasonHeader`; hint text still driven by `isCultivationGap` (audit EXACT) |
| "Thưởng Nhận Được" header | Ref labels the reward row | Added `combat.defeat.rewardsHeader`; hidden with `hasAnyReward=false` |
| Ref reward slot icons (4 fixed tiles) | Canonical summary has variable fields (mastery/insight/stone/items) | Kept `RewardList`; `defeat-reward-slot` suggestion row if framed tiles are wanted |
