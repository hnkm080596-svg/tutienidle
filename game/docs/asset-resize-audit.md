# Audit resize asset — tutienidle

Báo cáo audit toàn bộ ảnh trong `game/public/assets` (PNG/JPG, đo bằng Pillow). Mục tiêu: giảm dung lượng mà **không phá UI** — file nào code pin kích thước pixel (nine-slice, sprite atlas, manifest sourceSize/extent, test đọc IHDR) thì **CẤM resize**.

## Tóm tắt

- Tổng: **1645 file / 1016.1MB**
- ✅ Đã resize (an toàn): **87 file**, tiết kiệm **56.9MB** (≈74.4MB → 17.5MB)
- 🔒 CẤM resize: **1094 file / 741.5MB** — pixel gốc bị code/manifest/test pin cứng
- 📦 Không tham chiếu runtime (chỉ báo cáo, đề xuất xóa/dời): **154 file / 127.3MB**
- ❓ Chỉ thấy trong preload catalog (Phaser render theo px gốc — không resize vì thiếu bằng chứng render): **9 file / 5.4MB**
- ➖ Giữ nguyên (đã ≤ 2× render hoặc file nhỏ): **301 file / 67.6MB**

Luật an toàn: chỉ resize khi kích thước hiển thị được CSS/`<img>` width quyết định (không ai đọc pixel gốc). Target = max(render×2, sàn 512px ảnh cảnh / 256px icon), giữ format + alpha + đường dẫn.

## 1. File đã resize

