# Thiết kế Hệ Đột Phá / Bậc Ẩn / Lôi Kiếp

> Spec kiến trúc, lập 2026-08-29 sau chu kỳ brainstorming nhiều vòng.
> Thay thế toàn bộ hệ Độ Kiếp hiện tại (TribulationSystem + trận đánh quái Kiếp + Đột Phá Lệnh).
> Ngày 2 đảo chiều: quyết định của người chơi trong các phiên hỏi đáp được tôn trọng đầy đủ — mọi ý tưởng gốc xuất hiện nguyên vẹn trong tài liệu này.

## 0. Quyết định đã chốt (từ brainstorming)

1. **Framework đầy đủ 9 realm**: mọi gate đều được spec cấu trúc; nội dung realm cao có thể trống nhưng cơ chế tổng quát.
2. **Bậc ẩn riêng mỗi gate** đại cảnh giới — mỗi gate tự thiết kế điều kiện, không theo motif chung. Cảnh giới thứ 3 mỗi địa giới ẩn thêm 1 bậc tối thượng khắc nghiệt (pattern "Đại Đạo").
3. **Chính sách phơi bày 3 tầng**: bậc 1 (Nhân) công khai trong UI gate; bậc giữa (Địa/Thiên) có manh mối flavor text, không liệt kê; bậc tối thượng (Đại Đạo) ẩn hoàn toàn — chỉ biết khi bấm đột phá với đủ điều kiện.
4. **Bậc xét 100% từ đầu tư trước kiếp** — chốt đúng lúc bấm đột phá. Trận kiếp chỉ pass/fail, không cộng/trừ bậc theo biểu hiện trong trận.
5. **Trade-off trung tâm**: bậc càng cao → kiếp càng khó + passive realm càng mạnh.
6. **Hệ kiếp riêng hoàn toàn mới** (`TribulationDirector`): chương kiếp theo realm, KHÔNG quái Kiếp — thuần lôi kích + tâm ma minigame.
7. **Tâm ma = minigame hỏi đáp phản ứng nhanh**: chuỗi câu hỏi trắc nghiệm tốc độ dồn dập, đúng được cơ chế phòng thủ tự động (không chọn), sai stack debuff.
8. **Kiếp là nội dung tay bắt buộc**: vào kiếp dừng mọi vòng tự động (farm, tu luyện); người chơi phải tập trung; cần bấm nút chủ động để độ kiếp (giống hiện trạng).
9. **Thua kiếp Đại Đạo = mất vĩnh viễn** cơ hội bậc tối thượng (trần còn lại: Thiên Đạo).
10. **Bỏ Đột Phá Lệnh** (token craft): gate chỉ còn tầng 12 + Linh Thạch. Người thiết kế chưa từng biết hệ thống này tồn tại → dọn sạch.
11. **Mana chỉ thuộc Pháp Tu**: mọi hệ thống mới trong spec này KHÔNG chạm mana/mana regen — passive Bát Mạch chỉ dùng HP/def/attack/crit/main stat/tốc tu.
12. **Số liệu first-pass để playtest**: mọi hằng số cân bằng ghi rõ đề xuất + đánh dấu "playtest".

## 1. Kiến trúc tổng quan — 3 địa giới

| Địa giới | Cảnh giới | Trạng thái trong spec này |
|---|---|---|
| 1 — Thanh Vân | Phàm Nhân → Luyện Khí → Trúc Cơ | Chi tiết đầy đủ, implement ngay |
| 2 | Kim Đan → Nguyên Anh → Hóa Thần | Chỉ cấu trúc placeholder (số bậc, chương kiếp, loại điều kiện) |
| 3 | Luyện Hư → Hợp Thể → Đại Thừa | Chỉ cấu trúc placeholder |

