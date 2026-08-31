# Thiết kế: Hệ thống Theme Tu Tiên - Mặc Họa (2026-08-31)

## Tóm tắt

Thiết kế hệ thống 4 phong cách mỹ thuật cho TienIdle: **Mặc họa tối giản**, **Mặc họa phong cảnh**, **Tu tiên huyền ảo**, và **Cổ điển Trung Hoa** — với khả năng chuyển đổi theme trong Settings. Ngoài 4 style mới, giữ 1 theme `default` (ink-wash dark mode hiện tại) để người chơi có thể quay về giao diện cũ.

**Stack:** Vue 3 + TypeScript + Phaser 4 + Pinia + Vite

---

## 1. Tổng quan kiến trúc

### 1.1 4 Phong cách

| | Style 1 | Style 2 | Style 3 | Style 4 |
|---|---|---|---|---|
| Tên | Mặc họa tối giản | Mặc họa phong cảnh | Tu tiên huyền ảo | Cổ điển Trung Hoa |
| Nền | Giấy trắng #FDFBF7 | Giấy kem #F0EBE0 | Nền tối #0D0A14 | Đỏ son nhạt #F5E6E0 |
| Nét chính | Mực đen #1A1A1A | Mực nâu đậm #2C1810 | Tím lam huyền #5C3D8F | Đỏ son đậm #8B1A1A |
| Accent | Xanh ngọc #4A8C6F | Nâu đồng #8B6914 | Lam lục #4A7B9D | Vàng kim #D4A017 |
| Font display | Playfair Display Bold | Ma Shan Zheng 400 | Noto Serif SC 700 | ZCOOL XiaoWei 700 |
| Font body | Noto Sans TC 400 | Noto Sans TC 400 | Noto Sans SC 400 | Noto Sans TC 500 |
| Icon | SVG line art đơn sắc | SVG brush stroke | SVG gradient glow | SVG gilded detail |
| Animation | Instant, no blur | Subtle fade 200ms | Particle shimmer | Slide ornate 300ms |
| Decorative | Grid lines, seal stamp | Mountain mist wash | Lingqi rune glow | Dragon border pattern |

### 1.2 Danh sách theme

5 theme: `default` (ink-wash dark hiện tại) + `ink-minimal` + `landscape-shanshui` + `xianxia-glow` + `classical-imperial`.

### 1.3 Token Override Model

Token chia 2 nhóm:
- **Theme-overridable:** `--ink-*`, `--paper-*`, `--chrome-*`, `--frame-*`, `--surface-*`, `--font-*`
- **Data (GIỮ NGUYÊN):** `--rank-*`, `--grade-*`, `--affix-*`, `--el-*`, `--scene-*-*` — màu rank/ngũ hành không đổi theo theme

### 1.3 Cấu trúc file

```
game/src/
├── assets/
│   ├── theme.css                      (token gốc)
│   ├── themes/
│   │   ├── ink-minimal.css           (Style 1)
│   │   ├── landscape-shanshui.css     (Style 2)
│   │   ├── xianxia-glow.css          (Style 3)
│   │   ├── classical-imperial.css     (Style 4)
│   │   └── index.ts                  (registry + applyTheme)
│   └── icons/
│       ├── ink-line/                  (Style 1)
│       ├── brush-stroke/              (Style 2)
│       ├── xianxia-rune/              (Style 3)
│       └── gilded-detail/            (Style 4)
├── composables/
│   ├── useTheme.ts                   (switch theme)
│   └── useThemePreview.ts            (mini preview)
├── stores/
│   └── themeStore.ts                 (Pinia: currentTheme)
├── components/
│   ├── settings/
│   │   └── ThemeSwitcher.vue         (UI chọn theme)
│   ├── menu/
│   │   ├── MainMenu.vue
│   │   ├── MenuBackground.vue
│   │   ├── MenuLogo.vue
│   │   └── MenuButton.vue
│   ├── onboarding/
│   │   ├── OnboardingChapter.vue
│   │   └── OnboardingIllustration.vue
│   ├── combat/
│   │   └── (refactor existing combat components)
│   ├── home/
│   │   ├── DongFuBackground.vue
│   │   └── (refactor home components)
│   └── common/
│       ├── ThemeTransition.vue
│       ├── ThemedIcon.vue
│       └── (refactor existing primitives)
└── game/
    └── support/
        └── phaserThemeBridge.ts       (Vue → Phaser sync)
```