| File | Gốc (px) | Mới (px) | Render tối đa đo được | Gốc | Mới |
|---|---|---|---|---|---|
| `ui/ink-wash/overlays/seal-cinnabar-large.png` | 1024×1536 | 171×256 | seal ~144px | 2.8MB | 85KB |
| `ui/tien-hiep-2026-10/controls/navigation-landscape-seam-v1.png` | 724×2172 | 469×1408 | seam 125px x ~700 CSS | 2.5MB | 1.1MB |
| `ui/tien-hiep-2026-10/controls/inspector-v1.png` | 1174×1235 | 973×1024 | inspector panel <=505px CSS | 2.3MB | 1.4MB |
| `ui/huyen-kim/scene/dong-fu-v2/cultivator.png` | 1254×1254 | 768×768 | df cultivator 300x320 | 2.2MB | 881KB |
| `ui/huyen-kim/scene/realm-v2/ascension-path-six-landings-v2.png` | 1122×1402 | 615×768 | realm map ~400px | 2.2MB | 691KB |
| `ui/huyen-kim/scene/login-v2/wordmark.png` | 2172×724 | 1152×384 | logo block 560px | 2.2MB | 627KB |
| `ui/tien-hiep-2026-10/source/button-primary.png` | 2048×768 | 768×288 | button bg ~300px | 2.1MB | 221KB |
| `ui/huyen-kim/scene/character-v2/figure.png` | 1254×1254 | 768×768 | cf figure ~370px | 2.1MB | 841KB |
| `ui/tien-hiep-2026-10/controls/navigation-backing-dark-v3.png` | 887×1774 | 768×1536 | nav rail ~335x670 CSS | 2.1MB | 1.6MB |
| `ui/huyen-kim/scene/forge-v2/furnace-v1.png` | 1003×1568 | 328×512 | furnace art ~200px | 2.0MB | 247KB |
| `ui/huyen-kim/scene/technique-v2/temporary-manual-v1.png` | 1254×1254 | 768×768 | technique art ~400px | 2.0MB | 793KB |
| `ui/tien-hiep-2026-10/controls/attribute-plus-v2.png` | 991×921 | 256×238 | plus button ~64px | 1.9MB | 102KB |
| `ui/huyen-kim/scene/victory-v2/victory-title-v1.png` | 2172×724 | 1152×384 | victory title 550px | 1.9MB | 565KB |
| `ui/huyen-kim/scene/login-v2/cultivator.png` | 1448×1086 | 768×576 | login cultivator ~300x320 | 1.9MB | 572KB |
| `ui/tien-hiep-2026-10/controls/skill-node-parent-v1.png` | 1254×1254 | 256×256 | skill node 78px | 1.9MB | 95KB |
| `ui/tien-hiep-2026-10/controls/skill-node-main-v1.png` | 1254×1254 | 256×256 | skill node 78px | 1.6MB | 82KB |
| `ui/tien-hiep-2026-10/controls/item-slot-v1.png` | 1022×1002 | 256×251 | item slot ~64-96px | 1.5MB | 78KB |
| `ui/huyen-kim/scene/defeat-v2/defeat-title-v1.png` | 2172×724 | 1408×469 | defeat title 665px | 1.5MB | 644KB |
| `ui/huyen-kim/scene/skill-v2/node-ring-v1.png` | 1254×1254 | 256×256 | node ring 52px | 1.3MB | 70KB |
| `ui/tien-hiep-2026-10/controls/equipment-tab-brush-v1.png` | 2086×307 | 256×38 | tab brush ~64px | 1.3MB | 16KB |
| `ui/tien-hiep-2026-10/body/silhouette-seated-v1.png` | 1312×1199 | 1024×936 | body figure ~500px | 1.3MB | 777KB |
| `ui/tien-hiep-2026-10/controls/skill-node-passive-v1.png` | 1254×1254 | 256×256 | skill node 78px | 1.3MB | 66KB |
| `ui/tien-hiep-2026-10/controls/button-primary-v1.png` | 1863×281 | 768×116 | button ~300px wide | 1.3MB | 162KB |
| `ui/tien-hiep-2026-10/controls/navigation-medallion-v1.png` | 2172×724 | 256×85 | nav medallion ~65px | 1.2MB | 20KB |
| `ui/tien-hiep-2026-10/controls/skill-node-keystone-v1.png` | 1254×1254 | 256×256 | skill node 78px | 1.2MB | 61KB |
| `ui/ink-wash/overlays/seal-cinnabar-small.png` | 1254×1254 | 256×256 | seal ~72px | 1.2MB | 58KB |
| `ui/tien-hiep-2026-10/controls/skill-node-sub-v1.png` | 1254×1254 | 256×256 | skill node 78px | 1.2MB | 59KB |
| `ui/combat/reward-gourd-v1.png` | 1254×1254 | 256×256 | gourd 52x64 displaySize | 1.0MB | 60KB |
| `ui/tien-hiep-2026-10/controls/skill-node-spare-v1.png` | 1254×1254 | 256×256 | skill node 78px | 1.0MB | 50KB |
| `ui/tien-hiep-2026-10/controls/equipment-brush-circle-v1.png` | 706×576 | 256×209 | equipment icon ~64px | 972KB | 73KB |
| `ui/tien-hiep-2026-10/controls/equipment-filter-selected-v2.png` | 1225×324 | 256×68 | filter chip ~64px | 901KB | 35KB |
| `ui/huyen-kim/scene/combat-v2/ornament-ring-v1.png` | 1254×1254 | 512×512 | portrait ring ~250px | 855KB | 160KB |
| `ui/tien-hiep-2026-10/controls/button-secondary-v1.png` | 1863×280 | 768×115 | button ~300px wide | 853KB | 123KB |
| `ui/tien-hiep-2026-10/body/silhouette-upper-v1.png` | 1215×1295 | 961×1024 | body figure ~500px | 838KB | 528KB |
| `ui/tien-hiep-2026-10/controls/equipment-filter-hover-v2.png` | 1225×324 | 256×68 | filter chip ~64px | 827KB | 32KB |
| `ui/tien-hiep-2026-10/body/navigation-dan-lit-v1.png` | 512×512 | 256×256 | body nav ~100px | 640KB | 109KB |
| `ui/tien-hiep-2026-10/body/navigation-ren-lit-v1.png` | 512×512 | 256×256 | body nav ~100px | 636KB | 105KB |
| `ui/tien-hiep-2026-10/body/navigation-khai-lit-v1.png` | 512×512 | 256×256 | body nav ~100px | 624KB | 106KB |
| `ui/tien-hiep-2026-10/body/anatomy-blood-lit-v1.png` | 972×621 | 512×327 | anatomy ~300px | 614KB | 175KB |
| `ui/tien-hiep-2026-10/controls/equipment-filter-pressed-v2.png` | 1225×324 | 256×68 | filter chip ~64px | 604KB | 23KB |
| `ui/tien-hiep-2026-10/tribulation/title-plaque-v1.png` | 1570×290 | 1024×189 | title plaque ~600px | 595KB | 222KB |
| `ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png` | 1225×324 | 256×68 | filter chip ~64px | 584KB | 21KB |
| `ui/tien-hiep-2026-10/controls/navigation-connector-v1.png` | 793×1983 | 102×256 | nav connector ~64px | 497KB | 13KB |
| `ui/tien-hiep-2026-10/body/anatomy-blood-unlit-v1.png` | 972×621 | 512×327 | anatomy ~300px | 494KB | 156KB |
| `ui/tien-hiep-2026-10/body/navigation-ren-unlit-v1.png` | 512×512 | 256×256 | body nav ~100px | 494KB | 71KB |
| `ui/tien-hiep-2026-10/body/navigation-dan-unlit-v1.png` | 512×512 | 256×256 | body nav ~100px | 493KB | 73KB |
| `ui/tien-hiep-2026-10/body/navigation-khai-unlit-v1.png` | 512×512 | 256×256 | body nav ~100px | 489KB | 71KB |
| `ui/tien-hiep-2026-10/combat/hp-caption-v1.png` | 987×239 | 512×124 | hp caption ~200px | 479KB | 84KB |
| `ui/tien-hiep-2026-10/body/biceps-right-lit-v1.png` | 350×512 | 175×256 | biceps ~120px | 392KB | 47KB |
| `ui/tien-hiep-2026-10/body/biceps-left-lit-v1.png` | 350×512 | 175×256 | biceps ~120px | 392KB | 46KB |
| `ui/tien-hiep-2026-10/body/forehead-ring-lit-v1.png` | 757×744 | 512×503 | forehead ring ~200px | 383KB | 153KB |
| `ui/tien-hiep-2026-10/controls/equipment-circle-frame-v1.png` | 443×405 | 256×234 | equipment frame ~64px | 370KB | 93KB |
| `ui/tien-hiep-2026-10/icons/element-earth-ivory-v1.png` | 418×427 | 251×256 | element icon ~42px | 369KB | 121KB |
| `ui/tien-hiep-2026-10/body/forehead-ring-unlit-v1.png` | 761×746 | 512×502 | forehead ring ~200px | 366KB | 160KB |
| `ui/tien-hiep-2026-10/body/meridian-ring-lit-v1.png` | 768×290 | 512×193 | meridian ~200px | 362KB | 66KB |
| `ui/tien-hiep-2026-10/icons/element-water-ivory-v1.png` | 407×423 | 246×256 | element icon ~42px | 353KB | 122KB |
| `ui/tien-hiep-2026-10/body/meridian-node-lit-v1.png` | 768×300 | 512×200 | meridian ~150px | 344KB | 59KB |
| `ui/tien-hiep-2026-10/icons/element-fire-ivory-v1.png` | 413×488 | 217×256 | element icon ~42px | 342KB | 90KB |
| `ui/tien-hiep-2026-10/icons/element-wood-ivory-v1.png` | 385×472 | 209×256 | element icon ~42px | 340KB | 97KB |
| `ui/tien-hiep-2026-10/icons/element-metal-ivory-v1.png` | 414×476 | 223×256 | element icon ~42px | 338KB | 97KB |
| `ui/tien-hiep-2026-10/combat/player-status-v1.png` | 695×228 | 512×168 | status card ~250px | 335KB | 109KB |
| `ui/tien-hiep-2026-10/body/meridian-junction-lit-v1.png` | 768×269 | 512×179 | meridian ~200px | 316KB | 53KB |
| `ui/tien-hiep-2026-10/combat/area-title-v1.png` | 815×180 | 768×170 | combat area title ~350px | 311KB | 166KB |
| `ui/tien-hiep-2026-10/controls/skill-connection-pipe-v2.png` | 1088×183 | 512×86 | skill pipe <=256px | 310KB | 72KB |
| `skills/nodes/tu-diem-v1.png` | 512×512 | 256×256 | skill node icon ~53px | 309KB | 90KB |
| `skills/nodes/khac-an-v1.png` | 510×512 | 255×256 | skill node icon ~53px | 305KB | 82KB |
| `ui/tien-hiep-2026-10/tribulation/chapter-plaque-v1.png` | 690×220 | 512×163 | chapter plaque ~300px | 292KB | 136KB |
| `ui/tien-hiep-2026-10/body/biceps-right-unlit-v1.png` | 350×512 | 175×256 | biceps ~120px | 284KB | 30KB |
| `ui/tien-hiep-2026-10/body/biceps-left-unlit-v1.png` | 350×512 | 175×256 | biceps ~120px | 282KB | 30KB |
| `skills/nodes/thau-hoa-v1.png` | 496×512 | 248×256 | skill node icon ~53px | 281KB | 82KB |
| `skills/nodes/tich-diem-v1.png` | 512×512 | 256×256 | skill node icon ~53px | 275KB | 79KB |
| `skills/nodes/du-tan-v1.png` | 512×505 | 256×252 | skill node icon ~53px | 274KB | 78KB |
| `skills/nodes/tan-diem-v1.png` | 496×512 | 248×256 | skill node icon ~53px | 257KB | 73KB |
| `skills/nodes/hoa-dao-tinh-thong-v1.png` | 508×512 | 254×256 | skill node icon ~53px | 249KB | 70KB |
| `ui/tien-hiep-2026-10/body/meridian-ring-unlit-v1.png` | 768×290 | 512×193 | meridian ~200px | 241KB | 30KB |
| `ui/tien-hiep-2026-10/controls/skill-connection-pipe-v1.png` | 1651×96 | 512×30 | skill pipe <=256px | 240KB | 21KB |
| `ui/tien-hiep-2026-10/controls/equipment-level-seal-v1.png` | 361×339 | 256×240 | level seal ~64px | 238KB | 86KB |
| `ui/tien-hiep-2026-10/body/meridian-node-unlit-v1.png` | 768×300 | 512×200 | meridian ~150px | 234KB | 36KB |
| `skills/nodes/ngo-hoa-v1.png` | 512×503 | 256×252 | skill node icon ~53px | 234KB | 65KB |
| `ui/tien-hiep-2026-10/body/meridian-tube-lit-v1.png` | 768×165 | 512×110 | meridian ~200px | 225KB | 46KB |
| `skills/nodes/tam-muoi-chan-y-v1.png` | 487×512 | 244×256 | skill node icon ~53px | 213KB | 61KB |
| `ui/tien-hiep-2026-10/body/meridian-junction-unlit-v1.png` | 768×269 | 512×179 | meridian ~200px | 209KB | 27KB |
| `skills/nodes/liet-hoa-v1.png` | 471×512 | 236×256 | skill node icon ~53px | 207KB | 60KB |
| `ui/tien-hiep-2026-10/body/meridian-tube-unlit-v1.png` | 768×165 | 512×110 | meridian ~200px | 194KB | 44KB |
| `skills/nodes/dan-hoa-v1.png` | 496×512 | 248×256 | skill node icon ~53px | 182KB | 53KB |
| `ui/tien-hiep-2026-10/combat/health-frame-v1.png` | 641×133 | 512×106 | health frame ~200px | 165KB | 52KB |
| `ui/tien-hiep-2026-10/controls/equipment-divider-v1.png` | 767×65 | 256×22 | divider ~64px | 123KB | 9KB |

