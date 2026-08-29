import type { TalentDefinition } from '@/core/talent/Talent'

// Catalog v3 (talent-direction-choice-plan.md, duyệt 2026-08-28) — mỗi
// thiên phú là một hướng đạo, một "ngoại lệ của luật chơi". KHÔNG có
// talent cộng chỉ số thuần (nguyên tắc đã chốt với tác giả: "chỉ số đâu
// có gì đặc sắc"). Roll 9 từ pool này, người chơi chọn đúng 1.
export const CHARACTER_CREATION_TALENTS: TalentDefinition[] = [
  {
    id: 'tien_thien_dao_the',
    name: 'Tiên Thiên Đạo Thể',
    description: 'Sinh ra đã gần Đạo, linh khí thiên hạ tự tìm về. Tốc độ tu luyện tăng 100%.',
    rarity: 'di',
    weight: 1,
    tags: ['cultivation', 'mechanic'],
    effects: [{ kind: 'cultivation_speed', percent: 1 }],
  },
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
  {
    id: 'nghich_thien',
    name: 'Nghịch Thiên',
    description: 'Đốt mệnh mà đi, nhanh hơn người một bước, nhưng đạo quả chóng thành thì ngộ tính cũng chóng cạn. Tốc độ tu luyện tăng 50%, Cảm Ngộ nhận được giảm 30%.',
    rarity: 'thien',
    weight: 4,
    tags: ['risk_reward', 'cultivation'],
    effects: [
      { kind: 'cultivation_speed', percent: 0.5 },
      { kind: 'insight_gain', percent: -0.3 },
    ],
  },
  {
    id: 'bat_tu_the',
    name: 'Bất Tử Thể',
    description: 'Trời sinh mệnh cứng, một chân đã bước qua cửa tử. Mỗi trận chiến, lần đầu nhận đòn chí mạng sẽ không chết, giữ lại 1 điểm sinh lực.',
    rarity: 'dia',
    weight: 12,
    tags: ['defense', 'mechanic'],
    effects: [{ kind: 'survive_lethal', usesPerBattle: 1 }],
  },
  {
    id: 'dai_tri_nhuoc_ngu',
    name: 'Đại Trí Nhược Ngu',
    description: 'Người khác tu một, ngươi ngộ mười. Chậm mà sâu. Cảm Ngộ từ chiến đấu tăng gấp đôi, tốc độ tu luyện giảm 25%.',
    rarity: 'dia',
    weight: 12,
    tags: ['risk_reward', 'resource'],
    effects: [
      { kind: 'insight_gain', percent: 1 },
      { kind: 'cultivation_speed', percent: -0.25 },
    ],
  },
  {
    id: 'phan_phac',
    name: 'Phản Phác',
    description: 'Vạn pháp quy tông, sinh khắc tuần hoàn không dứt. Phản ứng Ngũ Hành có 25% cơ hội không tiêu thụ trạng thái nguyên tố.',
    rarity: 'linh',
    weight: 28,
    tags: ['element', 'mechanic'],
    effects: [{ kind: 'reaction_keep_chance', percent: 0.25 }],
  },
  {
    id: 'ngo_dao',
    name: 'Ngộ Đạo',
    description: 'Đạo ở khắp nơi, chẳng riêng gì trong chém giết. Mỗi 2.000 tu vi tích lũy được chuyển hóa thành 1 điểm Cảm Ngộ.',
    rarity: 'linh',
    weight: 28,
    tags: ['resource', 'mechanic'],
    effects: [{ kind: 'insight_per_cultivation', cultivationPerInsight: 2000 }],
  },
  {
    id: 'huyet_chien',
    name: 'Huyết Chiến',
    description: 'Càng đánh càng hăng, máu địch là thuốc của ngươi. Mỗi lần diệt quái hồi phục 2% sinh lực tối đa.',
    rarity: 'linh',
    weight: 28,
    tags: ['combat', 'defense'],
    effects: [{ kind: 'heal_on_kill', maxHpPercent: 0.02 }],
  },
  {
    id: 'luyen_the_ky_tai',
    name: 'Luyện Thể Kỳ Tài',
    description: 'Thể phách trời ban, rèn một được hai. Tiến độ Luyện Thể tăng gấp đôi.',
    rarity: 'linh',
    weight: 28,
    tags: ['cultivation', 'defense'],
    effects: [{ kind: 'body_refinement_progress', percent: 1 }],
  },
  {
    id: 'tu_bao',
    name: 'Tụ Bảo',
    description: 'Tay chạm vào đâu, Linh Thạch tụ về đó. Linh Thạch rơi tăng 50%.',
    rarity: 'pham',
    weight: 55,
    tags: ['resource'],
    effects: [{ kind: 'spirit_stone_gain', percent: 0.5 }],
  },
  {
    id: 'co_duyen',
    name: 'Cơ Duyên',
    description: 'Hữu duyên thiên lý năng tương ngộ. Tỷ lệ rơi trang bị tăng 50%.',
    rarity: 'pham',
    weight: 55,
    tags: ['resource'],
    effects: [{ kind: 'equipment_drop_chance', percent: 0.5 }],
  },
  {
    id: 'dan_duyen',
    name: 'Đan Duyên',
    description: 'Lò lửa nghe tay, đan dược nể mặt. Tỷ lệ luyện đan thành công tăng 15%.',
    rarity: 'pham',
    weight: 55,
    tags: ['crafting'],
    effects: [{ kind: 'alchemy_success_bonus', percentPoints: 15 }],
  },
]

