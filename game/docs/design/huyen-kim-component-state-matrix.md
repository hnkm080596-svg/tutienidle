# Huyền Kim — Component State Contract (canonical)

Contract chính thức giữa ART và CODE: **state nào tồn tại, nhìn thế nào, ai render**. Nguyên tắc nền: 1 base art + runtime state (tint/opacity/transform/mask/glow/glyph/overlay/animation) — KHÔNG vẽ sheet riêng cho từng state trừ khi state đổi HÌNH DÁNG (xem §Shape-variant cuối file).

Nguồn token: `src/assets/huyen-kim.tokens.css` (`--hk-*`). Semantic states gốc (spec §46-47): `locked · available · active · complete · danger · milestone · attention · selected · ready`. File này mở rộng thành contract đầy đủ theo runtime thực tế.


> **BETA SCOPE v2 note:** states của các feature scope-hidden (orb-picker, passive emblem, Ultimate, companion, formation, artifact) là reference-only — giữ trong contract cho post-beta, nhưng không render trong beta.

## 1. Interaction states (mọi interactive element)

| State | Visual treatment | Render bởi |
|---|---|---|
| idle | base art + token mặc định | component |
| hover/focus | viền `--hk-border-active` (#7A6234) + lift nhẹ | token/CSS |
| pressed | scale 0.97 + giảm glow | CSS |
| selected | Ngọc jade `#3FA68B` + viền gold nhạt | token |
| disabled | opacity ↓ + Mực khóa `#5B6266` tint, no pointer | token |
| processing | pulse nhẹ/spinner overlay | component |
| attention | gold breathing halo (`hk-breath`) | token anim |
| upgradeable | gold tint `#C99A4A` | token |
| ready | jade tint `#3FA68B` + subtle glow | token |
| new | dot/chấm nhỏ cinnabar góc | component |
| warning | gold-sáng `#E8C35A` edge pulse | token |
| invalid/missing | cinnabar `#B54432` outline + shake micro | token |

## 2. Gameplay-specific states theo component

### 2.1 Đạo Luân wheel slots (Động Phủ)
`normal · hover/focus · active/open · disabled/locked · upgradeable · notification-dot (breakthrough)` — 1 grayscale `dao-luan-node` + tint/dot runtime. Slot bị ẩn theo progression thì **không render** (không vẽ "empty slot").

### 2.2 Buildings (Động Phủ scene)
`normal · hover/focus · selected · locked (silhouette/shadow — dùng art locked sẵn có) · ready/action-needed (jade breathing ring) · upgradeable (gold ring) · active/processing (cinnabar ring) · hidden (không render)`. Ring là overlay runtime tint — không vẽ ring vào art building.

### 2.3 Combat action rail (TurnCombatSkillBar)
`ready · hover/selected · cooldown (mask + số turn) · blocked_resource (ink + cost đỏ) · locked/unreleased · empty · actionable (awaiting choice — gold pulse) · cast-bar · Kiếm Tu orb-picker (basic slot thành cụm orb) · Pháp Tu Ẩn passive emblem (ult slot là emblem Ngộ Đạo Hỗn Độn, KHÔNG phải button)`. 1 `button-compact` grayscale đủ cho mọi button state; orb/emblem là composite khác — spec riêng nếu cần art.

### 2.4 Entity HUD (combat)
`ally (jade bar) · enemy (cinnabar bar) · targeted (gold outline) · damaged/low-HP (cinnabar pulse) · dead (desaturate + dim)`. `entity-bar` PNG là frame/track chrome — fill HP là runtime gradient, không vẽ fill vào PNG.

### 2.5 Rune-node / node graph (Skill Đạo Mạch, Technique Đạo Quyển)
`hidden/unrevealed (không render) · locked (ink + lock glyph) · purchasable/available (gold) · selected (gold-bright + outer focus ring) · learned/purchased (jade) · unlocking (jade/gold pulse anim) · levelled n/N (jade + bộ đếm nhỏ) · maxed (jade + completed mark) · gate-blocked (ink + requirement marker)`. Connection lines: `locked / active / unlocking` — runtime stroke, không vẽ.

### 2.6 SlotView / inventory slots
**Không dùng chrome slice** (họa tiết lặp gây clutter — SlotView cố tình slice-free). States qua token channel `--slot-*` trên `--hk-*`: `available/disabled/locked · idle/selected/processing · neutral/valid/invalid/missing · equipped/new marker · upgrade/downgrade comparison · empty/filled · hover · rarity frame (màu theo cấp) · quality aura · max-rarity · enhance badge`. `frame-s-slot` HOLD — chỉ vẽ khi có consumer chủ đích.

### 2.7 Realm Thiên Lộ milestones
`completed (jade filled) · current (jade + pulse) · reachable/available (gold trace) · locked (ink) · release-hidden (không render)`. Breakthrough CTA: `enabled (ceremonial gold) / disabled (ink)`; requirements list: `met (jade) / unmet (cinnabar)`.

### 2.8 Talent seals / chips
`idle · hover-detail · selected (jade) · available/actionable (gold) · locked (ink) · acquired/complete (jade + seal mark) · disabled · levelled/maxed (nếu multi-level)`. `seal-chip`/`tab-seal` grayscale.

### 2.9 Alchemy (Luyện Đan)
`recipe normal/selected · ingredient enough/insufficient (jade/cinnabar count) · brew available/blocked · brewing (progress + timer) · cancel · finished/output-ready (attention gold)`. Chrome: surface-m-panel + button-standard; states runtime.

### 2.10 StageSelect / Region landmarks
`normal · selected · locked (ink + mist) · boss (cinnabar marker) · completed/perfect (jade mark) · current/progression-target (gold trace) · auto-farm armed · Start enabled/disabled`.

### 2.11 Tribulation environment (state-driven, không interactive)
`calm → cloud accumulation → darkening → density → debris/wind → pressure → strike → recovery` — phase-driven theo spec §9.6; victory/defeat treatment riêng. Mind chapter: question card + answer buttons (dùng button-standard states) + countdown ring.

### 2.12 Top-bar / chrome
`resource-pill` (CurrencyHud — wiring pending): `normal · bump-on-change (scale pop) · insufficient (cinnabar flash)`. `icon-button-utility`: `idle · hover · active · notification dot`. `dao-luan-center` non-tintable: `active/cultivating` = runtime glow overlay, không tint.

## 3. Shape-variant rule (ngoại lệ duy nhất cần art riêng)

Chỉ thêm slot mới khi state **đổi hình dáng** mà tint/scale không diễn tả được — ví dụ button pressed lõm hẳn, node rạn nứt khi unlock, lò đan có khói khi brewing. Muốn variant: vẽ PNG + báo coordinator thêm slot vào manifest (ví dụ `button-standard-pressed`).

## 4. Acceptance

Mọi consumer mới của `InkNineSlice`/GameButton/SlotView/ThienCo phải map states qua contract này; state mới chưa có trong contract phải thêm vào đây TRƯỚC khi implement (không để component tự chế state màu ad-hoc).