---

## 2. Chi tiết từng khu vực

### 2.1 Main Menu

```
┌─────────────────────────────────────┐
│  [Background scene full viewport]   │
│                                     │
│        TIÊN HIỆP IDLE              │
│        ─────────────                │
│                                     │
│      [ Bắt đầu tu luyện ]          │
│      [ Tiếp tục ]                  │
│      [ Cài đặt ]                   │
│      [ Thoát ]                      │
│                                     │
│                  v1.2.3            │
└─────────────────────────────────────┘
```

- **Style 1:** Giấy trắng + gợn sóng ink, logo Playfair, nút outline mực
- **Style 2:** Parallax núi sương, logo Ma Shan Zheng, nút brush stroke
- **Style 3:** Nền tím đen + tinh vân rune, logo glow pulse, nút rune phát sáng
- **Style 4:** Đỏ son + mây vàng long phượng, logo ZCOOL + viền vàng, nút khung vàng hoa

### 2.2 Onboarding

Layout dọc scroll, 1 chương mỗi slide:
- Eyebrow màu cinnabar/gold
- Title serif lớn (tùy font style)
- Body text giải thích cốt truyện
- Nút "Tiếp tục"
- Progress dots dưới

### 2.3 Combat HUD

```
┌─────────────────────────────────────┐
│ [TopBar] Tên | HP▓▓ 80% | MP▓▓ 60% │
│ [Event] "Tiểu Quỷ đánh 234!"        │
│                  [Canvas]            │
│ [Skill] [1][2][3][4][5][6]         │
│ [Control] [Auto] [Pause] [Speed]    │
└─────────────────────────────────────┘
```

- **Style 1:** Ink line + paper, HP trắng outline
- **Style 2:** Brush wash band, HP gradient wash
- **Style 3:** Glowing rune strip, HP glow xanh, slot hex rune
- **Style 4:** Gold border ornamental, HP vàng gradient, slot vàng tròn

### 2.4 Dong Fu Home

```
┌──────────────────────────────────────┐
│ [Resource Strip] 💎1234 🌿567 ⭐89  │
│       [   DongFu Scene   ]           │
│          ╭─────────╮                 │
│       ╭──┤ Kỳ Đường ├──╮            │
│       │  ╰─────────╯  │             │
│       │ [Luyện Đan]   │             │
│       │ [Trận Pháp]   │             │
│       │ [Rèn Khí]     │             │
│       │ [Khai Thác]   │             │
│       │ [Dịch Chuyển] │             │
│       ╰───────────────╯             │
└──────────────────────────────────────┘
```

- **Style 1:** Resource strip outline giấy, building outline mực, command wheel sector ink line
- **Style 2:** Wash gỗ tre, brush stroke, sector brush
- **Style 3:** Gem rune glow, tint lục giác, sector hex rune
- **Style 4:** Hoa văn đỏ-vàng, building khung vàng, sector long phượng

### 2.5 Panels

Giữ nguyên cấu trúc layout hiện tả (Character/Loadout/Bag/Equipment), refactor:
- `StatRow.vue` — 4 variant separator (dot/brush/rune/hoa văn)
- `TabBar.vue` — 4 variant indicator (underline/wash/glow/vàng)
- `GameButton.vue` — 4 variant style
- `GamePanel.vue` — 4 variant header/border

### 2.6 Settings — Theme Switcher

4 preview cards (256×160px), mỗi card hiển thị thu nhỏ: background + 1 button + 1 stat row. Click → live preview toàn màn hình. Nút "Áp dụng" confirm.

---

## 3. Asset plan

### Giữ nguyên
- `art-source/ui/ink-wash/` — dùng cho Style 1
- `art-source/buildings/dong-fu/v2/` — base sprites, tint lại
- `art-source/backgrounds/dong-fu/` — base backdrop

### Cần tạo mới

