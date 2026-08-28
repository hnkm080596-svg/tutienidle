# Kế hoạch Âm thanh & Game Feel

> Thuộc Phase 2 của [roadmap.md](./roadmap.md). Giải quyết khoảng trống game-feel lớn nhất: **game hiện không có một file âm thanh nào** (kiểm chứng 2026-08-27: 0 file mp3/ogg/wav trong `src/` và `public/`), trong khi 1.137 spritesheet VFX trong `public/assets/vfx/spritesheets/` không được code nào tham chiếu.

## 1. Mục tiêu

- Có âm thanh cho các khoảnh khắc chính: đánh/trúng/chí mạng/chết, cast skill, đột phá, Độ Kiếp, thao tác UI.
- Thêm hit-stop và mở rộng screen shake cho combat.
- Quyết định số phận 1.137 spritesheet VFX: tận dụng hoặc loại bỏ.
- Âm thanh có setting âm lượng/tắt, persist qua session.

## 2. Hiện trạng

- 0 file audio trong project.
- VFX runtime chỉ là burst màu đơn sắc qua `src/data/vfx/CombatVfxPresets.ts` (13 preset) và `StatusVfxPresets.ts`; chỉ `boss_ground_slam` có screen shake; không có hit-stop.
- `public/assets/vfx/spritesheets/` chứa ~1.137 spritesheet FX bên thứ ba, grep không thấy code nào tham chiếu — nặng build vô ích.
- Teleport avatar còn TODO hook VFX (`src/core/battle/BattleSystem.ts:1796`).
- Core ↔ Phaser giao tiếp qua EventBus — điểm treo tự nhiên cho audio.

## 3. Thiết kế

### 3.1 Kiến trúc audio

- `src/core/audio/AudioManager.ts`: singleton thuần TypeScript, không phụ thuộc Phaser. Dùng Web Audio API (`AudioContext`) với fallback hợp lý; preload lazy theo nhóm.
- API tối thiểu:

```ts
export type SoundId =
  | 'combat_hit' | 'combat_crit' | 'combat_kill' | 'combat_cast'
  | 'combat_player_hurt' | 'breakthrough_success' | 'breakthrough_fail'
  | 'tribulation_thunder' | 'ui_click' | 'ui_panel_open' | 'loot_drop'

export interface AudioSettings {
  masterVolume: number   // 0..1
  sfxVolume: number      // 0..1
  muted: boolean
}

class AudioManager {
  play(id: SoundId): void
  setSettings(settings: AudioSettings): void
}
```

- AudioManager **đăng ký nghe EventBus** cùng các event combat mà `CombatScene.ts` đang dùng (hit, crit, kill, cast…) — không thêm event mới trừ khi cần. UI component gọi `play('ui_click')` trực tiếp tại handler.
- Chống spam âm thanh: throttle theo nhóm (vd hit tối đa N phát/giây, cùng pattern damage number gom 3 lần/giây hiện có).
- Setting lưu localStorage key riêng (không vào GameSave — tránh bump schema cho setting; nếu sau này cần đồng bộ thì chuyển vào save sau).

### 3.2 Danh sách âm thanh tối thiểu (đợt 1)

| SoundId | Khoảnh khắc | Ưu tiên |
|---|---|---|
| `combat_hit` | Đòn thường trúng | Cao |
| `combat_crit` | Chí mạng | Cao |
| `combat_kill` | Quái chết | Cao |
| `combat_cast` | Bắt đầu cast skill | Cao |
| `combat_player_hurt` | Player nhận sát thương | Cao |
| `breakthrough_success` / `breakthrough_fail` | Kết quả đột phá | Cao |
| `tribulation_thunder` | Sét Độ Kiếp | Cao |
| `ui_click` / `ui_panel_open` | Thao tác UI cơ bản | Trung bình |
| `loot_drop` | Rơi trang bị hiếm | Trung bình |

### 3.3 Asset âm thanh — dependency bên ngoài

