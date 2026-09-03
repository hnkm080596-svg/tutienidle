import type { TalentDefinition } from '@/core/talent/Talent'

// Catalog v4 (spec 2026-09-03-talent-catalog-v4-design.md, duyệt
// 2026-09-03) — mỗi thiên phú là một hướng đạo, một "ngoại lệ của luật
// chơi" dựng trên buff/trigger engine có sẵn. KHÔNG có talent cộng chỉ
// số thuần. Roll 9 từ pool này, người chơi chọn đúng 1 — cả đời.
//
// M1 (plan 2026-09-03-talent-catalog-v4-m1-combat): 11 talent chiến đấu
// (5 công + 5 thủ + Bất Tử Th thể) + Phàm Cốt easter egg. M2 thêm 5 tu
// luyện, M3 thêm 2 sản xuất (+ 2 PARKED Trận Tâm/Phù Văn).
//
// Mô tả theo template 3 phần (spec §9): câu hình ảnh / cơ chế bằng số /
// chi phí đối trọng. Số liệu first-pass — chờ playtest (spec §5).
export const CHARACTER_CREATION_TALENTS: TalentDefinition[] = [
  // ==================== CHIẾN ĐẤU — CÔNG (5) ====================
  {
    id: 'kiem_quang',
    name: 'Kiếm Quang',
    description: 'Kiếm tâm sáng như sao chiều. Mỗi đòn chí mạng tích 1 tầng Kiếm Mạch (+1% chí mạng, tối đa 10 tầng); đủ 10 tầng hóa Kiếm Vực 8 giây — mọi đòn đều chí mạng. Ngược lại: ngoài Kiếm Vực không được cộng chí mạng nào khác từ thiên phú.',
    rarity: 'thien',
    weight: 4,
    tags: ['combat', 'skill'],
    effects: [{ kind: 'combat_passive', passiveSkillId: 'talent_passive_kiem_quang' }],
  },
  {
    id: 'pha_giap',
    name: 'Phá Giáp',
    description: 'Giáp địch chỉ là lớp vỏ chờ kiếm gọt. Mỗi đòn trúng tích 1 tầng Mổ Tạc (+2% xuyên giáp, tối đa 5 tầng trong trận). Ngược lại: chỉ số xuyên không được cộng từ nguồn thiên phú nào khác.',
    rarity: 'dia',
    weight: 12,
    tags: ['combat'],
    effects: [{ kind: 'combat_passive', passiveSkillId: 'talent_passive_pha_giap' }],
  },
  {
    id: 'tat_phong',
    name: 'Tật Phong',
    description: 'Gió theo sát từng đường kiếm. Mỗi lần diệt địch +2% tốc đánh, cộng dồn không giới hạn trong trận. Ngược lại: bị trúng MỘT đòn là mất sạch toàn bộ tầng đã tích.',
    rarity: 'linh',
    weight: 28,
    tags: ['combat', 'risk_reward'],
    effects: [{ kind: 'combat_passive', passiveSkillId: 'talent_passive_tat_phong' }],
  },
  {
    id: 'trong_kich',
    name: 'Trọng Kích',
    description: 'Kiếm nặng mạch chậm, trúng là trúng thật. Mỗi chí mạng +2% sát thương chí mạng (tối đa 3 tầng); đủ 3 tầng bùng +30% sát thương cuối trong 8 giây rồi tích lại. Ngược lại: chỉ số này không cộng thêm từ nguồn thiên phú nào khác.',
    rarity: 'linh',
    weight: 28,
    tags: ['combat'],
    effects: [{ kind: 'combat_passive', passiveSkillId: 'talent_passive_trong_kich' }],
  },
  {
    id: 'hap_linh',
    name: 'Hấp Linh',
    description: 'Máu địch là thuốc của ngươi. Hút máu hiệu lực gấp 2.5 lần người thường — nhưng chỉ khi sinh lực dưới 50%. Trên ngưỡng đó, huyết mạch im lặng hoàn toàn.',
    rarity: 'pham',
    weight: 55,
    tags: ['combat', 'risk_reward'],
    effects: [{ kind: 'combat_passive', passiveSkillId: 'talent_passive_hap_linh' }],
  },
  // ==================== CHIẾN ĐẤU — THỦ (5) ====================
  {
    id: 'thach_giap',
    name: 'Thạch Giáp',
    description: 'Thân thể như núi đá. Mỗi lần chặn đòn thành công +2% phòng thủ (tối đa 10 tầng); đủ 10 tầng hóa Thạch Nham 5 giây — giảm 50% sát thương nhận vào. Ngược lại: ngoài Thạch Nham, phòng thủ không cộng từ nguồn thiên phú nào khác.',
    rarity: 'pham',
    weight: 55,
    tags: ['defense'],
    effects: [{ kind: 'combat_passive', passiveSkillId: 'talent_passive_thach_giap' }],
  },
  {
    id: 'vo_anh',
    name: 'Vô Ảnh',
    description: 'Thân pháp vô ảnh. Mỗi lần né đòn +2% né (tối đa 5 tầng); đủ 5 tầng hóa Sát Na 6 giây — +30% chí mạng, +20% tốc đánh. Ngược lại: chỉ số né không cộng từ nguồn thiên phú nào khác.',
    rarity: 'linh',
    weight: 28,
    tags: ['defense', 'mechanic'],
    effects: [{ kind: 'combat_passive', passiveSkillId: 'talent_passive_vo_anh' }],
  },
  {
    id: 'can_than',
    name: 'Cẩn Thận',
    description: 'Sát tử đường mới lạnh lòng. Khi sinh lực dưới 35%: mọi sát thương nhận vào giảm 10%. Khi an toàn trên ngưỡng: ngược lại dễ chủ quan, nhận thêm 5% sát thương — lưỡi kiếm hai cạnh.',
    rarity: 'linh',
    weight: 28,
    tags: ['defense', 'risk_reward'],
    effects: [
      { kind: 'combat_passive', passiveSkillId: 'talent_passive_can_than' },
      { kind: 'combat_passive', passiveSkillId: 'talent_passive_can_than_phi' },
    ],
  },
  {
    id: 'ho_the',
    name: 'Hộ Thể',
    description: 'Khiên này vỡ, khiên khác sinh. Khi Hộ Thuẫn vỡ hẳn: nổ sát thương quanh mình bằng 30% dung lượng khiên đã mất và Hộ Thuẫn hồi nhanh gấp nhiều lần trong 5 giây. Ngược lại: ngoài cữ bùng phát, tốc hồi khiên không đổi.',
    rarity: 'dia',
    weight: 12,
    tags: ['defense', 'mechanic'],
    effects: [{ kind: 'combat_passive', passiveSkillId: 'talent_passive_ho_the' }],
  },
  {
    id: 'thu_phat',
    name: 'Thứ Phạt',
    description: 'Đòn nào ăn vào, gai đó sắc thêm. Bị đánh +30% gai phản; mỗi lần phản tích 1 tầng Hận Thứ (tối đa 5, mỗi tầng +5% phản). Không bị đánh 3 giây liên tiếp — gai lụi dần từng tầng.',
    rarity: 'pham',
    weight: 55,
    tags: ['defense'],
    effects: [{ kind: 'combat_passive', passiveSkillId: 'talent_passive_thu_phat' }],
  },
  // ==================== CHIẾN ĐẤU — GIỮ TỪ v3 ====================
  {
    id: 'bat_tu_the',
    name: 'Bất Tử Thể',
    description: 'Trời sinh mệnh cứng, một chân đã bước qua cửa tử. Mỗi trận, lần đầu nhận đòn chí mạng sẽ không chết, giữ lại 1 điểm sinh lực, tẩy mọi debuff và hóa Tử Sinh Ngộ 10 giây (+30% sát thương cuối, +20% né chí mạng). Độ Kiếp là nghi lễ thật — thiên phú này không áp dụng.',
    rarity: 'dia',
    weight: 12,
    tags: ['defense', 'mechanic'],
    effects: [
      { kind: 'survive_lethal', usesPerBattle: 1 },
      { kind: 'combat_passive', passiveSkillId: 'talent_passive_bat_tu_the' },
    ],
  },
  // ==================== EASTER EGG (giữ verbatim v3) ====================
  {
    // EASTER EGG — description verbatim theo thiết kế của tác giả,
    // KHÔNG được sửa (cùng convention mô tả item ẩn great_dao_seed trong
    // data/materials/materials.ts). Effect duy nhất: −75% tốc độ tu luyện
    // (10/s → 2.5/s). Là một gate của Đại Đạo Trúc Cơ — điều kiện gate do
    // tác giả thiết kế sau, đọc qua PlayerData.selectedTalentIds chứa
    // 'pham_cot' (xem core/breakthrough/FoundationResolver.ts).
    id: 'pham_cot',
    name: 'Phàm Cốt',
    description: 'Ngươi sinh ra chính là người bình thường, lớn lên là kẻ bình thường, sau này khả năng vẫn sẽ luôn như vậy ...',
    rarity: 'di',
    weight: 1,
    tags: ['mechanic', 'risk_reward'],
    effects: [{ kind: 'cultivation_speed', percent: -0.75 }],
  },
]

