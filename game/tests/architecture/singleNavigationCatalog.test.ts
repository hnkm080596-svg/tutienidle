import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COMMAND_WHEEL_SLOTS,
  HOME_RAIL_ENTRIES,
  HOME_RAIL_ENTRY_BY_ID,
  WHEEL_SLOT_SYMBOL,
} from '@/data/ui/homeNavigationCatalog'

const SRC_DIR = join(process.cwd(), 'src')

describe('single home navigation catalog architecture (Slice 3.3, V2)', () => {
  it('homeNavigationCatalog.ts owns all 21 rail entries and every wheel slot symbol', () => {
    expect(HOME_RAIL_ENTRIES).toHaveLength(21)
    expect(HOME_RAIL_ENTRIES.map((e) => e.id)).toEqual([
      'home',
      'character',
      'skill',
      'equipment',
      'body',
      'technique',
      'realm',
      'inventory',
      'alchemy',
      'formation',
      'exploration',
      'quest',
      'production',
      'vendor',
      'sect',
      'settings',
      'feedback',
      'artifact',
      'companion',
      'guild',
      'portal',
    ])

    for (const entry of HOME_RAIL_ENTRIES) {
      expect(HOME_RAIL_ENTRY_BY_ID[entry.id]).toBe(entry)
    }

    for (const slot of COMMAND_WHEEL_SLOTS) {
      expect(WHEEL_SLOT_SYMBOL[slot.id], `missing symbol for wheel slot ${slot.id}`).toBeDefined()
    }
  })

  it('DongFuStage.vue does not embed parallel navigation lookup tables', () => {
    const source = readFileSync(
      join(SRC_DIR, 'components/scenes/dong-fu/DongFuStage.vue'),
      'utf8',
    )
    expect(source).toContain('HOME_RAIL_ENTRIES')
    expect(source).toContain('HOME_RAIL_ENTRY_BY_ID')
    expect(source).toContain('WHEEL_SLOT_SYMBOL')
    expect(source).not.toMatch(/\bconst\s+(SLOT_SYMBOL|NAV_LOCKED|NAV_ITEMS|NAV_FEATURE_LOCKED|NAV_TARGET|NAV_ACTIVE_PANEL|NAV_ACTIVE_STANDALONE)\b/)
  })
})