- 9 realm giữ nguyên mảng `REALMS` hiện có; gate `canTriggerRealmBreakthrough` mở dần theo nội dung realm (không đổi pipeline).
- Mỗi địa giới khi mở nội dung sẽ **brainstorm lại từ đầu** — "tự thiết kế riêng, không theo motif chung" là nguyên tắc, không phải template copy.

## 2. Bậc ẩn — Khung tổng quát

### 2.1. Interface chung

```ts
// core/breakthrough/BreakthroughGrade.ts (mới)
export interface BreakthroughGradeDefinition {
  id: string                    // 'nhan_dao' | 'dia_dao' | 'thien_dao' | 'dai_dao' | ...
  name: string                  // 'Nhân Đạo', 'Địa Đạo', ...
  hiddenLevel: 'public' | 'hinted' | 'secret'  // chính sách phơi bày
}
```

- Mỗi gate có **bảng bậc riêng** (data-driven, `data/breakthrough/BreakthroughGrades.ts`), resolver đọc đúng bảng gate đó.
- `resolveFoundation()` hiện có được thay bằng `resolveBreakthroughGrade(player, targetRealmId, materialBag, pillBag)` tổng quát (giữ pattern truyền bags như resolver cũ — Trúc Cơ Đan nằm trong túi đan) — giữ triết lý âm thầm, đọc dữ liệu thật.
- Passive theo bậc tiếp tục đi qua `RealmPassiveSystem` (pattern `grantedRealmPassiveIds` idempotent sẵn có).

### 2.2. Quản lý vĩnh viễn — 2 flag

| Field PlayerData | Kiểu | Set khi nào | Clear khi nào |
|---|---|---|---|
| `mortalPerfectionAchieved` | `boolean` | Bấm Quán Khí khi 5/5 main stat 10/10 + Luyện Thể 6/6 | Không bao giờ (snapshot lịch sử) |
| `greatDaoOpportunityLost` | `boolean` | Thua kiếp Đại Đạo (Trúc Cơ) | **Không bao giờ** — vĩnh viễn |

- `greatDaoOpportunityLost` là biến cản vĩnh viễn duy nhất của spec; resolver chặn mọi lần xét bậc sau (cap Thiên Đạo).

## 3. Thanh Vân — Gate Phàm Nhân → Luyện Khí (Quán Khí)

### 3.1. Bậc Nhập Đạo 1-6 (giữ hệ, tăng ngưỡng)

- Giữ nguyên: 6 tầng Luyện Thể (Bì/Nhục/Cốt/Huyết/Tạng/Mạch), mở tầng 2/4/6/8/10/12, tuần tự, độc quyền Phàm Nhân.
- Bậc = số tầng đã full lúc bấm Quán Khí (không bắt buộc max — như hiện trạng `breakthroughGrade = clamp(tiers, 1, 6)`).
- **ĐỔI**: ngưỡng Tinh Hoa Phàm Thể theo cấp số nhân dốc (ý gốc: "số lượng tinh hoa yêu cầu còn ít [vì test], cần tăng ngưỡng theo cấp số nhân"):
  - First-pass: hệ số ×3.5/tầng → caps 50 / 175 / 615 / 2.150 / 7.500 / 26.300.
  - Ràng buộc cân bằng: tổng 6 caps ≤ tổng nguồn Tinh Hoa có thể farm trong 18 tầng Phàm Nhân (đối chiếu khi implement, điều chỉnh hệ số nếu vượt).
- Cửa sổ hoàn thiện: tầng 12-18 Phàm Nhân (đúng ý gốc "18 cấp chia 6 bậc, chỉ cần 12 để quán khí").
- Ảnh hưởng hiện có giữ nguyên: passive Nhập Đạo 3%/bậc (maxHp/maxMp/hpRegen/manaRegen — main stat, không phải mana gắn combat Pháp Tu) + Realm Pressure theo breakthroughGrade.
- **Quán Khí "tốt hơn"** = dừng Phàm Nhân lâu hơn, full nhiều tầng Luyện Thể hơn.