- Nguồn đề xuất: asset CC0/public domain (freesound.org, OpenGameArt…) hoặc tự tạo. **Không dùng asset không rõ giấy phép.**
- Checklist asset là deliverable của plan này: mỗi SoundId cần 1 file final (wav/ogg, < 200KB/file cho SFX ngắn), đặt tại `public/assets/audio/sfx/`.
- Trong khi chưa có asset final: code audio hoàn chỉnh với placeholder im lặng (registry có entry nhưng chưa có file → `play()` no-op, không lỗi). Không block code chờ asset.

### 3.4 Hit-stop và screen shake

- **Hit-stop**: đóng băng timeline combat 40–80ms khi (a) boss chết, (b) chí mạng từ skill keystone. Implement trong `BattleSystem` (pause tick) + `CombatScene` (pause tween) qua 1 event mới `combat_hitstop`. Không hit-stop cho đòn thường — sẽ gây giật.
- **Screen shake**: mở rộng `CombatVfxPresets.ts` — thêm shake cho: player bị đánh trúng bởi boss, reaction kích hoạt, Độ Kiếp sét. Giữ cường độ nhỏ (2–6px, 100–250ms), có setting giảm shake cho người nhạy cảm (1 toggle trong audio/settings panel).

### 3.5 Spritesheet VFX — audit và quyết định

1. Kiểm kê nhanh: phân loại 1.137 file theo bộ (tên thư mục/prefix), xác định nguồn gốc giấy phép.
2. Chọn 5–10 spritesheet phù hợp làm impact FX theo nguyên tố (thay burst màu đơn sắc): hỏa/thủy/mộc/kim/thổ mỗi hành 1 bộ + 1 bộ hit chung. Tích hợp vào `CombatScene` qua animation Phaser.
3. Xóa toàn bộ file không dùng sau khi chọn xong (giữ build nhẹ). Nếu giấy phép không rõ → xóa hết, không dùng.
4. Việc này phối hợp với combat-balance-pass (icon reaction) và có thể thực hiện song song.

### 3.6 VFX teleport

- Implement hook TODO tại `BattleSystem.ts:1796`: phát event teleport; `CombatScene` vẽ vệt dịch chuyển đơn giản (dùng preset có sẵn hoặc spritesheet chọn ở §3.5).

## 4. Nhiệm vụ triển khai

1. **Task 1**: `AudioManager` + registry + setting localStorage + test unit (play no-op khi chưa có file, throttle, volume clamp).
2. **Task 2**: Treo AudioManager vào EventBus combat (hit/crit/kill/cast/hurt) + throttle theo nhóm.
3. **Task 3**: Sound đột phá/Độ Kiếp/UI (gọi trực tiếp từ component/composable liên quan).
4. **Task 4**: Hit-stop + mở rộng screen shake + toggle giảm shake.
5. **Task 5**: Audit spritesheet → chọn bộ dùng → tích hợp impact FX nguyên tố → xóa file thừa.
6. **Task 6**: VFX teleport (§3.6).
7. **Task 7**: Checklist asset final + thay placeholder khi có asset (task mở, không block nghiệm thu code).

Mỗi task kết thúc: test xanh + type-check; Task 5 kết thúc bằng build không còn file thừa.

## 5. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Unit test: AudioManager (throttle, setting, no-op an toàn); hit-stop đóng băng đúng duration và không ảnh hưởng kết quả combat (deterministic).
- Thủ công: chơi 1 trận có crit/kill/boss; âm thanh không spam; mute hoạt động sau reload.
- Kiểm tra kích thước `dist/` trước và sau Task 5 (kỳ vọng giảm đáng kể sau khi xóa spritesheet thừa).

## 6. Rủi ro và lưu ý

- **Giấy phép asset**: rủi ro pháp lý lớn nhất. Chỉ nhận asset CC0 hoặc tự tạo; ghi nguồn từng file vào `public/assets/audio/CREDITS.md`.
- **Autoplay policy trình duyệt**: AudioContext phải resume sau gesture người dùng — AudioManager xử lý resume ở click/keydown đầu tiên.
- **Âm thanh Electron**: kiểm tra audio chạy trong build Electron (`electron/`), không chỉ browser dev.
- Không thêm nhạc nền trong plan này (quyết định riêng về asset và dung lượng); chỉ SFX.
