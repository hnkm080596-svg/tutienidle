import { describe, expect, it } from 'vitest'


import { buildTalentTooltip, talentIconUrl } from './useTalentTooltip'
import { CHARACTER_CREATION_TALENTS } from '@/data/talent/Talents'
const shippedIcons = import.meta.glob('/public/assets/ui/tien-hiep-2026-10/character-presentation/talents-painted-v1/*.webp', { query: '?url', import: 'default', eager: true })

describe('talent presentation identity', () => {
  it('preserves authored mechanics and separates explicit tradeoffs', () => {
    const talent = CHARACTER_CREATION_TALENTS.find((entry) => entry.id === 'tat_phong')!
    const tooltip = buildTalentTooltip(talent, (key) => key)
    expect(tooltip.flavor).toBe('Gió theo sát từng đường kiếm.')
    expect(tooltip.mechanics).toContain('+2% Tốc Độ')
    expect(tooltip.tradeoff).toContain('mất sạch')
    expect(tooltip.description).toBe(talent.description)
  })
  it('gives every creation talent an authored replacement icon', () => {
    for (const talent of CHARACTER_CREATION_TALENTS) {
      const url = talentIconUrl(talent)
      expect(url).toContain(`talents-painted-v1/${talent.id}.webp`)
      expect(shippedIcons).toHaveProperty(`/public${url}`)
    }
  })
})