### 3.2. Kiếp Quán Khí

- **2 chương**: Tâm Ma Kiếp → Lôi Kiếp (tank hợp nhất — chỉ 1 chương tank, nhẹ).
- 3 câu tâm ma.
- Chi tiết chương: xem §5.

## 4. Thanh Vân — Gate Luyện Khí → Trúc Cơ (Kiến Cơ 4 bậc)

### 4.1. Ba hệ tiền điều kiện mới

#### a) Kỳ Kinh Bát Mạch — hệ song song ở Luyện Khí (mới)

Tương tự Luyện Th thể (độc quyền Phàm Nhân), Bát Mạch độc quyền **Luyện Khí**. `MeridianSystem.ts` mới + `data/realm/Meridians.ts` mới, pattern copy `BodyRefinementSystem` (invest tuần tự, gate tầng, modifiers qua StatModifier pipeline).

| # | Đường mạch | Tầng Luyện Khí mở | Passive first-pass | Cost Thông Mạch Đan |
|---|---|---|---|---|
| 1 | Nhâm Mạch | 2 | +maxHp | 1 |
| 2 | Đới Mạch | 4 | +defense | 2 |
| 3 | Âm Kiều Mạch | 6 | +hpRegenPerSecond | 4 |
| 4 | Âm Duy Mạch | 8 | +maxHp | 7 |
| 5 | Dương Duy Mạch | 10 | +attack | 11 |
| 6 | Dương Kiều Mạch | 12 | +crit (chance) | 16 |
| 7 | Xung Mạch | 14 | +maxHp (lớn hơn) | 22 |
| 8 | Đốc Mạch | 16 | +% main stat (5%) | 30 |
| 9 | **Kỳ Kinh — Thiên Địa Chi Kiều** | 18 | +tốc độ tu luyện (đỉnh) | 40 + Thiên Địa Chi Kiều |

- Mở tuần tự bắt buộc (đường N mới cần đủ N-1), tiêu **Thông Mạch Đan** theo bảng cost tăng dần.
- Kỳ Kinh (đường 9) cần thêm nguyên liệu **Thiên Địa Chi Kiều** (xem quái ẩn).
- **Không chạm mana** (quyết định 11): passive toàn HP/def/attack/crit/main stat/tốc tu.
- Mỗi đường thông +Realm Pressure nhẹ (first-pass: mỗi đường coi như +0.1 grade step cho tính pressure — cụ thể: giảm pressure của người chơi 2%/đường khi ở thế yếu; playtest).
- Không đan nào tiêu ở realm khác — Bát Mạch dừng ở Trúc Cơ (đủ 9 = hoàn thành vĩnh viễn).

#### b) Thông Mạch Đan + Trúc Cơ Đan (alchemy mới)

- **Thông Mạch Đan**: recipe alchemy mới — nguyên liệu chính **Yêu Đan** (drop boss Luyện Khí tầng 10) + thảo mộc realm 2 + Linh Thạch. Chế tại Đan Phòng.
- **Trúc Cơ Đan**: recipe alchemy mới — nguyên liệu realm Luyện Khí (tinh hoa + thảo), dùng làm vật chứng cho bậc Địa/Thiên (CÓ trong túi lúc bấm đột phá, không tiêu).
- Cả hai theo pattern `alchemyRecipes.ts` hiện có; số lượng nguyên liệu playtest.

#### c) Quái ẩn + Thiên Địa Chi Kiều

- Đếm kill quái Luyện Khí (`luyenKhiKillsSinceBeast`). Đủ **1000** → **cửa sổ mở**: quái ẩn có tỉ lệ trà trộn pool spawn mỗi trận (first-pass 5%/trận, playtest) — chỉ ở stage Luyện Khí.
- **Giết quái ẩn** (dù drop hay không) → đếm reset về 0, tích lũy lại 1000 cho cửa sổ sau.
- Quái ẩn rơi **Thiên Địa Chi Kiều** **5%** mỗi lần bị giết (seeded RNG pattern hiện có).
- Không spoil: quái ẩn không hiện trong bất kỳ danh sách stage/map trước khi xuất hiện.
- Data: `data/enemy/Enemies.ts` + 1 template quái ẩn (first-pass: biến thể yêu thú Luyện Khí mạnh hơn thường, tên "Huyết Mông" — playtest).

