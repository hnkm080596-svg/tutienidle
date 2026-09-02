import { describe, expect, it } from 'vitest'
import { composeEquipmentNameSegments, composeEquipmentDisplayName } from './EquipmentNaming'
import { makeInstance } from './EquipmentInstance.fixture'
import type { Equipment } from './Equipment'
import { ZoneRegistry } from '../stage/ZoneRegistry'

// Rework P6 (item-grade-quality-rework, Task 21 fix round) — code review
// flagged composeEquipmentNameSegments as having only INDIRECT coverage
// (useEquipmentTooltip.test.ts's tooltip.name.toContain('Địa') check,
// which doesn't verify segment count/order/colorVar/tone). This file adds
// direct coverage of the 3-segment shape [grade, quality, name] this
// function actually produces (verified against the current implementation).

const TEMPLATE: Equipment = {
  id: 'test_sword',
  name: 'Thanh Vân Kiếm',
  slot: 'weapon',
  grade: 1,
  mainStats: [{ stat: 'attack', min: 8, max: 12 }],
  maxEnhanceLevel: 10,
}

function setup() {
  return { zoneRegistry: new ZoneRegistry() }
}

describe('composeEquipmentNameSegments', () => {
  it('cuu_pham (bậc thấp nhất) + hoang (chất thấp nhất) — 3 segment [grade, quality, name], mỗi trục 1 namespace màu riêng', () => {
    const { zoneRegistry } = setup()
    const instance = makeInstance({ grade: 'cuu_pham', quality: 'hoang' })

    const segments = composeEquipmentNameSegments(instance, TEMPLATE, zoneRegistry)

    expect(segments).toHaveLength(3)

    expect(segments[0]).toMatchObject({
      text: 'Cửu Phẩm',
      colorVar: '--rank-color-1',
      tone: 'cuu_pham',
    })

    // Fix 2 (final review) — quality dùng --grade-* (namespace riêng),
    // KHÔNG còn --rank-color-N như grade segment ở trên (spec §5.8).
    expect(segments[1]).toMatchObject({
      text: 'Hoàng Chất',
      colorVar: '--grade-hoang',
      tone: 'hoang',
    })

    expect(segments[2]).toMatchObject({ text: 'Thanh Vân Kiếm' })
  })

  it('tien_pham (bậc cao nhất, rank 10) + tien (chất cao nhất) — colorVar tách đúng namespace riêng, không lẫn nhau', () => {
    const { zoneRegistry } = setup()
    const instance = makeInstance({ grade: 'tien_pham', quality: 'tien' })

    const segments = composeEquipmentNameSegments(instance, TEMPLATE, zoneRegistry)

    expect(segments).toHaveLength(3)

    expect(segments[0]).toMatchObject({
      text: 'Tiên Phẩm',
      colorVar: '--rank-color-10',
      tone: 'tien_pham',
    })

    expect(segments[1]).toMatchObject({
      text: 'Tiên Chất',
      colorVar: '--grade-tien',
      tone: 'tien',
    })
  })

  it('trường hợp lệch bậc (grade cao, quality thấp) — mỗi segment tô màu theo ĐÚNG namespace của trục nó, không rơi vào thang của trục kia', () => {
    const { zoneRegistry } = setup()
    // Phẩm nghề cao (ngu_pham, rank 5 trên thang 10 bậc, --rank-color-5)
    // nhưng Chất thấp (huyen, --grade-huyen) — 2 trục độc lập, 2 namespace
    // màu khác nhau, không suy ra lẫn nhau (đúng ý đồ tách trục của
    // Task 20/21 + Fix 2 final review).
    const instance = makeInstance({ grade: 'ngu_pham', quality: 'huyen' })

    const segments = composeEquipmentNameSegments(instance, TEMPLATE, zoneRegistry)

    expect(segments[0]).toMatchObject({
      text: 'Ngũ Phẩm',
      colorVar: '--rank-color-5',
      tone: 'ngu_pham',
    })

    expect(segments[1]).toMatchObject({
      text: 'Huyền Chất',
      colorVar: '--grade-huyen',
      tone: 'huyen',
    })
  })

  it('ghép tiền tố Địa Giới khi instance có zoneId đã đăng ký trong ZoneRegistry', () => {
    const { zoneRegistry } = setup()
    zoneRegistry.register({ id: 'thanh_van', name: 'Thanh Vân', stageIds: ['stage_1'] })
    const instance = makeInstance({ grade: 'bat_pham', quality: 'dia', zoneId: 'thanh_van' })

    const segments = composeEquipmentNameSegments(instance, TEMPLATE, zoneRegistry)

    expect(segments[2]?.text).toBe('Thanh Vân Thanh Vân Kiếm')
  })

  it('composeEquipmentDisplayName nối cả 3 segment bằng " · "', () => {
    const { zoneRegistry } = setup()
    const instance = makeInstance({ grade: 'cuu_pham', quality: 'hoang' })

    expect(composeEquipmentDisplayName(instance, TEMPLATE, zoneRegistry)).toBe('Cửu Phẩm · Hoàng Chất · Thanh Vân Kiếm')
  })
})