## 2. Nhóm CẤM resize (báo cáo, không đụng)

Lý do tổng quát: code đọc `naturalWidth/naturalHeight` hoặc so pixel với số khai báo (test IHDR, manifest `sourceWidth/sourceHeight/sourceSize/extent/avatarSize`, `border-image-slice` nine-slice, sprite atlas `.json` frame rect, svg viewBox khớp px gốc).

| Thư mục | Số file | Dung lượng | Lý do |
|---|---|---|---|
| `public/assets/backgrounds/dong-fu` | 1 | 2.7MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/dong-fu/modular/seasons/autumn` | 7 | 8.4MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/dong-fu/modular/seasons/spring` | 7 | 8.5MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/dong-fu/modular/seasons/summer` | 7 | 8.7MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/dong-fu/modular/seasons/winter` | 7 | 7.9MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/dong-fu/modular/times/evening` | 3 | 4.5MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/dong-fu/modular/times/morning` | 3 | 3.0MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/dong-fu/modular/times/night` | 3 | 3.5MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/dong-fu/modular/times/noon` | 3 | 2.8MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/thanh-van/modular/seasons/autumn` | 6 | 8.1MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/thanh-van/modular/seasons/spring` | 6 | 8.4MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/thanh-van/modular/seasons/summer` | 6 | 6.5MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/thanh-van/modular/seasons/winter` | 6 | 8.9MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/thanh-van/modular/times/evening` | 1 | 1.8MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/thanh-van/modular/times/morning` | 1 | 1.4MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/thanh-van/modular/times/night` | 1 | 1.9MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/thanh-van/modular/times/noon` | 1 | 1.5MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/backgrounds/thanh-van/spring/morning` | 7 | 9.9MB | dongFuBackgroundAssets.test pin IHDR 1672x941 + THANH_VAN_CANVAS |
| `public/assets/buildings/dong-fu` | 6 | 11.5MB | dongFuBuildingAssets.test pin IHDR 1254x1254 + visualBounds/hitbox px |
| `public/assets/buildings/dong-fu/v2/chi_hien_quan` | 4 | 1.5MB | dongFuBuildingAssets.test pin IHDR 1254x1254 + visualBounds/hitbox px |
| `public/assets/buildings/dong-fu/v2/equipment_hall` | 4 | 1.6MB | dongFuBuildingAssets.test pin IHDR 1254x1254 + visualBounds/hitbox px |
| `public/assets/buildings/dong-fu/v2/gathering_outpost` | 4 | 1.8MB | dongFuBuildingAssets.test pin IHDR 1254x1254 + visualBounds/hitbox px |
| `public/assets/buildings/dong-fu/v2/pill_room` | 4 | 1.6MB | dongFuBuildingAssets.test pin IHDR 1254x1254 + visualBounds/hitbox px |
| `public/assets/buildings/dong-fu/v2/shared/seasons` | 4 | 2.8MB | dongFuBuildingAssets.test pin IHDR 1254x1254 + visualBounds/hitbox px |
| `public/assets/buildings/dong-fu/v2/spirit_spring` | 4 | 1.5MB | dongFuBuildingAssets.test pin IHDR 1254x1254 + visualBounds/hitbox px |
| `public/assets/buildings/dong-fu/v2/teleport_array` | 4 | 1.0MB | dongFuBuildingAssets.test pin IHDR 1254x1254 + visualBounds/hitbox px |
| `public/assets/buildings/dong-fu/v2/vendor` | 4 | 1.3MB | dongFuBuildingAssets.test pin IHDR 1254x1254 + visualBounds/hitbox px |
| `public/assets/characters/animated/fenli` | 2 | 6.4MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/fenli/avatar` | 2 | 67KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/fenli/portrait` | 3 | 782KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/gaosheng` | 3 | 9.7MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/gaosheng/avatar` | 5 | 207KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/gaosheng/closeup` | 1 | 1.3MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/gaosheng/portrait` | 3 | 2.5MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/gaosheng/radar-chart` | 2 | 304KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/jinglian` | 2 | 3.6MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/jinglian/avatar` | 2 | 67KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/jinglian/portrait` | 3 | 804KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/ngu_hanh` | 4 | 11.8MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/ngu_kiem` | 2 | 7.4MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/pham_nhan` | 3 | 6.7MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/pham_nhan_unarmed` | 3 | 8.1MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/phap_tu_shared` | 6 | 3.9MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/qingshuangzi` | 2 | 11.2MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/qingshuangzi/avatar` | 5 | 238KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/qingshuangzi/closeup` | 1 | 1.9MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/qingshuangzi/portrait` | 3 | 2.0MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/qingshuangzi/radar-chart` | 2 | 304KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/weiqi` | 2 | 2.3MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/weiqi/avatar` | 2 | 79KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/weiqi/portrait` | 3 | 857KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/xuandao` | 2 | 4.0MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/xuandao/avatar` | 2 | 41KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/xuandao/portrait` | 3 | 1.2MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/youzhu` | 3 | 10.7MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/youzhu/avatar` | 5 | 180KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/youzhu/closeup` | 1 | 1.8MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/youzhu/portrait` | 3 | 1.9MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/youzhu/radar-chart` | 2 | 304KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/yuejianxin` | 3 | 7.5MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/yuejianxin/avatar` | 5 | 229KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/yuejianxin/closeup` | 1 | 1.5MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/yuejianxin/portrait` | 3 | 2.4MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/yuejianxin/radar-chart` | 2 | 303KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/ziyuan` | 2 | 3.1MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/ziyuan/avatar` | 2 | 96KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/ziyuan/portrait` | 3 | 1.0MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/zuofeng` | 4 | 14.6MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/zuofeng/avatar` | 5 | 221KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/zuofeng/closeup` | 1 | 1.1MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/zuofeng/portrait` | 3 | 1.9MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/animated/zuofeng/radar-chart` | 2 | 305KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/placeholder` | 2 | 124KB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/player/kiem-tu` | 2 | 2.1MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/player/mortal` | 7 | 7.5MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/characters/player/phap-tu` | 4 | 6.3MB | manifest.json pin w/h tung file + CharacterArt sourceSize/extent/avatarSize + test IHDR |
| `public/assets/enemies/animated/blood-locust-elder` | 2 | 6.9MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/bloodarm-ox-demon` | 2 | 1.1MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/bloodarm-ox-demon-ferocious` | 2 | 1.1MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/bloodflower-tree-fiend-mudboss` | 2 | 9.0MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/bloodflower-tree-fiend-mudboss-ferocious` | 2 | 8.8MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/drybranch-treant` | 2 | 2.4MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/drybranch-treant-ferocious` | 2 | 2.3MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/duskmane-spirit-wolf` | 2 | 663KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/duskmane-spirit-wolf-ferocious` | 2 | 631KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/graymane-wolf` | 2 | 894KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/graymane-wolf-ferocious` | 2 | 933KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/mudbelly-green-toad` | 2 | 2.3MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/mudbelly-green-toad-ferocious` | 2 | 2.4MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/redscarf-blade-bandit` | 2 | 730KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/redscarf-blade-bandit-ferocious` | 2 | 718KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/spore-flower-spirit` | 2 | 911KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/spore-flower-spirit-ferocious` | 2 | 897KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/streamgrudge-nymph` | 2 | 1.9MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/streamscale-forkman-floodserpent` | 2 | 1.4MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/streamscale-forkman-floodserpent-ferocious` | 2 | 1.4MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/tusked-mountain-boar` | 2 | 840KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/tusked-mountain-boar-ferocious` | 2 | 819KB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/whiteshell-venom-beetle` | 2 | 1.1MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/whiteshell-venom-beetle-ferocious` | 2 | 1.2MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/witherfir-vineman` | 2 | 1.7MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/animated/wugu-demon-king` | 5 | 14.7MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/enemies/mortal` | 12 | 18.8MB | MonsterArt avatarSize/extent + ENEMY_SOURCE_SIZE 1254 + atlas.json + test IHDR |
| `public/assets/ui/huyen-kim/alchemy` | 2 | 796KB | chrome manifest (alchemy-cauldron-prop) |
| `public/assets/ui/huyen-kim/scene/auth` | 12 | 57.1MB | StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec) |
| `public/assets/ui/huyen-kim/scene/body` | 4 | 2.7MB | StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec) |
| `public/assets/ui/huyen-kim/scene/character-v2` | 1 | 2.4MB | border-image nine-slice (slice tinh theo px goc) |
| `public/assets/ui/huyen-kim/scene/dong-fu-v2` | 1 | 2.1MB | border-image nine-slice (slice tinh theo px goc) |
| `public/assets/ui/huyen-kim/scene/map` | 6 | 53KB | StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec) |
| `public/assets/ui/huyen-kim/scene/realm` | 10 | 18.8MB | StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec) |
| `public/assets/ui/huyen-kim/scene/skill` | 8 | 11.5MB | StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec) |
| `public/assets/ui/huyen-kim/scene/tribulation` | 8 | 45.7MB | StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec) |
| `public/assets/ui/ink-wash/slices` | 22 | 3.4MB | nine-slice ink-wash-ui-slices.json (sourceWidth/Height + slices px) |
| `public/assets/ui/tien-hiep-2026-10/controls` | 3 | 5.7MB | border-image nine-slice (slice tinh theo px goc) |
| `public/assets/ui/tien-hiep-2026-10/runtime` | 105 | 24.1MB | huyen-kim-chrome.json 44 slot: test pin IHDR @1x + @2x=2x |
| `public/assets/ui/tien-hiep-2026-10/source` | 1 | 2.3MB | PcBodyDiagram svg viewBox=1174x1178 khop pixel goc |
| `public/assets/vfx/hoa-cau-thuat/charge` | 1 | 622KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/hoa-cau-thuat/charge-azure` | 1 | 642KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/hoa-cau-thuat/circle` | 3 | 2.8MB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/hoa-cau-thuat/fire-stroke` | 1 | 1.3MB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/hoa-cau-thuat/portal` | 3 | 5.9MB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/hoa-cau-thuat/projectile` | 1 | 863KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/hoa-cau-thuat/projectile-empowered` | 1 | 884KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/hoa-cau-thuat/tam-muoi-aura` | 3 | 1.7MB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/linh-bao` | 1 | 442KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-bite` | 1 | 337KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-bite-multi` | 1 | 602KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-boss-ground-slam` | 1 | 799KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-claw` | 1 | 220KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-earth-shockwave` | 1 | 523KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-ram` | 1 | 211KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-ram-multi` | 1 | 473KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-slash-horizontal` | 1 | 134KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-slash-multi` | 1 | 230KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-slash-vertical` | 1 | 132KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-stomp` | 1 | 443KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-stomp-multi` | 1 | 741KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/mob-water-surge` | 1 | 435KB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |
| `public/assets/vfx/spritesheets` | 564 | 181.6MB | sprite-sheet/VFX atlas (.json frame rect + fitPx/firstFrame..lastFrame px) |