### 4.2. Bảng 4 bậc Kiến Cơ (Luyện Khí → Trúc Cơ)

| Bậc | Điều kiện (xét lúc bấm đột phá) | Phơi bày | Passive (RealmPassives.ts đã author) |
|---|---|---|---|
| **Nhân Đạo** | Luyện Khí tầng 12 + Linh Thạch (gate công khai) | Công khai | +0% main stat |
| **Địa Đạo** | Có Trúc Cơ Đan trong túi + Luyện Thể full 3 tầng đầu (Bì/Nhục/Cốt) | Manh mối | +5% main stat |
| **Thiên Đạo** | Trúc Cơ Đan + Luyện Thể 6/6 full + ≥6/8 kinh mạch thông | Manh mối | +10% main stat |
| **Đại Đạo Trúc Cơ** | (thỏa Thiên) + thiên phú **Phàm Cốt** + `mortalPerfectionAchieved` (5/5 main stat 10/10 + Luyện Thể 6/6 lúc Quán Khí) + 5/5 main stat **30/30** ở Luyện Khí + **9/9 kinh mạch** (gồm Kỳ Kinh Thiên Địa Chi Kiều) | **Ẩn hoàn toàn** | +20% main stat + Phàm Nhân Chi Cốt |

Ghi chú điều kiện:
- Ý gốc "Ngưỡng cửa không cần kiểm tu vi [cho Địa], vì tu vi đủ 12 mới có thể mở đủ 3 tầng đầu [Luyện Thể]" — Luyện Th thể tầng đầu mở ở Phàm Nhân tầng 2/4/6, full 3 tầng đầu khả thi trong 12 tầng Luyện Khí — giữ đúng, không thêm điều kiện tu vi cho Địa.
- Ý gốc "Thiên: Luyện thể 6 tầng full + Trúc cơ đan. Kinh mạch cần ít nhất 6 đường đã thông" — Thiên cần 6/8 đường (KHÔNG gồm Kỳ Kinh).
- Main stat 30/30: cap Luyện Khí hiện có trong `StatCap.ts` (mortal 10 / qi_refining 30) — "full 5 chỉ số chính 30/30" = đầu tư đủ 29 điểm attributePoints vào 5 stat đạt cap 30. (Phàm Nhân 10/10 tương tự với cap 10.)

### 4.3. Cơ chế Đại Đạo Trúc Cơ

1. Người chơi hội tụ MỌI điều kiện (không biết trước — ẩn hoàn toàn) → bấm nút đột phá Trúc Cơ bình thường.
2. **Thông báo ẩn** xuất hiện trước khi kiếp bắt đầu: *"Phàm Nhân Nghịch Thiên, Đại nghịch bất đạo — Thiên Đạo giáng lôi!"* (world announcement đặc biệt + vào scene kiếp).
3. **Lôi kiếp siêu cấp** — mọi thông số chương khắc nghiệt hơn Thiên Đạo (×1.5-2 tât cả: số lôi, %maxHP, tốc độ tâm ma — số playtest).
4. **Thua**: phạt chuẩn theo realm + **`greatDaoOpportunityLost = true` vĩnh viễn** — mọi lần xét bậc sau cap ở Thiên Đạo. Thông báo: *"Đại đạo đoạn tuyệt..."*.
5. **Thắng**: nhận Đại Đạo Chi Cơ (+20% main stat) + **Phàm Cốt → Phàm Nhân Chi Cốt** (xem §4.4).

