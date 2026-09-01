import { describe, expect, it } from 'vitest'
import { ELEMENT_REACTIONS } from './ElementReaction'

// Spec 2026-08-30-phap-tu-dao-sac §4 — bảng reaction hoàn chỉnh 10 cặp
// (5 sinh + 5 khắc), mỗi cặp đúng 1 reaction, relation metadata cho UI
// ngôi sao + logic Chế Khắc của Đa Pháp tra bảng.
type ExpectedPair = [string, string, string, 'sinh' | 'khac']

// Khai báo THEO CHIỀU có entry trong bảng (ReactionManager tự thử 2
// chiều A→B/B→A nên bảng chỉ cần 1 chiều — test phải đọc đúng chiều khai).
const EXPECTED_PAIRS: ExpectedPair[] = [
  ['bong', 'trung_doc', 'Độc Viêm', 'sinh'],
  ['thach_hoa', 'bong', 'Dung Nham', 'sinh'],
  ['te_cong', 'trung_doc', 'Độc Thủy', 'sinh'],
  ['chay_mau', 'te_cong', 'Ngưng Lộ', 'sinh'],
  ['thach_hoa', 'chay_mau', 'Khai Sơn', 'sinh'],
  ['bong', 'te_cong', 'Bốc Hơi', 'khac'],
  ['chay_mau', 'bong', 'Thiêu Huyết', 'khac'],
  ['chay_mau', 'trung_doc', 'Huyết Độc', 'khac'],
  ['thach_hoa', 'trung_doc', 'Độc Thế', 'khac'],
  ['thach_hoa', 'te_cong', 'Trói Chân', 'khac'],
]

describe('Bảng reaction 10 cặp hoàn chỉnh (spec §4)', () => {
  it.each(EXPECTED_PAIRS)('%s + %s = %s (%s)', (a, b, name, relation) => {
    const def =
      (ELEMENT_REACTIONS as Record<string, Record<string, { name: string; relation?: string }>>)[a]?.[b]

    expect(def?.name).toBe(name)
    expect(def?.relation).toBe(relation)
  })

  it('Ngưng Lộ: buff nguồn ngung_lo, baseDamage 40, powerScalingRatio 0.5', () => {
    const def = (ELEMENT_REACTIONS as Record<string, Record<string, {
      baseDamage?: number
      powerScalingRatio?: number
      appliesBuffId?: string
    }>>).chay_mau?.te_cong

    expect(def?.baseDamage).toBe(40)
    expect(def?.powerScalingRatio).toBe(0.5)
    expect(def?.appliesBuffId).toBe('ngung_lo')
  })

  it('Khai Sơn: buff nguồn khai_son, baseDamage 50, powerScalingRatio 0.5', () => {
    const def = (ELEMENT_REACTIONS as Record<string, Record<string, {
      baseDamage?: number
      powerScalingRatio?: number
      appliesBuffId?: string
    }>>).thach_hoa?.chay_mau

    expect(def?.baseDamage).toBe(50)
    expect(def?.powerScalingRatio).toBe(0.5)
    expect(def?.appliesBuffId).toBe('khai_son')
  })

  it('tổng đúng 10 cặp — không thừa không thiếu', () => {
    let count = 0

    for (const key of Object.keys(ELEMENT_REACTIONS)) {
      count += Object.keys((ELEMENT_REACTIONS as Record<string, object>)[key]!).length
    }

    expect(count).toBe(10)
  })

  it('mọi cặp khai có relation — không cặp nào thiếu metadata', () => {
    for (const key of Object.keys(ELEMENT_REACTIONS)) {
      const bucket = (ELEMENT_REACTIONS as Record<string, Record<string, { relation?: string }>>)[key]!

      for (const sub of Object.keys(bucket)) {
        expect(bucket[sub]?.relation, `${key}+${sub} thiếu relation`).toBeDefined()
      }
    }
  })
})