// PARKED (spec §4.2 — M3 sản xuất) — Trận Tâm/Phù Văn cần mở Trận/Phù
// nhận trigger/uses (hiện là modifier-item tĩnh, xem data/formation/
// formations.ts + core/talisman/Talisman.ts). weight 0 — không roll.
export const PARKED_TALENTS: TalentDefinition[] = [
  {
    id: 'tran_tam',
    name: 'Trận Tâm',
    description: 'Trận pháp khắc lên trang bị cũng biết đánh trả — Trận socket cấp hiệu ứng on-hit khi chiến đấu. (Chưa mở: đợi Trận nhận trigger.)',
    rarity: 'linh',
    weight: 0,
    tags: ['crafting', 'mechanic'],
    effects: [],
  },
  {
    id: 'phu_van',
    name: 'Phù Văn',
    description: 'Phù hiệu lực 20% không tiêu hao khi kích hoạt. (Chưa mở: đợi Phù có cơ chế uses/proc.)',
    rarity: 'linh',
    weight: 0,
    tags: ['crafting', 'mechanic'],
    effects: [],
  },
]

// RETIRED v4 (spec §4.4) — 13 talent v3 rời pool roll. getTalentDefinition
// vẫn resolve được để save cũ hiển thị đúng tên (TALENTS_BY_ID gồm cả
// mảng này), nhưng collectTalentEffects chỉ đọc id ĐẦU nên save edit chứa
// id retired + id mới cũng không cộng dồn effect. Không migration
// (development phase).
export const RETIRED_V4_TALENTS: TalentDefinition[] = [
  {
    id: 'tien_thien_dao_the',
    name: 'Tiên Thiên Đạo Thể',
    description: '(Đã nghỉ — catalog v3) Sinh ra đã gần Đạo, linh khí thiên hạ tự tìm về.',
    rarity: 'di',
    weight: 0,
    tags: ['cultivation'],
    effects: [],
  },
  {
    id: 'nghich_thien',
    name: 'Nghịch Thiên',
    description: '(Đã nghỉ — catalog v3) Đốt mệnh mà đi, nhanh hơn người một bước.',
    rarity: 'thien',
    weight: 0,
    tags: ['risk_reward', 'cultivation'],
    effects: [],
  },
  {
    id: 'dai_tri_nhuoc_ngu',
    name: 'Đại Trí Nhược Ngu',
    description: '(Đã nghỉ — catalog v3) Người khác tu một, ngươi ngộ mười.',
    rarity: 'dia',
    weight: 0,
    tags: ['risk_reward', 'resource'],
    effects: [],
  },
  {
    id: 'phan_phac',
    name: 'Phản Phác',
    description: '(Đã nghỉ — catalog v3) Vạn pháp quy tông, sinh khắc tuần hoàn không dứt.',
    rarity: 'linh',
    weight: 0,
    tags: ['element', 'mechanic'],
    effects: [],
  },
  {
    id: 'huyet_chien',
    name: 'Huyết Chiến',
    description: '(Đã nghỉ — catalog v3) Càng đánh càng hăng, máu địch là thuốc của ngươi.',
    rarity: 'linh',
    weight: 0,
    tags: ['combat', 'defense'],
    effects: [],
  },
  {
    id: 'luyen_the_ky_tai',
    name: 'Luyện Thể Kỳ Tài',
    description: '(Đã nghỉ — catalog v3) Thể phách trời ban, rèn một được hai.',
    rarity: 'linh',
    weight: 0,
    tags: ['cultivation', 'defense'],
    effects: [],
  },
  {
    id: 'tu_bao',
    name: 'Tụ Bảo',
    description: '(Đã nghỉ — catalog v3) Tay chạm vào đâu, Linh Thạch tụ về đó.',
    rarity: 'pham',
    weight: 0,
    tags: ['resource'],
    effects: [],
  },
  {
    id: 'co_duyen',
    name: 'Cơ Duyên',
    description: '(Đã nghỉ — catalog v3) Hữu duyên thiên lý năng tương ngộ.',
    rarity: 'pham',
    weight: 0,
    tags: ['resource'],
    effects: [],
  },
  {
    id: 'dan_duyen',
    name: 'Đan Duyên',
    description: '(Đã nghỉ — catalog v3) Lò lửa nghe tay, đan dược nể mặt.',
    rarity: 'pham',
    weight: 0,
    tags: ['crafting'],
    effects: [],
  },
  {
    id: 'bat_khuat',
    name: 'Bất Khuất',
    description: '(Đã nghỉ — catalog v3 PARKED) Khi thấp hơn 35% sinh lực, giảm 12% sát thương nhận vào.',
    rarity: 'dia',
    weight: 0,
    tags: ['defense'],
    effects: [],
  },
  {
    id: 'duoc_duyen',
    name: 'Dược Duyên',
    description: '(Đã nghỉ — catalog v3 PARKED) Hiệu quả đan dược tăng 12%.',
    rarity: 'linh',
    weight: 0,
    tags: ['crafting'],
    effects: [],
  },
  {
    id: 'dao_phap_tu_nhien',
    name: 'Đạo Pháp Tự Nhiên',
    description: '(Đã nghỉ — catalog v3 PARKED) Mỗi lần đột phá nhận thêm một điểm thuộc tính.',
    rarity: 'thien',
    weight: 0,
    tags: ['cultivation', 'mechanic'],
    effects: [],
  },
  {
    id: 'vo_cau_dao_the',
    name: 'Vô Cấu Đạo Thể',
    description: '(Đã nghỉ — catalog v3 PARKED) Không nhận điểm thuộc tính tự do; mọi chỉ số chính tăng theo cảnh giới.',
    rarity: 'di',
    weight: 0,
    tags: ['mechanic', 'risk_reward'],
    effects: [],
  },
]