### 4.4. Phàm Nhân Chi Cốt (phần thưởng Đại Đào)

- **Cơ chế chốt**: thiên phú `pham_cot` (hiện: -75% tốc độ tu luyện, gate Đại Đạo) tự **chuyển hóa** thành talent mới `pham_nhan_chi_cot` "Phàm Nhân Chi Cốt" — đảo hình phạt thành thưởng: +% tốc độ tu luyện (first-pass +75% — đảo dấu đúng bằng, playtest) + hiệu ứng riêng khác (để trống, quyết định khi playtest có số liệu).
- Số liệu hiệu ứng đầy đủ để trống trong spec này, ghi rõ "playtest quyết định" — người thiết kế chưa chốt.

## 5. Hệ Lôi Kiếp mới — TribulationDirector

### 5.1. Kiến trúc

```
UI (TribulationScene + overlay tâm ma Vue)
  ↓ start / player answer
TribulationDirector (core/tribulation/) — MỚI, thay TribulationSystem
  ├─ ChapterRunner: tuần tự chương (Thân/Lôi), vòng lặp riêng
  ├─ LightningEngine: lôi kích %maxHP, interval, mitigation 100/(100+def)
  ├─ MindTrialEngine: câu hỏi, timer, đúng/sai
  └─ snapshot CombatEntity (tái dùng buildPlayerSnapshot hiện có)
```

- **Không đi qua BattleSystem**: dọn mode `tribulation` khỏi BattleTypes/BattleSystem, gỡ `startTribulation` khỏi BattleSystem, xóa `TribulationSystem.ts` + `TribulationProfile.ts` + quái Kiếp + `TRIBULATION_ENEMY_*`.
- `TribulationPhase` (HP-threshold boss phase) giữ nguyên — chỉ phần kiếp bị dỡ.
- Tái dùng: `CombatSystem.applyDirectDamage` (hoặc copy pattern nếu vòng đời combat đòi hỏi độc lập), EventBus, mitigation formula, `buildPlayerSnapshot`.
- Vào kiếp = **dừng mọi auto** (auto-farm, auto-refight, auto-ult, tu luyện — tất cả; chi tiết §5.6).

### 5.2. Cấu trúc chương kiếp theo gate

| Gate | Số chương | Bố cục |
|---|---|---|
| Quán Khí | 2 | Tâm Ma (3 câu) → Lôi (tank, 1 chương hợp nhất) |
| Trúc Cơ | 3 | Tâm Ma (4 câu) → Thân (tank đều) → Lôi (đợt lớn + đại lôi) |
| Kim Đan | 4 | +1 chương (placeholder cấu trúc) |
| ... | n+1 | framework `chapters: TribulationChapter[]` data-driven, thêm tùy ý |

- Số câu tâm ma theo gate: 3, 4, 5, 6... (mỗi gate +1).
- Thua 1 chương = thua cả kiếp (không retry từng chương).

### 5.3. Chương Tâm Ma Kiếp

- **Bank câu hỏi** `data/tribulation/TribulationMindQuestions.ts` — viết sẵn theo realm ("thiên văn dưới địa lý" + đạo lý + kiến thức thế giới Thanh Vân):
  - Quán Khí: ~15 câu (chọn 3 random/kiếp).
  - Trúc Cơ: ~20 câu (chọn 4 random/kiếp).
  - Realm sau: mở rộng bank khi mở nội dung (placeholder cấu trúc).
  - 4 đáp án trắc nghiệm, 1 đúng (index đúng khai báo trong data, UI shuffle).
