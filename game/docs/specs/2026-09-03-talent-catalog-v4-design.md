# Spec — Talent Catalog v4: Thiên Phú là Luật Chơi

> Ngày: 2026-09-03. Thay thế catalog v3 (talent-direction-choice-plan, 2026-08-28).
> Trạng thái brainstorming: hoàn tất với tác giả (phiên 2026-09-03).
> Nguồn真相 truth: các quyết định chốt trong hội thoại, ghi ở mục 2.

---

## 1. Bối cảnh và vấn đề

Catalog v3 (12 talent) hoạt động kỹ thuật đúng (76/76 test pass) nhưng mọi kind
effect đều là **percent đơn tuyến** (+100% tốc tu, +50% linh thạch, +15% đan...).
Tác giả không muốn "hiệu ứng đơn giản thế này". Hạ tầng đã mạnh hơn nhiều kể từ
v3 được viết:

- **Unified Buff System** (merged 2026-09-01): `BuffDefinition` với
  statModifier/dot/cc/onHitProc, `stack`/`refresh`/`replace`, `maxStacks`,
  `convertsToId`, buff vĩnh viễn trong trận (`duration: Infinity`, pattern
  `onhit_*`), buff persistent ngoài trận (`applyPersistentBuff`).
- **Skill Trigger/Action Engine 2A** (merged `a47d129`): 10 trigger × 10 action
  với firing site thật (onCast/onHit/onCrit/onEvade/onKill/onDeath/onTick),
  scratch state chia sẻ giữa action.
- **PassiveSystem**: passive stack modifier theo combat event
  (hit/crit/kill/dodge/damage_taken/block/per_second), reset mỗi trận.

Catalog v4 dùng hạ tầng này: **mỗi talent là một ngoại lệ của luật chơi** (đúng
comment khai báo sẵn tại `data/talent/Talents.ts:3-6`), không phải percent cộng
thẳng.

## 2. Quyết định của tác giả (chốt trong brainstorming, bất biến)

1. **Rework toàn catalog** — thay thế v3, không phải thêm layer. Save cũ mất
   talent id cũ là chấp nhận được (development phase, AGENTS.md).
2. **3 nhóm talent**: chiến đấu / sản xuất / tu luyện — mỗi nhóm 5 talent.
3. **Nhóm chiến đấu**: mỗi loại chỉ số 1 talent (block, eva, crit, ...), chọn
   10 — 5 công + 5 thủ. Giữ lại 1 talent cũ: Bất Tử Thể.
4. **Nhóm sản xuất**: đan / trận / khí / phù. Làm ngay 2 (đan, khí), PLAN 2
   (trận, phù — đang PARKED vì Trận/Phù hiện chỉ là modifier-item tĩnh).
5. **Nhóm tu luyện**: gốc là cảm ngộ + tu vi, KHÔNG làm chuyển đổi tài nguyên,
   chỉ tăng mức nhận được. 3 talent tác giả nêu + 2 đề xuất được duyệt.
6. **Talent phải ngang giá trị nhau** trong lượt roll (mọi talent cạnh tranh
   cùng 1 lượt chọn "roll 9 chọn 1"). Không talent nào được chết đứng.
7. **Mọi lợi thế phải có chi phí đối trọng** — không có lợi thế thuần
   (nguyên tắc ra đời từ phản biện "không bao giờ thất bại khi rèn").
8. **Không talent gắn cứng 1 cảnh giới** (loại Luyện Thể Kỳ Tài), **không talent
   đòi mở chức năng/UI mới phức tạp** (loại Tụ Bảo nung trang bị, Cơ Duyên chọn
   1 trong 2 loot).

## 3. Kiến trúc

### 3.1 Nguyên tắc data

Talent vẫn là `TalentDefinition` (`core/talent/Talent.ts`) — KHÔNG tạo parallel
data model. Thay đổi ở `TalentEffect` union: bỏ dần các kind percent phẳng, thêm
các kind "luật bẻ" mới. Mỗi kind mới có đúng 1 điểm hook tiêu thụ, getter tập
trung tại `core/talent/TalentEffects.ts` (giữ nguyên pattern §6 của plan cũ).

Hai dạng implement:

- **Dạng A — trong trận**: kind cấp BuffDefinition mới (`data/buff/` đăng ký
  BuffRegistry) + PassiveSystem/trigger tích tầng. Buff id theo pattern
  `talent_<tên>`. Nhịp chung: **tích → ngưỡng → bùng nổ → tích lại** hoặc
  **tích → decay/reset theo điều kiện**.