// Phần thưởng Đại Đạo Trúc Cơ (spec dot-pha-loi-kiep §4.4) — KHÔNG thuộc
// pool roll (chỉ đạt được qua chuyển hóa từ pham_cot khi thắng kiếp
// Đại Đạo). Effect: đảo dấu hình phạt -75% thành +75% tốc tu luyện;
// hiệu ứng thêm playtest quyết định (spec §9).
export const GREAT_DAO_REWARD_TALENTS: TalentDefinition[] = [
  {
    id: 'pham_nhan_chi_cot',
    name: 'Phàm Nhân Chi Cốt',
    description: 'Đại nạn bất tử, phàm thai hữu đạo. Tốc độ tu luyện tăng 75%.',
    rarity: 'di',
    weight: 0,
    tags: ['cultivation', 'mechanic', 'risk_reward'],
    effects: [{ kind: 'cultivation_speed', percent: 0.75 }],
  },
]

// BY_ID phủ cả catalog lẫn PARKED lẫn RETIRED lẫn GREAT_DAO_REWARD để
// save cũ chọn trúng thiên phú retired vẫn resolve được definition khi
// hiển thị.
const TALENTS_BY_ID = new Map(
  [
    ...CHARACTER_CREATION_TALENTS,
    ...PARKED_TALENTS,
    ...RETIRED_V4_TALENTS,
    ...GREAT_DAO_REWARD_TALENTS,
  ].map(talent => [talent.id, talent]),
)

export function getTalentDefinition(talentId: string): TalentDefinition | undefined {
  return TALENTS_BY_ID.get(talentId)
}

export function rollCharacterCreationTalents(count = 9): TalentDefinition[] {
  const pool = [...CHARACTER_CREATION_TALENTS]
  const result: TalentDefinition[] = []

  while (result.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, talent) => sum + talent.weight, 0)
    let roll = Math.random() * totalWeight
    let index = 0

    for (; index < pool.length - 1; index++) {
      roll -= pool[index]!.weight
      if (roll <= 0) break
    }

    result.push(pool.splice(index, 1)[0]!)
  }

  return result
}