- **Timer mỗi câu**: first-pass Quán Khí 12s → 8s (giảm dần theo thứ tự câu), Trúc Cơ 10s → 6s. Không trả lời kịp = sai.
- **Đúng**: buff tự động luân phiên (không chọn — quyết định brainstorming): hồi máu / giảm ST% / tăng kháng lôi. Hiệu lực đến hết kiếp.
- **Sai**: debuff **xếp chồng** (stack): giảm def / tăng ST nhận vào / mất HP, mỗi lần sai +1 tầng stack, hiệu lực đến hết kiếp. Không giới hạn số tầng (trừ khi hết chương).
- Giữa các câu nghỉ 1-2s; buff/debuff từ tâm ma hiệu lực đến hết kiếp — quyết định đúng/sai ở chương đầu tác động trực tiếp độ khó tank các chương sau.

### 5.4. Chương Thân Kiếp / Lôi Kiếp (tank thuần)

- Không có nút bấm — người chơi "chơi" bằng build (HP/def/hpRegen thật) + buff/debuff từ tâm ma.
- **Thân Kiếp** (Trúc Cơ): lôi kích đều đặn chu kỳ 2s, %maxHP per strike (first-pass 8-13% theo bậc), thời lượng ~20s.
- **Lôi Kiếp**: đợt lôi dồn dập (chu kỳ nhanh hơn, %maxHP cao hơn), kết thúc bằng **đại lôi** — đợt sát thương cực đại (first-pass 25-40% maxHP theo bậc), thời lượng ~15-20s.
- **Quán Khí**: 1 chương tank duy nhất, lôi nhẹ (first-pass 6-8% chu kỳ 3s, 15s).
- Công thức sát thương lôi: `maxHp × percent × mitigation(100/(100+def))` — giữ nguyên pattern hiện có.

### 5.5. Độ khó theo bậc (trade-off trung tâm)

| Bậc | Hệ số kiếp (áp cho số lôi + %maxHP + tốc độ tâm ma) |
|---|---|
| Nhân | ×1.0 (chuẩn) |
| Địa | ×1.15 |
| Thiên | ×1.3 |
| Đại Đạo | ×1.75-2.0 (siêu cấp — "lôi kiếp mạnh siêu cấp" đúng ý gốc) |

- Ý nghĩa: chuẩn bị kỹ (bậc cao) → kiếp khó hơn → nhưng passive nhận được mạnh hơn tương ứng.

### 5.6. Tương tác kiếp × idle

- Vào kiếp: **dừng mọi vòng tự động** — auto-farm/auto-refight/auto-ult chấm dứt, tu luyện tạm ngưng tích tu vi trong suốt kiếp (kiếp là khoảnh khắc nghi thức).
- Vào kiếp luôn bằng nút bấm chủ động (giữ pattern `triggerQuanKhiAction`/`triggerFoundationBreakthroughAction` hiện có).
- **Close game giữa chừng kiếp = thua** theo phạt chuẩn (không lách lỗ).
- Thất bại → cooldown 5 phút giữ nguyên + có thể thử lại sau cooldown.

### 5.7. Thắng/thua & phạt chuẩn hóa theo realm

- **Thắng**: vào realm mới, `resolveVictory` giữ pattern hiện có (realm passive theo bậc qua RealmPassiveSystem, world announcement reveal bậc — công bố SAU khi đạt).
- **Thua**:
  - Tu vi: giảm dần theo realm — first-pass 50% (Quán Khí) / 40% (Trúc Cơ) / 30% (realm 3+) / sàn 20% (playtest).
  - Linh Thạch: scale theo realm — theo dãy BREAKTHROUGH_REQUIREMENTS cũ (50 / 200 / 2.000 / 20.000...) làm điểm neo sink (playtest).
  - Kiếp Thương debuff + cooldown 5 phút giữ nguyên.
  - Thua kiếp Đại Đạo: thêm `greatDaoOpportunityLost` vĩnh viễn (§4.3).

### 5.8. UI

- **TribulationScene** (Phaser scene riêng — nghi thức, không phải CombatScene):
  - Thanh tiến độ chương kiếp (chương hiện tại / tổng).
  - HP bar người chơi + VFX sét (Phaser) + đếm số lôi đã đỡ.
  - Overlay tâm ma (Vue): câu hỏi + 4 đáp án + thanh giờ co.
  - Tái dùng pattern `enterTribulationScene`/`exitTribulationScene` + `uiStore` hiện có.
