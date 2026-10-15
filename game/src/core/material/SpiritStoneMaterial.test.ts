import { describe, expect, it } from 'vitest'
import {
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_MATERIAL_ID,
  SPIRIT_STONE_MATERIALS,
} from './SpiritStoneMaterial'

// Flatten (2026-10-11, owner ruling): one spirit stone, no pham tiers.
describe('Linh Thạch', () => {
  it('catalog holds exactly one stone material', () => {
    expect(SPIRIT_STONE_MATERIALS).toEqual([SPIRIT_STONE_MATERIAL])
  })

  it('stone id/name/stackLimit', () => {
    expect(SPIRIT_STONE_MATERIAL.id).toBe('material_spirit_stone')
    expect(SPIRIT_STONE_MATERIAL_ID).toBe(SPIRIT_STONE_MATERIAL.id)
    expect(SPIRIT_STONE_MATERIAL.name).toBe('Linh Thạch')
    expect(SPIRIT_STONE_MATERIAL.category).toBe('spirit_stone')
    expect(SPIRIT_STONE_MATERIAL.stackLimit).toBe(Number.MAX_SAFE_INTEGER)
  })
})