- **Dạng B — ngoài trận**: kind được đọc tại đúng hệ thống sở hữu luật
  (CultivationSystem, NodeSystem, AlchemySystem, TribulationDirector,
  EquipmentSystem, BattleLootSystem, OfflineProgressSystem) qua getter
  `getXyz(selectedTalentIds)` — pattern đã có.

### 3.2 Engine extensions (nhỏ, có giới hạn)

| Ext | Nội dung | Nơi | Độ phức tạp |
|---|---|---|---|
| **E1** | BuffPool convert-on-max: buff stack chạm maxStacks → áp `convertsToId` + reset stack về 0 (hiện chỉ convert theo thời gian liên tục) | `core/buff/BuffPool.ts` | ~20 dòng |
| **E2** | PassiveSystem: `passiveCondition` (hpBelow) + `passiveConvertsTo` (áp buff khi chạm ngưỡng tầng) | `core/skill/PassiveSystem.ts` | ~40 dòng |
| **E3** | TalentEffects: các getter mới cho kind tu luyện/sản xuất (per-realm-level speed curve, insight free-roll, tribulation reward, alchemy streak, enhance streak) | `core/talent/TalentEffects.ts` | thuần data-getter |

Không runner mới, không đụng damage pipeline, không file god-class. Mọi hook
mới là guard nhỏ tại consumer hiện có — đúng pattern dự án.

## 4. Catalog v4

Rarity/weight giữ thang cũ (di w1 / thiên w4 / dia w12 / linh w28 / pham w55).
Pool roll cuối cùng = **18 talent active** (11 chiến đấu + 2 sản xuất + 5 tu
luyện) + Phàm Cốt (easter egg, w1, không đổi verbatim — gate Đại Đạo đọc
`pham_cot`, xem `FoundationResolver.ts`). Trước M3 (2 sản xuất chưa làm) roll
tạm 16 + Phàm Cốt; 2 talent PARKED dưới đây KHÔNG thuộc roll (pattern
`PARKED_TALENTS` hiện có).

### 4.1 Chiến đấu — 11 talent (5 công + 5 thủ + Bất Tử Thể giữ lại)

Nhịp trong trận dùng BuffDefinition stack + PassiveSystem + E1/E2. Mọi talent
chỉ hiệu lực trong trận (reset mỗi trận theo `PassiveSystem.resetStacks()`).

**Công:**

| # | Id (N2b) | Tên | Chỉ số | Nhịp |
|---|---|---|---|---|
| 1 | `kiem_quang` | Kiếm Quang | chí mạng | onCrit +1 tầng Kiếm Mạch (max 10, +1% crit/tầng); chạm 10 → **Kiếm Vực** 8s: đòn đánh guaranteed crit. E1 convert |
| 2 | `pha_giap` | Phá Giáp | xuyên giáp (metalPenetration) | onHit +1 tầng Mổ Tạc (max 5, +2%/tầng); kill giữ 50% tầng sang trận sau |
| 3 | `tai_phong` | Tật Phong | tốc đánh | onKill +2% attackSpeed stack vô hạn trong trận; bị trúng đòn reset về 0 |
| 4 | `trong_kich` | Trọng Kích | sát thương chí mạng | 3 crit liên tiếp (không bị chặn giữa) → phát kế +30% finalDamagePercent; +2% criticalDamage vĩnh viễn trong trận, mỗi lần bùng +1 mốc |
| 5 | `hap_linh` | Hấp Linh | hút máu | leechPercent ×2.5 nhưng chỉ hiệu lực khi HP < 50% — dao đôi sinh tử |

**Thủ:**

| # | Id (N2b) | Tên | Chỉ số | Nhịp |
|---|---|---|---|---|
| 6 | `thach_giap` | Thạch Giáp | phòng thủ | block thành công +2% defense (max 10 tầng); chạm 10 → **Thạch Nham** 5s: −50% sát thương nhận. E1 convert |
| 7 | `vo_anh` | Vô Ảnh | né | dodge +1 tầng (max 5, +2%/tầng); chạm 5 → **Sát Na** 6s: +30% crit + 20% attackSpeed. E1 convert |
| 8 | `can_than` | Cẩn Thận | endurance | HP dưới ngưỡng endurance: nhận −10%; trên ngưỡng: +5% — lưỡi kiếm sinh tử |
| 9 | `ho_the` | Hộ Thể | ward (Hộ Thuẫn) | ward vỡ → nổ AoE = 30% ward đã mất + hồi ward bằng 25% trong 2s |
| 10 | `thu_phat` | Thứ Phạt | gai | thorns +30% khi bị đánh; mỗi lần phản +1 tầng Hận Thứ (max 5, +5%/tầng), decay 1 tầng/3s không bị đánh |