// PARKED (talent-direction-choice-plan.md §5) — ý tưởng giữ lại từ
// catalog cũ, cần kind effect chưa tồn tại nên KHÔNG tham gia roll.
// Không xóa ý tưởng; khi kind tương ứng được thiết kế thì đưa trở lại
// CHARACTER_CREATION_TALENTS.
export const PARKED_TALENTS: TalentDefinition[] = [
  {
    // Cần conditional combat hook (giảm sát thương khi thấp HP).
    id: 'bat_khuat',
    name: 'Bất Khuất',
    description: 'Khi thấp hơn 35% sinh lực, giảm 12% sát thương nhận vào.',
    rarity: 'dia',
    weight: 12,
    tags: ['defense'],
    effects: [],
  },
  {
    // Cần pill effectiveness hook (PillSystem).
    id: 'duoc_duyen',
    name: 'Dược Duyên',
    description: 'Hiệu quả đan dược tăng 12%.',
    rarity: 'linh',
    weight: 28,
    tags: ['crafting'],
    effects: [],
  },
  {
    // Cần breakthrough hook (cộng điểm thuộc tính mỗi lần đột phá).
    id: 'dao_phap_tu_nhien',
    name: 'Đạo Pháp Tự Nhiên',
    description: 'Mỗi lần đột phá nhận thêm một điểm thuộc tính.',
    rarity: 'thien',
    weight: 4,
    tags: ['cultivation', 'mechanic'],
    effects: [],
  },
  {
    // Mechanic lớn (bỏ điểm thuộc tính tự do, chỉ số scale theo cảnh
    // giới) — cần thiết kế riêng trước khi quay lại.
    id: 'vo_cau_dao_the',
    name: 'Vô Cấu Đạo Thể',
    description: 'Không nhận điểm thuộc tính tự do; mọi chỉ số chính tăng theo cảnh giới.',
    rarity: 'di',
    weight: 1,
    tags: ['mechanic', 'risk_reward'],
    effects: [],
  },
]

// RETIRED (catalog v3) — 7 talent chỉ số của catalog cũ đã bị loại theo
// nguyên tắc "không talent cộng chỉ số": tam_tinh, can_cot_vung,
// linh_cam, kiem_tam, ngu_hanh_than, linh_mach_cong_huong,
// thien_sinh_chien_y. Save cũ còn giữ các id này sẽ bị helper bỏ qua an
// toàn (getTalentDefinition trả undefined) — không migration
// (development phase).

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

// BY_ID phủ cả catalog lẫn PARKED lẫn GREAT_DAO_REWARD để save cũ chọn
// trúng thiên phú parked vẫn resolve được definition khi hiển thị.
const TALENTS_BY_ID = new Map(
  [...CHARACTER_CREATION_TALENTS, ...PARKED_TALENTS, ...GREAT_DAO_REWARD_TALENTS].map(talent => [talent.id, talent]),
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
