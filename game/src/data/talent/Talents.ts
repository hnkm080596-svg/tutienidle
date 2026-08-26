import type { TalentDefinition } from '@/core/talent/Talent'

export const CHARACTER_CREATION_TALENTS: TalentDefinition[] = [
  {
    id: 'tam_tinh',
    name: 'Tâm Tĩnh Như Thủy',
    description: 'Tốc độ tu luyện tăng 8%.',
    rarity: 'pham',
    weight: 55,
    tags: ['cultivation'],
  },
  {
    id: 'can_cot_vung',
    name: 'Căn Cốt Vững Vàng',
    description: 'Sinh lực tối đa tăng 10%.',
    rarity: 'pham',
    weight: 55,
    tags: ['defense'],
  },
  {
    id: 'linh_cam',
    name: 'Linh Cảm',
    description: 'Cảm ngộ nhận được từ chiến đấu tăng 8%.',
    rarity: 'pham',
    weight: 55,
    tags: ['resource'],
  },
  {
    id: 'kiem_tam',
    name: 'Kiếm Tâm Sơ Hiện',
    description: 'Sát thương kỹ năng tăng 8% khi dùng kiếm.',
    rarity: 'linh',
    weight: 28,
    tags: ['combat', 'skill'],
  },
  {
    id: 'ngu_hanh_than',
    name: 'Ngũ Hành Thân',
    description: 'Sức mạnh Ngũ Hành tăng 6%.',
    rarity: 'linh',
    weight: 28,
    tags: ['element'],
  },
  {
    id: 'duoc_duyen',
    name: 'Dược Duyên',
    description: 'Hiệu quả đan dược tăng 12%.',
    rarity: 'linh',
    weight: 28,
    tags: ['crafting'],
  },
  {
    id: 'bat_khuat',
    name: 'Bất Khuất',
    description: 'Khi thấp hơn 35% sinh lực, giảm 12% sát thương nhận vào.',
    rarity: 'dia',
    weight: 12,
    tags: ['defense'],
  },
  {
    id: 'thien_sinh_chien_y',
    name: 'Thiên Sinh Chiến Ý',
    description: 'Sát thương tăng 12%, nhưng phòng ngự giảm 6%.',
    rarity: 'dia',
    weight: 12,
    tags: ['combat', 'risk_reward'],
  },
  {
    id: 'linh_mach_cong_huong',
    name: 'Linh Mạch Cộng Hưởng',
    description: 'Hồi mana và tốc độ thi triển tăng 10%.',
    rarity: 'dia',
    weight: 12,
    tags: ['resource', 'skill'],
  },
  {
    id: 'dao_phap_tu_nhien',
    name: 'Đạo Pháp Tự Nhiên',
    description: 'Mỗi lần đột phá nhận thêm một điểm thuộc tính.',
    rarity: 'thien',
    weight: 4,
    tags: ['cultivation', 'mechanic'],
  },
  {
    id: 'nghich_thien',
    name: 'Nghịch Thiên Cải Mệnh',
    description: 'Sát thương tăng 20%, nhưng lôi kiếp gây thêm 10% sát thương.',
    rarity: 'thien',
    weight: 4,
    tags: ['risk_reward', 'mechanic'],
  },
  {
    id: 'vo_cau_dao_the',
    name: 'Vô Cấu Đạo Thể',
    description: 'Không nhận điểm thuộc tính tự do; mọi chỉ số chính tăng theo cảnh giới.',
    rarity: 'di',
    weight: 1,
    tags: ['mechanic', 'risk_reward'],
  },
]

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