| Asset | Style | Loại | Kích thước |
|-------|-------|------|-------------|
| `main-menu-bg-shanshui.png` | 2 | Ảnh nền parallax | 1920×1080 @2x |
| `main-menu-bg-xianxia.png` | 3 | Shader background tím | procedural/GLSL |
| `main-menu-bg-imperial.png` | 4 | Ảnh nền đỏ + mây vàng | 1920×1080 @2x |
| `main-menu-logo-styled/` | all | SVG logo 4 variant | scalable |
| `onboarding-illustration-{ch}.png` | all | Ảnh minh họa mỗi style × 4 | 800×600 @2x |
| `combat-victory-glow.png` | 3 | Overlay chiến thắng particle | 512×512 |
| `combat-victory-imperial.png` | 4 | Khung chiến thắng hoàng gia | 800×600 |
| `skill-slot-hex.svg` | 3 | Khung rune lục giác | scalable |
| `skill-slot-ornate.svg` | 4 | Khung tròn vàng hoa văn | scalable |
| `command-wheel-brush.svg` | 2 | Sector brush stroke | scalable |
| `command-wheel-rune.svg` | 3 | Sector hex rune | scalable |
| `icon-set-{style}/` | all | 40+ icons mỗi style | 24×24 @2x |

### Icon Strategy
Inline SVG (không PNG sprite) để dễ đổi màu qua CSS. Component `ThemedIcon.vue` tự load icon set đúng theo theme.

### Font additions

```css
@import url('https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@600;700&family=ZCOOL+XiaoWei&display=swap');
```

---

## 4. Phaser Integration

### Tint Strategy
Phaser textures giữ nguyên (không swap asset nặng). Chỉ `.setTint()` khi theme đổi:

```typescript
// game/support/phaserThemeBridge.ts
const TINT_MAP: Record<ThemeId, number> = {
  'ink-minimal': 0xFDFBF7,
  'landscape-shanshui': 0xF0EBE0,
  'xianxia-glow': 0x0D0A14,
  'classical-imperial': 0xF5E6E0,
};

function applyTintToScene(scene: Phaser.Scene, themeId: ThemeId) {
  scene.children.list.forEach(obj => {
    if (obj instanceof Phaser.GameObjects.Image) {
      obj.setTint(TINT_MAP[themeId]);
    }
  });
}
```

### Phaser objects cần tint
- Building sprites (dong-fu)
- Background layer (dong-fu backdrop)
- Combat HUD overlay
- Tribulation scene (sky/lightning)

---

## 5. Theme Switcher Flow

1. User mở Settings → `ThemeSwitcher.vue` hiển thị 4 cards preview
2. Click theme → `themeStore.setTheme(themeId)`
3. `useTheme.ts` set `<html data-theme="...">` attribute
4. CSS cascade tự động áp tokens mới
5. `phaserThemeBridge.ts` push event xuống Phaser → re-tint
6. Persist: `localStorage.theme = themeId`

---

## 6. Thứ tự triển khai

### Phase 1: Foundation — Core theme system (1-2 ngày)
- Hệ thống theme switcher hoạt động
- 4 CSS theme files định nghĩa tokens
- `themeStore.ts`, `useTheme.ts`, `ThemeSwitcher.vue`
- Verify: Build + typecheck pass

### Phase 2: Main Menu + Onboarding (2-3 ngày)
- `MainMenu.vue`, `MenuBackground.vue`, `MenuLogo.vue`, `MenuButton.vue`
- `OnboardingChapter.vue`, `OnboardingIllustration.vue`
- Router update → MainMenu thay direct routing
- Verify: Manual test mỗi style

### Phase 3: Combat HUD (2-3 ngày)
- Refactor CombatTopBar, CombatStatusBar, CombatEventBar, CombatControlBar
- Refactor CombatSkillSlot, CombatVictoryPanel, CombatDefeatPanel
- `phaserThemeBridge.ts`
- Verify: Combat scene + theme switch

### Phase 4: Dong Fu Home (2 ngày)
- Refactor HomeResourceStrip, DongFuCommandWheel, DongFuBuildingSprite
- `DongFuBackground.vue` (4 style scene)
- Verify: Ở Dong Fu, switch theme → UI update

### Phase 5: Panels + Polish (2-3 ngày)
- Refactor StatRow, TabBar, SlotView, GameButton, GamePanel
- Tạo `ThemedIcon.vue` + 4 icon set (160 SVG)
- Settings panel integration
- Verify: 4 style × mọi màn hình, no layout break

**Tổng: 9-13 ngày**

---

## 7. Ghi chú

- Token data (rank/grade/affix/ngũ hành) GIỮ NGUYÊN theo mọi theme — chỉ chrome/skin đổi
- Phaser textures không swap runtime — chỉ tint
- Save compatibility: theme preference lưu riêng, không ảnh hưởng game save
- Font fallback: nếu Google Fonts fail, dùng `serif`/`sans-serif` system fallback