File CẤM lẻ (ngoài các thư mục trên):

- `ui/huyen-kim/scene/tribulation/tribulation-sky-vignette@2x.png` (3344×1882, 12.7MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/tribulation/tribulation-storm-near@2x.png` (3344×1882, 10.3MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/00-sky@2x.png` (3344×1882, 9.5MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/02-mid-landscape@2x.png` (3344×1882, 9.3MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/04-low-mist@2x.png` (3344×1882, 9.1MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/tribulation/tribulation-storm-far@2x.png` (3344×1882, 7.8MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/01-far-mountains@2x.png` (3344×1882, 6.3MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/03-focal-architecture@2x.png` (3344×1882, 5.7MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/tribulation/tribulation-dais@2x.png` (3344×1882, 4.8MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/05-foreground@2x.png` (3344×1882, 4.5MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/02-mid-ascent@2x.png` (1624×1220, 4.4MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/00-sky@2x.png` (1624×1220, 4.1MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/tribulation/tribulation-sky-vignette@1x.png` (1672×941, 3.9MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/04-low-mist@2x.png` (1624×1220, 3.6MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/tien-hiep-2026-10/controls/body-diagram-v1.png` (1174×1178, 2.9MB) — PcBodyDiagram svg viewBox=1174x1178 khop pixel goc
- `ui/huyen-kim/scene/tribulation/tribulation-storm-near@1x.png` (1672×941, 2.8MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/04-low-mist@1x.png` (1672×941, 2.8MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/00-sky@1x.png` (1672×941, 2.8MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/skill/00-sky@2x.png` (1280×940, 2.7MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/02-mid-landscape@1x.png` (1672×941, 2.6MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/skill/03-atmosphere@2x.png` (1280×940, 2.4MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/character-v2/paper-nine-slice.png` (1254×1254, 2.4MB) — border-image nine-slice (slice tinh theo px goc)
- `ui/tien-hiep-2026-10/source/shared-body-diagram-v1.png` (1254×1254, 2.3MB) — PcBodyDiagram svg viewBox=1174x1178 khop pixel goc
- `ui/huyen-kim/scene/skill/01-far-mountains@2x.png` (1280×940, 2.3MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/tribulation/tribulation-storm-far@1x.png` (1672×941, 2.1MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/dong-fu-v2/panel-nine-slice.png` (1254×1254, 2.1MB) — border-image nine-slice (slice tinh theo px goc)
- `ui/huyen-kim/scene/body/body-cultivation-figure@2x.png` (1280×1040, 1.9MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/01-far-mountains@1x.png` (1672×941, 1.8MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/skill/02-celestial-field@2x.png` (1280×940, 1.7MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/01-far-mountains@2x.png` (1624×1220, 1.6MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/03-focal-architecture@1x.png` (1672×941, 1.5MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png` (1416×650, 1.5MB) — border-image nine-slice (slice tinh theo px goc)
- `ui/tien-hiep-2026-10/controls/character-card-nine-slice-v1.png` (1484×1060, 1.4MB) — border-image nine-slice (slice tinh theo px goc)
- `ui/huyen-kim/scene/tribulation/tribulation-dais@1x.png` (1672×941, 1.2MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/03-summit-architecture@2x.png` (1624×1220, 1.2MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/auth/05-foreground@1x.png` (1672×941, 1.2MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/02-mid-ascent@1x.png` (812×610, 1.1MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/00-sky@1x.png` (812×610, 1.1MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/04-low-mist@1x.png` (812×610, 1.0MB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/skill/00-sky@1x.png` (640×470, 677KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/skill/03-atmosphere@1x.png` (640×470, 642KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/skill/01-far-mountains@1x.png` (640×470, 574KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/body/body-cultivation-figure@1x.png` (640×520, 473KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/skill/02-celestial-field@1x.png` (640×470, 463KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/01-far-mountains@1x.png` (812×610, 420KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/realm/03-summit-architecture@1x.png` (812×610, 305KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/body/body-meridian-overlay@2x.png` (1280×1040, 196KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/body/body-meridian-overlay@1x.png` (640×520, 73KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/map/exploration-map-frame@2x.png` (1400×1048, 19KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/map/exploration-map-mask@2x.png` (1400×1048, 13KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/map/exploration-map-frame@1x.png` (700×524, 12KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/map/exploration-map-mask@1x.png` (700×524, 5KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/map/exploration-chapter-divider@2x.png` (1240×32, 0KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)
- `ui/huyen-kim/scene/map/exploration-chapter-divider@1x.png` (620×16, 0KB) — StableSceneArt layer manifest (width/height khai bao + @1x/@2x spec)

## 3. Không tham chiếu runtime

Các file/thư mục này không thấy tham chiếu trong code (preview, source PSD-like, draft, atlas extraction gốc). Resize cũng vô ích vì không render — đề xuất **xóa hoặc dời ra ngoài `public/`** để giảm payload deploy.

| Thư mục | Số file | Dung lượng |
|---|---|---|
| `public/assets/equipment/items/base-bao` | 4 | 44KB |
| `public/assets/equipment/items/base-chau` | 4 | 34KB |
| `public/assets/equipment/items/base-gioi` | 4 | 42KB |
| `public/assets/equipment/items/base-hai` | 5 | 50KB |
| `public/assets/equipment/items/base-kiem` | 4 | 20KB |
| `public/assets/equipment/items/base-quan` | 4 | 35KB |
| `public/assets/equipment/items/base-quyen` | 5 | 42KB |
| `public/assets/equipment/items/base-truy` | 5 | 26KB |
| `public/assets/skills` | 1 | 139KB |
| `public/assets/ui` | 3 | 1.6MB |
| `public/assets/ui/huyen-kim/_source/generated` | 25 | 51.3MB |
| `public/assets/ui/huyen-kim/preview` | 15 | 10.1MB |
| `public/assets/ui/huyen-kim/scene/body-v2` | 3 | 1.8MB |
| `public/assets/ui/huyen-kim/scene/dong-fu-v2` | 1 | 3.2MB |
| `public/assets/ui/huyen-kim/scene/realm-v2` | 1 | 3.0MB |
| `public/assets/ui/ink-wash/review` | 1 | 354KB |
| `public/assets/ui/tien-hiep-2026-10/body` | 16 | 3.0MB |
| `public/assets/ui/tien-hiep-2026-10/body/source` | 5 | 9.0MB |
| `public/assets/ui/tien-hiep-2026-10/combat` | 7 | 3.0MB |
| `public/assets/ui/tien-hiep-2026-10/controls` | 3 | 8.1MB |
| `public/assets/ui/tien-hiep-2026-10/drafts` | 4 | 6.7MB |
| `public/assets/ui/tien-hiep-2026-10/icons` | 19 | 2.2MB |
| `public/assets/ui/tien-hiep-2026-10/source` | 13 | 21.6MB |
| `public/assets/ui/tien-hiep-2026-10/tribulation` | 2 | 1.8MB |

## 4. Chỉ thấy trong AssetBundleCatalog (preload Phaser)

Phaser `add.image` render theo px gốc — thiếu bằng chứng render size nên không resize.

- `ui/huyen-kim/scene/login-v2/scroll-panel.png` (1086×1448, 2.3MB)
- `ui/huyen-kim/scene/login-v2/jade-button.png` (2172×724, 1.3MB)
- `ui/tien-hiep-2026-10/source/ceremony-ribbon-red.png` (2172×724, 1.0MB)
- `ui/elements/banner-water.png` (465×152, 143KB)
- `ui/elements/banner-wood.png` (445×175, 141KB)
- `ui/elements/banner-earth.png` (475×154, 140KB)
- `ui/elements/banner-fire.png` (470×152, 138KB)
- `ui/elements/banner-metal.png` (465×172, 119KB)
- `ui/elements/banner-primordial.png` (342×88, 37KB)

## 5. Giữ nguyên (đã nhỏ hơn 2× render)

301 file — chủ yếu icon/item 64–256px, overlay ink-wash, source vista, paper-surface…

## Đề xuất bước tiếp cho nhóm CẤM

1. **Nine-slice** (`runtime/*`, `ink-wash/slices/*`, `*-nine-slice`, `character-card-nine-slice`): muốn resize phải đổi manifest: scale `sourceWidth/sourceHeight` + toàn bộ `slices/center` theo cùng tỉ lệ, và sửa test đọc IHDR tương ứng.
2. **Sprite/atlas** (`vfx/**`, `characters/**`, `enemies/**`): phải regenerate atlas JSON (frame rect, sourceSize, extent) — để script art-pipeline xuất lại ở kích thước mới.
3. **Stable scene layers** (`scene/{auth,realm,tribulation,skill,body,map}`): chỉ có bản @2x nặng; nếu muốn giảm, đổi `width/height` khai trong `StableSceneArt.ts` + test @1x/@2x.
4. **Không tham chiếu**: dời `huyen-kim/_source`, `huyen-kim/preview`, `tien-hiep-2026-10/drafts`, `body/source`, `combat/component-sheet`, `tribulation/component-sheet` ra ngoài `public/` → giảm ~127.3MB mà không đụng pixel contract nào.