**Giữ lại (cả id lẫn hành vi cốt lõi, nâng cấp theo tinh thần v4):**

| # | Id | Tên | Nhịp v4 |
|---|---|---|---|
| 11 | `bat_tu_the` | Bất Tử Thể | Sống sót đòn chí mạng giữ 1 HP (như cũ, `SurviveLethalGuard`), thêm: giải toàn bộ debuff + **Tử Sinh Ngộ** 10s (+30% finalDamagePercent, +20% crit avoidance). KHÔNG kích hoạt trong Độ Kiếp (giữ nguyên) |

### 4.2 Sản xuất — 2 làm ngay + 2 PLAN (PARKED)

**Làm ngay:**

| # | Id (N2b) | Tên | Luật bẻ | Chi phí đối trọng |
|---|---|---|---|---|
| 12 | `hoa_hau_thong_than` | Hỏa Hầu Thông Thần (đan) | Mỗi mẻ đan thành công ra **đan đôi** (×2 số lượng); đan do chính mình luyện, khi dùng **hiệu quả +50%** | Mỗi mẻ tốn **×2 gỗ nhiên liệu + ×2 Linh Thạch** — nuôi lò bằng nông nghiệp gấp đôi |
| 13 | `bach_luyen_thanh_khi` | Bách Luyện Thành Khí (khí) | Rèn cường hóa **không bao giờ thất bại** | Mỗi lần rèn tốn **×3 nguyên liệu + ×3 Linh Thạch** so với người thường — chắc chắn thì trả giá đắt |

**PLAN (PARKED — ghi rõ lý do trong data, pattern `PARKED_TALENTS` hiện có):**

| # | Id | Tên | Lý do park |
|---|---|---|---|
| 14 | `tran_tam` | Trận Tâm (trận) | Trận hiện là modifier-item tĩnh (`data/formation/formations.ts:6` ghi "MVP bỏ trigger/stack"). Cần mở Trận nhận on-hit trigger — thay đổi schema Trận, làm riêng sau |
| 15 | `phu_van` | Phù Văn (phù) | Cần cơ chế "uses/proc" cho Phù (hiện chỉ 2 modifier tĩnh, `core/talisman/Talisman.ts`) — làm cùng đợt Trận Tâm |

### 4.3 Tu luyện — 5 talent

| # | Id (N2b) | Tên | Luật bẻ | Chi phí đối trọng |
|---|---|---|---|---|
| 16 | `ho_tich_bat_phat` | Hậu Tích Bạt Phát | Trong 1 cảnh giới: tốc tu tầng 1 = **−50%**, mỗi tiểu tầng +10% (tầng 12 = +60%, tổng trội hơn baseline khi farm sâu 1 realm) | Tầng đầu chậm — nợ thời gian đầu mỗi realm |
| 17 | `loi_kiep` | Lôi Kiếp | Lôi kiếp cường độ **×2**; thắng kiếp: **+10% toàn chỉ số vĩnh viễn** (stack không giới hạn — thực tế tối đa 9 vì 9 đại cảnh giới) | Rủi ro chết thật + cooldown 5 phút + kiếp sau khó dần |
| 18 | `van_dao` | Vấn Đạo | Học node/skill: **50% không tốn Cảm Ngộ**; Cảm Ngộ nhận từ quái **×2** | Insight gốc toàn game giảm ~40% (`SKILL_INSIGHT_PER_TECHNIQUE_INSIGHT` + data quái) — talent bù lại, phải farm mới thấy |
| 19 | `hai_na` | Hải Nạp | Tu vi tràn trên `required` không mất — dồn vào `cultivationOvercharge`, tự đổ vào tầng kế sau đột phá | Dải thấp ngân sách: chỉ cứu phần tràn, không tăng tốc |
| 20 | `ngo_dao` | Ngộ Đạo (giữ id) | Cảm Ngộ từ tu vi (đường `insight_per_cultivation` hiện có) hoạt động **cả offline** | Dải thấp: offline cap 10h (`PRODUCTION_OFFLINE_CAP_SECONDS` pattern) giới hạn sẵn |