- Thông báo bậc sau đột phá: world announcement (pattern hiện có) — `★ ĐỊA ĐẠO TRÚC CƠ ★` + panel nhân vật ghi bậc + passive nhận được.

## 6. Data & Save

### 6.1. PlayerData mới (save v53 → v54, dev phase không migration)

```ts
openedMeridianIds: string[]         // Bát Mạch đã thông
luyenKhiKillsSinceBeast: number    // đếm kill cửa sổ quái ẩn
mortalPerfectionAchieved: boolean  // snapshot hoàn hảo Phàm Nhân (set lúc Quán Khí)
greatDaoOpportunityLost: boolean   // mất vĩnh viễn cơ hội Đại Đạo
```

### 6.2. Data files mới

| File | Nội dung |
|---|---|
| `data/realm/Meridians.ts` | 9 đường kinh + passive + cost |
| `data/breakthrough/BreakthroughGrades.ts` | bảng bậc 4 bậc Kiến Cơ + điều kiện (data-driven theo gate) |
| `data/tribulation/TribulationChapters.ts` | profile chương theo gate × bậc |
| `data/tribulation/TribulationMindQuestions.ts` | bank câu hỏi theo realm |
| `data/alchemy/alchemyRecipes.ts` (sửa) | + Thông Mạch Đan, Trúc Cơ Đan |
| `data/materials/materials.ts` (sửa) | + yeu_dan, thien_dia_chi_kieu |
| `data/enemy/Enemies.ts` (sửa) | + quái ẩn; boss LK t10 + drop Yêu Đan |
| `data/realm/BodyRefinement.ts` (sửa) | caps cấp số nhân mới |
| `core/breakthrough/BreakthroughGrade.ts` (mới) | interface + resolver tổng quát |
| `core/realm/MeridianSystem.ts` (mới) | invest tuần tự + modifiers |
| `core/tribulation/TribulationDirector.ts` (mới) | chapter runner + lightning + mind trial |
| `components/tribulation/TribulationScene.vue` + overlay (mới) | UI nghi thức |

### 6.3. Dọn hệ cũ

- **Xóa Đột Phá Lệnh**: `BreakthroughRequirement.ts`, token materials + `craftBreakthroughToken`/`canCraftBreakthroughToken` + UI craft tương ứng. Gate = tầng 12 + Linh Thạch (trực tiếp).
- **Xóa trận kiếp cũ**: `TribulationSystem.ts`, `TribulationProfile.ts`, quái Kiếp, `TRIBULATION_ENEMY_BY_*`, `BattleSystem.startTribulation` + mode `tribulation` (dọn khỏi BattleTypes/BattleSystem/checkBattleEnd).
- **Xóa** `FoundationResolver.ts` (thay bằng resolver tổng quát §2.1).
- **Update có chủ đích** (không xóa): `FoundationResolver.test.ts` (chuyển sang test resolver mới), `GameManager.tribulation.test.ts`, `GameManager.progressionScope.test.ts`, `useTribulation.ts` (đổi gọi Director), `RealmPanel/BreakthroughRequirementPanel` UI.
- `TribulationPhase` boss giữ nguyên.

### 6.4. Save version

- `CURRENT_SAVE_VERSION = 54 as const` (bump từ 53); comment block trong SaveSystem.ts mô tả fields mới.

## 7. Địa giới 2/3 — cấu trúc placeholder

Chỉ khai báo để framework không âm thầm sai; chi tiết thiết kế khi mở nội dung (brainstorm riêng theo quyết định 2):

