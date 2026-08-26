# Kế hoạch Phù và Trận Pháp hậu kỳ

## 1. Quyết định sản phẩm

Phù và Trận Pháp không còn là socket, affix phụ hoặc một phần của Equipment.
Hai hệ thống được đưa ra khỏi phạm vi phát triển hiện tại và chỉ mở lại khi
progression thật đạt đúng cảnh giới yêu cầu.

| Hệ thống | Cảnh giới mở khóa | Vai trò chiến đấu |
|---|---|---|
| Phù | Kim Đan | Ultimate skill tự động, tạo hiệu ứng bùng nổ có chu kỳ dài |
| Trận Pháp | Nguyên Anh | Aura toàn chiến trường, cung cấp buff/debuff mang tính nền |

Equipment tiếp tục phụ trách chỉ số, affix và sức mạnh cá nhân. Không thêm
`talismanSlot`, `formationSlot`, `appliedTalismanIds` hoặc Formation socket mới
vào Equipment.

## 2. Trạng thái khóa hiện tại

Cho tới khi từng phase được triển khai đầy đủ:

- Khóa công trình `talisman_institute` (Phù Viện) và `formation_altar` (Trận Đài).
- Khóa entry điều hướng, panel, recipe và thao tác chế tạo tương ứng.
- UI khóa phải hiển thị lý do và cảnh giới yêu cầu:
  - `Phù Viện — mở khóa tại Kim Đan`.
  - `Trận Đài — mở khóa tại Nguyên Anh`.
- Không cấp Phù/Trận mới qua loot, recipe, quest hoặc reward.
- Dữ liệu/save legacy được giữ nguyên trong lúc khóa; không tự xóa, quy đổi hoặc
  hoàn trả cho tới khi có đặc tả migration riêng.
- Không mở tạm chức năng chỉ vì building legacy đã tồn tại trong save.

Việc thực thi khóa runtime/UI là một workstream riêng. Tài liệu này chốt contract
sản phẩm, không coi hệ thống đã hoàn thành chỉ vì icon bị ẩn.

## 3. Phù — ultimate skill tại Kim Đan

### Contract MVP

- Mỗi loadout trang bị đúng một Phù chủ động.
- Phù không chiếm slot kỹ năng thường và không gắn vào equipment.
- Combat tự nạp `talismanEnergy` từ hành động đã định nghĩa trong data.
- Đủ năng lượng thì Phù tự kích hoạt theo rule idle; không yêu cầu thao tác tay.
- Chu kỳ chuẩn: `nạp -> báo hiệu -> kích hoạt -> hồi phục`.
- HUD có một ô Ultimate riêng, hiển thị tiến độ nạp và trạng thái sẵn sàng.

```ts
interface TalismanUltimateDefinition {
  id: string
  unlockRealm: 'golden_core'
  chargeRule: TalismanChargeRule
  chargeRequired: number
  activationRule: TalismanActivationRule
  effects: TalismanUltimateEffect[]
}
```

Rule kích hoạt phải deterministic và dùng được trong auto-combat. MVP giới hạn
ở `when_ready`, `boss_only`, `hp_below_percent` và `enemy_count_at_least`.
Không kéo/thả Phù lên bàn cờ, không dùng như consumable, không socket vào sáu
slot equipment và không cho trang bị nhiều Ultimate cùng lúc.

## 4. Trận Pháp — aura chiến trường tại Nguyên Anh

### Contract MVP

- Mỗi loadout chọn đúng một Trận Pháp.
- Trận tự triển khai khi battle bắt đầu và tồn tại suốt trận.
- Không yêu cầu đặt trận nhãn hoặc điều khiển vị trí thủ công.
- Scope hiệu ứng phải rõ ràng: `player`, `allies`, `enemies` hoặc `battlefield`.
- Modifier thuộc battle, không ghi ngược vào equipment hay permanent player stats.
- Bàn cờ chỉ trực quan hóa aura/trận văn; idle gameplay không phụ thuộc thao tác
  trên 361 giao điểm.

Nhóm hiệu ứng MVP gồm tăng/giảm sát thương gây ra, sát thương nhận vào, tốc độ
hành động, tốc độ di chuyển, hồi phục và kháng hiệu ứng.

```ts
interface FormationAuraDefinition {
  id: string
  unlockRealm: 'nascent_soul'
  effects: FormationAuraEffect[]
  visualTheme: string
}
```

Mọi modifier phải có source ID, được thêm khi battle bắt đầu và gỡ khi kết thúc.
Không snapshot chồng qua auto-refight/save-load. Slow phải có cap và boss
resistance. MVP chưa có nạp trận, xoay trận đồ, phá trận nhãn hay đặt node.

## 5. Quan hệ với bàn cờ chiến trường

- Bàn cờ và quy ước 19×19 theo
  combat grid 10×16 hiện hành.
- Phù khi kích hoạt có thể thắp sáng một giao điểm/vùng rồi phát hiệu ứng.
- Trận Pháp hiển thị trận văn, màu aura và đường linh lực trên toàn bàn.
- Chín điểm sao chỉ làm anchor VFX, không phải chín nút phải cấu hình trong MVP.
- Tọa độ damage/AOE vẫn do battle grid quyết định; không suy damage từ hình VFX.

## 6. Trình tự phát triển sau

### Phase A — khóa legacy

1. Thêm realm gate dùng chung cho building và function navigation.
2. Khóa Phù Viện/Trận Đài cùng toàn bộ đường vào panel/recipe.
3. Chặn reward/craft mới nhưng bảo toàn save legacy.
4. Thêm test save có building cũ vẫn không vượt realm gate.

### Phase B — Phù tại Kim Đan

1. Chốt charge/activation contracts và save state.
2. Tạo một Ultimate mẫu, HUD riêng và auto rule.
3. Mở Phù Viện tại Kim Đan để chế/nâng Phù theo hệ mới.
4. Thêm simulation cho thời gian nạp và DPS burst.

### Phase C — Trận Pháp tại Nguyên Anh

1. Tạo battle-scoped modifier authority.
2. Tạo một aura buff và một aura debuff mẫu.
3. Mở Trận Đài tại Nguyên Anh để chế/nâng/chọn Trận.
4. Thêm VFX bàn cờ và kiểm tra auto-refight không double-apply.

### Phase D — migration legacy

Chỉ làm sau khi catalog mới ổn định. Lập bảng quy đổi riêng cho Phù/Trận socket
cũ; migration phải idempotent và không làm mất affix/equipment hiện hữu.

## 7. Tiêu chí nghiệm thu tương lai

- Trước Kim Đan không thể xây, mở panel, craft hoặc nhận Phù mới.
- Tại Kim Đan, Phù là Ultimate riêng và tự vận hành trong idle combat.
- Trước Nguyên Anh không thể xây, mở panel, craft hoặc nhận Trận mới.
- Tại Nguyên Anh, Trận áp dụng đúng một lần cho toàn battle và được gỡ sạch.
- Không có Phù/Trận mới nào được socket vào equipment.
- Auto-refight, save/load và offline progression không nhân đôi charge/modifier.
- UI luôn nói rõ cảnh giới mở khóa thay vì chỉ ẩn chức năng.