### 4.4 Retire (ra khỏi pool roll, save cũ bỏ qua an toàn)

`tien_thien_dao_the`, `nghich_thien`, `dai_tri_nhuoc_ngu`, `phan_phac`,
`huyet_chien`, `luyen_the_ky_tai`, `tu_bao`, `co_duyen`, `dan_duyen` (id cũ —
thay bằng `hoa_hau_thong_than`), `bat_khuat` (PARKED cũ), `duoc_duyen`,
`dao_phap_tu_nhien`, `vo_cau_dao_the` (PARKED cũ). `getTalentDefinition` trả
undefined → `collectTalentEffects` bỏ qua an toàn (không migration, dev phase).

`GREAT_DAO_REWARD_TALENTS` (`pham_nhan_chi_cot`) giữ nguyên — thuộc hệ Đột Phá
Đại Đạo, không thuộc catalog này.

## 5. Power budget (nguyên tắc cân bằng, mục 2.6-2.7)

Mốc đo: **cuối Trúc Cơ** (~40 giờ — hết nội dung cứng hiện tại). Mọi talent
chạm dải **~+20-30% công suất tổng** qua hình dạng khác nhau:

- **Rủi ro tử** (Lôi Kiếp, Hấp Linh, Cẩn Thận): giá trị cao nhất trong dải.
- **Đầu tư** (Hỏa Hầu Thông Thần, Bách Luyện Thành Khí): cao nếu người chơi
  xây vòng sản xuất; 0 nếu không — quyền lựa chọn build.
- **Trả giá thời gian** (Hậu Tích Bạt Phát): trung bình cả realm ≈ +30%.
- **Nhàn** (Hải Nạp, Ngộ Đạo): dải thấp có chủ đích — talent cho người chơi
  nhàn, giá trị vĩnh viễn nhỏ.
- **Combat 10**: cùng ngân sách trong trận (5-10 tầng + 1 lần bùng), khác nhau
  ở chỉ số được nuôi.

Số liệu cụ thể (10% × 9 stack, −50% khởi điểm, ×3 chi phí rèn...) là
**first-pass** — ghi chú "chờ playtest" theo pattern `dot-pha-loi-kiep`. Kiến
trúc đảm bảo không talent chết đứng trong lượt roll; con số cuối do playtest.

Ngoại lệ có chủ đích: Phàm Cốt — yếu giả, gate Đại Đạo, thắng kiếp đổi
`pham_nhan_chi_cot` +75% tốc tu (canh bạc dài hạn, chất Dị).

## 6. Tích hợp hệ thống (đã rà từng hook, file:line)

| Talent | Hệ thống đụng | Hook |
|---|---|---|
| 1-11 combat | BuffPool/PassiveSystem | E1 trong `core/buff/BuffPool.ts` (convert hiện chỉ thời gian: `BuffSystem.handleExisting`); E2 trong `core/skill/PassiveSystem.ts` (thêm condition + convert; trigger 'dodge'/'block'/'kill'/'hit'/'critical' đã có firing site qua `EVENT_TO_TRIGGER`); Bất Tử Thể: `SurviveLethalGuard` + thêm cleanse + Tử Sinh Ngộ buff cùng điểm kích hoạt `CombatSystem.killIfDead()` |
| 12 đan | AlchemySystem | `tick()` settle — thêm streak? KHÔNG: đan đôi + hiệu quả +50% là multiplier tại `jobSuccessPercent`/settle + `PillEffect` consumption; chi phí ×2 tại `startJob` reserve |
| 13 khí | EquipmentSystem | `enhanceSuccessRate` bypass + cost ×3 tại `getScaledCost` path |
| 16 Hậu Tích | CultivationSystem/stores/player.ts | `cultivate()` — curve per-realm-level: multiplier = 1 + (−0.5 + 0.1 × (realmLevel−1)) clamp ≥ 0.01 (dùng guard 0.01 hiện có) |
| 17 Lôi Kiếp | TribulationDirector | `applyLightningDamage()` multiplier ×2 (đọc getter); thưởng stack: victory → persistent modifier +10% toàn chỉ số (lưu `tribulationBonusStacks`) |
| 18 Vấn Đạo | NodeSystem + BattleLootSystem + SkillInsightBalance | `purchaseNode`/`upgradeNode`: roll 50% miễn cost (random tại thời điểm mua, kết quả lưu vào `nodeFreePurchaseRecord` để refund sau này tính đúng số tiền THẬT đã trả); `BattleLootSystem.ts:241` nhân ×2; giảm insight baseline toàn game |
| 19 Hải Nạp | CultivationSystem | `addCultivation` chặn tràn → nếu có talent, phần vượt dồn `cultivationOvercharge`; `breakthrough()` rót overcharge vào tầng mới |
| 20 Ngộ Đạo | OfflineProgressSystem | settle offline cũng chạy nhánh `insight_per_cultivation` (hiện chỉ online, comment `stores/player.ts:189`) |

