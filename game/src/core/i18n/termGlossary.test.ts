import { describe, expect, it } from 'vitest'
import { TERMS, term, type TermKey } from './termGlossary'

describe('termGlossary', () => {
  it('mọi thuật ngữ đều có giá trị non-empty', () => {
    for (const [key, value] of Object.entries(TERMS)) {
      expect(typeof value, `TERMS.${key} phải là string`).toBe('string')
      expect(value.length, `TERMS.${key} rỗng`).toBeGreaterThan(0)
    }
  })

  it('term() tra đúng giá trị theo key', () => {
    expect(term('skillLevel')).toBe('Cấp')
    expect(term('realmLevel')).toBe('Tầng')
    expect(term('itemTier')).toBe('Bậc')
    expect(term('damage')).toBe('Sát Thương')
    expect(term('damageAbbrev')).toBe('ST')
    expect(term('stat')).toBe('Chỉ Số')
    expect(term('attack')).toBe('Công Kích')
    expect(term('defense')).toBe('Phòng Thủ')

    for (const key of Object.keys(TERMS) as TermKey[]) {
      expect(term(key)).toBe(TERMS[key])
    }
  })

  it('key lạ bị từ chối lúc compile (type-level)', () => {
    const unknownKey: string = 'khong_ton_tai'
    // @ts-expect-error — key ngoài TermKey phải lỗi type, không chờ runtime
    expect(term(unknownKey)).toBeUndefined()
  })
})
