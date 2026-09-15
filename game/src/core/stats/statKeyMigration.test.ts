import { describe, expect, it } from 'vitest'

import {
  migrateStatModifier,
  migrateStatModifiers,
  migrateStatModifierStat,
  migrateStatRecordKeys,
} from './statKeyMigration'
import type { StatModifier } from './StatCalculator'

// Save payloads written before the stat-system-reimagined rename pass
// persist baseStats under the old key names. The migrator remaps those
// keys to their successors and drops keys that were retired with no
// successor, so a restore can never leave a stale key behind.
describe('migrateStatRecordKeys', () => {
  it('remaps old stat keys to their new names', () => {
    const migrated = migrateStatRecordKeys({
      attack: 10,
      hpRegenPerSecond: 2,
      manaRegenPerSecond: 3,
      wardRegenPerSecond: 4,
      speedMultiplier: 1.5,
    })

    expect(migrated).toEqual({
      might: 10,
      hpRegenPerTurn: 2,
      manaRegenPerTurn: 3,
      wardRegenPerTurn: 4,
      productionSpeedMultiplier: 1.5,
    })
  })

  it('drops retired keys that have no successor', () => {
    const migrated = migrateStatRecordKeys({
      attack: 10,
      attackRange: 5,
      maxMpPercent: 0.2,
      manaRegenPercent: 0.1,
      poisonRecoveryPercent: 0.05,
    })

    expect(migrated).toEqual({ might: 10 })
  })

  it('passes current keys through unchanged', () => {
    const migrated = migrateStatRecordKeys({ might: 10, defense: 5, maxHp: 100 })

    expect(migrated).toEqual({ might: 10, defense: 5, maxHp: 100 })
  })

  it('lets an already-new key win over a stale duplicate', () => {
    const migrated = migrateStatRecordKeys({ might: 12, attack: 5 })

    expect(migrated).toEqual({ might: 12 })
  })
})

// StatModifier.stat fields persisted outside baseStats (player.modifiers,
// equipment mainStat, socketed talisman/formation copies) carry the same
// legacy keys. The string-level helper only renames: callers that keep
// the result (equipment mainStat validation) WANT a retired key to fail
// the downstream STAT_TYPES check so the entry is flagged/discarded.
describe('migrateStatModifierStat', () => {
  it('remaps legacy stat keys to their new names', () => {
    expect(migrateStatModifierStat('attack')).toBe('might')
    expect(migrateStatModifierStat('manaRegenPerSecond')).toBe('manaRegenPerTurn')
    expect(migrateStatModifierStat('speedMultiplier')).toBe(
      'productionSpeedMultiplier',
    )
  })

  it('passes current and retired keys through unchanged', () => {
    expect(migrateStatModifierStat('might')).toBe('might')
    expect(migrateStatModifierStat('attackRange')).toBe('attackRange')
  })
})

describe('migrateStatModifier', () => {
  it('returns a remapped copy when the stat key is legacy', () => {
    const modifier: StatModifier = {
      id: 'm1',
      sourceId: 's1',
      sourceType: 'equipment',
      stat: 'attack' as StatModifier['stat'],
      flat: 10,
    }

    const migrated = migrateStatModifier(modifier)

    expect(migrated).toEqual({ ...modifier, stat: 'might' })
    expect(migrated).not.toBe(modifier)
  })

  it('returns the same reference when the stat key is current', () => {
    const modifier: StatModifier = {
      id: 'm1',
      sourceId: 's1',
      sourceType: 'equipment',
      stat: 'might',
      flat: 10,
    }

    expect(migrateStatModifier(modifier)).toBe(modifier)
  })

  it('returns null for retired stat keys — no zombie modifiers survive restore', () => {
    const retired: StatModifier = {
      id: 'm1',
      sourceId: 's1',
      sourceType: 'equipment',
      stat: 'attackRange' as StatModifier['stat'],
      flat: 5,
    }

    expect(migrateStatModifier(retired)).toBeNull()
    expect(
      migrateStatModifier({ ...retired, stat: 'maxMpPercent' as StatModifier['stat'] }),
    ).toBeNull()
    expect(
      migrateStatModifier({
        ...retired,
        stat: 'poisonRecoveryPercent' as StatModifier['stat'],
      }),
    ).toBeNull()
  })

  it('migrateStatModifiers drops retired entries and keeps migrated ones', () => {
    const keep: StatModifier = {
      id: 'm1',
      sourceId: 's1',
      sourceType: 'equipment',
      stat: 'attack' as StatModifier['stat'],
      flat: 10,
    }
    const drop: StatModifier = {
      id: 'm2',
      sourceId: 's1',
      sourceType: 'equipment',
      stat: 'attackRange' as StatModifier['stat'],
      flat: 5,
    }

    const migrated = migrateStatModifiers([keep, drop])

    expect(migrated).toHaveLength(1)
    expect(migrated[0]).toMatchObject({ id: 'm1', stat: 'might' })
  })
})