| Gate | Bậc | Số chương kiếp | Ghi chú |
|---|---|---|---|
| Kim Đan | 4 bậc (tên tạm) | 4 chương, 5 câu tâm ma | Điều kiện trục "đan" |
| Nguyên Anh | 4 bậc | 5 chương, 6 câu | trục "hồn" |
| Hóa Thần (đỉnh địa giới 2) | 4 bậc + bậc tối thượng ẩn | 5 chương, 7 câu | pattern Đại Đào |
| Luyện Hư / Hợp Thể | 4 bậc | 6-7 chương | trục "hư" |
| Đại Thừa (đỉnh địa giới 3) | 4 bậc + bậc tối thượng ẩn | 7 chương, 8+ câu | pattern Đại Đào |
| Độ Kiếp (realm 9) | — | — | kết thúc game (đại kết) |

## 8. Testing

### 8.1. Unit (mới/đổi)

1. **Resolver 4 bậc Kiến Cơ**: matrix đủ/thiếu từng điều kiện; riêng Đại Đạo: mọi tổ hợp thiếu 1 điều kiện → Thiên; `greatDaoOpportunityLost` cap Thiên mọi lần sau.
2. **Snapshot hoàn hảo**: `mortalPerfectionAchieved` set đúng lúc Quán Khí khi đủ (10/10 + 6/6), không set khi thiếu; không hồi cứu được sau khi vào Luyện Khí.
3. **MeridianSystem**: tuần tự (đường N cần N-1), gate tầng, tiêu Thông Mạch Đan đúng cost, Kỳ Kinh cần Thiên Địa Chi Kiều, passive áp đúng, mana không bao giờ bị chạm.
4. **Quái ẩn**: đếm 999 → không eligible; 1000 → eligible; giết quái ẩn → reset; drop 5% seeded; kill quái thường sau window vẫn eligible đến khi giết quái ẩn.
5. **Director**: tuần tự chương đúng thứ tự; tâm ma đúng/sai/hết giờ; buff luân phiên, debuff stack; lôi tính đúng công thức mitigation; đại lôi áp đúng; thắng khi sống sót hết chương cuối; thua khi HP ≤ 0 bất kỳ lúc nào; hệ số bậc áp đúng.
6. **Dừng auto khi vào kiếp**: các vòng auto không tick trong kiếp; close giữa chừng = thua.
7. **Save v54 roundtrip** + shape validation fields mới.
8. **Bank câu hỏi**: mỗi câu có đúng 1 đáp án đúng, 4 đáp án, id duy nhất, đủ số câu theo realm.

### 8.2. Verify chuẩn

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

## 9. Số liệu để playtest (không chốt trong spec)

- Caps Tinh Hoa (×3.5 first-pass) — đối chiếu tổng nguồn farm 18 tầng.
- %maxHP lôi theo chương/bậc, đại lôi, interval.
- Timer tâm ma (12→8s / 10→6s), thời gian nghỉ giữa câu.
- Hệ số kiếp theo bậc (1.0/1.15/1.3/1.75-2.0).
- Cost Thông Mạch Đan từng đường (1/2/4/7/11/16/22/30/40), recipe 2 đan.
- Tỉ lệ quái ẩn trong window (5%), drop Thiên Địa Chi Kiều (5%).
- Phạt tu vi theo realm (50/40/30 → sàn 20%), Linh Thạch theo realm.
- Hiệu ứng đầy đủ Phàm Nhân Chi Cốt (+75% tốc tu first-pass đảo dấu, phần còn lại trống).
- Realm Pressure mỗi đường mạch (2%/đường first-pass).

## 10. Out of scope

- Chi tiết điều kiện bậc + chương kiếp địa giới 2/3 (brainstorm riêng khi mở).
- Nội dung realm Kim Đan+ (stage/quái/quest) — thuộc plan nội dung riêng.
- Balance số liệu cuối (§9 — playtest).
- Migration save v53 → v54 (dev phase, AGENTS.md cho phép break).
- Âm thanh kiếp (audio-game-feel plan đang parked).