## 7. Save (bump CURRENT_SAVE_VERSION — convention no-migration)

Trường mới trên PlayerData:

- `cultivationOvercharge: number` (Hải Nạp, mặc định 0)
- `tribulationBonusStacks: number` (Lôi Kiếp, mặc định 0)
- `nodeFreePurchaseRecord: Record<nodeId, number>` (Vấn Đao — số lần đã được
  miễn phí theo node, lưu KỂ CẢ với talent không còn (retire/save edit) để
  `devResetBranch` refund dựa vào số Cảm Ngộ THẬT đã trả, không exploitable
  hoàn đầy tiền mua free)

Không lưu state trong trận (reset mỗi trận như PassiveSystem). Save shape
validation cập nhật theo `save-shape-validation` hiện có.

## 8. Test (TDD — reproduction trước, production sau)

- **BuffPool E1**: test convert-on-max + reset stack; convert cũ theo thời gian
  không hồi quy.
- **PassiveSystem E2**: condition hpBelow + convert tại ngưỡng.
- **Mỗi talent ≥2 test**: có talent → luật bẻ hoạt động; không talent → hành vi
  mặc định nguyên vẹn (bảng vé trong `Talents.test.ts` mở rộng).
- **Ngân sách/invariant**: catalog test — mọi talent id pool có effect, mọi
  buffId tham chiếu tồn tại trong BuffRegistry, mọi talent có chi phí đối trọng
  được khai báo trong description.
- **Save round-trip**: 3 trường mới; save cũ không crash.
- **Balance sim** (first-pass guardrail): simulation cuối Trúc Cơ 40h cho 3 đại
  diện (Lôi Kiếp / Hỏa Hầu / Hậu Tích) — chạm cùng băng công suất.

## 9. Docs đồng bộ

- `game-guide.md` mục thiên phú viết lại theo catalog v4.
- `roadmap.md`: thêm mục catalog v4 (thay dòng "thiên phú đã giải quyết" của v3).
- `Talents.ts` header comment cập nhật (catalog v4, tham chiếu spec này).

## 10. Milestone (mỗi merge phải chơi được)

- **M1 — Combat**: E1 + E2 + 11 talent combat + retire pool cũ + test. Chơi được
  ngay: roll thấy pool mới, combat có nhịp mới.
- **M2 — Tu luyện**: 5 talent tu luyện + insight baseline reduction + save bump
  + test + balance sim.
- **M3 — Sản xuất**: 2 talent sản xuất + test. Trận Tâm/Phù Văn mở khi làm
  rework Trận/Phù (ngoài scope spec này, ghi trong future-talisman-formation-
  system-plan.md).

## 11. Rủi ro & giới hạn đã biết

- **Phản Phác reaction-keep**: retire nên không cần hook "giữ thành công" — bớt
  1 rủi ro wiring.
- **Insight giảm 40% toàn game** (Vấn Đạo) đổi nhịp progression của NGƯỜI KHÔNG
  chọn talent — chấp nhận có chủ đích (đã duyệt), nhưng phải theo dõi qua
  balance sim M2.
- **E1 convert-on-max** đụng `handleExisting` — phải giữ nguyên hành vi
  `convertsAfterContinuousSeconds` (Làm Chậm/Hàn Khí) — test hồi quy bắt buộc.
- **Số liệu first-pass** — mọi hằng số chờ playtest; spec chỉ khóa HÌNH DẠNG.
- **Trận Tâm/Phù Văn PARKED** — nhóm sản xuất chỉ có 2 talent active cho đến
  khi rework Trận/Phù; pool roll M3 tạm 16 + Phàm Cốt, đầy đủ 18 sau.
