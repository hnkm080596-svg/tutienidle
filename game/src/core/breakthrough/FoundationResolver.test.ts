import { describe, expect, it } from 'vitest'
import { resolveFoundation } from './FoundationResolver'
import { MaterialBag } from '../material/MaterialBag'
import { PillBag } from '../pill/PillBag'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'

const GREAT_DAO_SEED = materials.find(material => material.id === 'great_dao_seed')!
const FOUNDATION_PILL = pills.find(pill => pill.id === 'foundation_pill')!
const BODY_REFINING_PILL = pills.find(pill => pill.id === 'body_refining_pill')!
const SPIRIT_FORGING_PILL = pills.find(pill => pill.id === 'spirit_forging_pill')!

const REALM_CAP = 20

function permanentPillModifier(stat: 'maxHp' | 'defense' | 'maxMp', flat: number): StatModifier {
  return { id: `pill-permanent:${stat}`, sourceId: 'test', sourceType: 'pill', stat, flat }
}

function playerAt(realmLevel: number, modifiers: StatModifier[] = []): PlayerData {
  // Phàm Nhân (2026-08-16) — createDefaultPlayer() giờ khởi tạo ở
  // 'mortal', nhưng test file này giả lập nhân vật SẮP Trúc Cơ (tức
  // đang ở qi_refining) — set tường minh, không phụ thuộc cảnh giới
  // khởi điểm mặc định (FoundationResolver không đọc realmId nên số
  // vẫn ra đúng dù không set, nhưng fixture nên khớp ngữ nghĩa thật).
  return { ...createDefaultPlayer(), realmId: 'qi_refining', realmLevel, modifiers }
}

// Nạp đủ ĐIỀU KIỆN VẬT PHẨM cho Đại Đạo (mục III/IV spec `breakthrough`)
// nhưng KHÔNG đụng tới stat 20/20 — dùng để test riêng nhánh thiếu stat.
function bagsWithGreatDaoItems(): { materialBag: MaterialBag; pillBag: PillBag } {
  const materialBag = new MaterialBag()
  const pillBag = new PillBag()

  materialBag.add(GREAT_DAO_SEED, 1)
  pillBag.add(FOUNDATION_PILL, 10)
  pillBag.add(BODY_REFINING_PILL, 10)
  pillBag.add(SPIRIT_FORGING_PILL, 10)

  return { materialBag, pillBag }
}

describe('resolveFoundation (mục 17 spec breakthrough — HiddenConditionChecker)', () => {
  it('trả về Nhân Đạo ở ngưỡng cơ bản (Luyện Khí 9, không vượt tầng)', () => {
    const player = playerAt(9)
    const { materialBag, pillBag } = bagsWithGreatDaoItems()

    // Không đủ Luyện Khí ≥18 nên dù có đủ item vẫn không thể là Đại Đạo —
    // ở đây realmLevel 9 còn chưa đạt cả Địa/Thiên Đạo.
    expect(resolveFoundation(player, new MaterialBag(), new PillBag(), REALM_CAP)).toBe('human')
    expect(resolveFoundation(player, materialBag, pillBag, REALM_CAP)).toBe('human')
  })

  it('trả về Địa Đạo khi vượt tầng 9 (realmLevel 11)', () => {
    const player = playerAt(11)

    expect(resolveFoundation(player, new MaterialBag(), new PillBag(), REALM_CAP)).toBe('earth')
  })

  it('trả về Thiên Đạo khi vượt tầng 11 (realmLevel 12)', () => {
    const player = playerAt(12)

    expect(resolveFoundation(player, new MaterialBag(), new PillBag(), REALM_CAP)).toBe('heaven')
  })

  it('Đại Đạo: đủ realmLevel ≥18 + item nhưng THIẾU stat 20/20 → rơi về Thiên Đạo, không lộ lý do', () => {
    const player = playerAt(18, [
      permanentPillModifier('maxHp', REALM_CAP),
      permanentPillModifier('defense', REALM_CAP),
      // maxMp cố tình thiếu — mô phỏng "chưa đủ điều kiện"
    ])

    const { materialBag, pillBag } = bagsWithGreatDaoItems()

    expect(resolveFoundation(player, materialBag, pillBag, REALM_CAP)).toBe('heaven')
  })

  it('Đại Đạo: đủ TOÀN BỘ điều kiện ẩn (realmLevel≥18 + item + stat 20/20) → Đại Đạo', () => {
    const player = playerAt(18, [
      permanentPillModifier('maxHp', REALM_CAP),
      permanentPillModifier('defense', REALM_CAP),
      permanentPillModifier('maxMp', REALM_CAP),
    ])

    const { materialBag, pillBag } = bagsWithGreatDaoItems()

    expect(resolveFoundation(player, materialBag, pillBag, REALM_CAP)).toBe('great_dao')
  })

  it('Đại Đạo: thiếu Đại Đạo Chi Cơ trong túi dù đủ mọi thứ khác → Thiên Đạo', () => {
    const player = playerAt(18, [
      permanentPillModifier('maxHp', REALM_CAP),
      permanentPillModifier('defense', REALM_CAP),
      permanentPillModifier('maxMp', REALM_CAP),
    ])

    const pillBag = new PillBag()

    pillBag.add(FOUNDATION_PILL, 10)
    pillBag.add(BODY_REFINING_PILL, 10)
    pillBag.add(SPIRIT_FORGING_PILL, 10)

    // materialBag rỗng — không có great_dao_seed
    expect(resolveFoundation(player, new MaterialBag(), pillBag, REALM_CAP)).toBe('heaven')
  })

  it('currentRealmCap undefined (không xác định được trần cảnh giới) → không bao giờ là Đại Đạo', () => {
    const player = playerAt(18, [
      permanentPillModifier('maxHp', REALM_CAP),
      permanentPillModifier('defense', REALM_CAP),
      permanentPillModifier('maxMp', REALM_CAP),
    ])

    const { materialBag, pillBag } = bagsWithGreatDaoItems()

    expect(resolveFoundation(player, materialBag, pillBag, undefined)).toBe('heaven')
  })
})
