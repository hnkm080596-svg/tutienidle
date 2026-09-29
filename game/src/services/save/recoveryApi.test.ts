// Beta-final B1.9a - remote-mode manual import is validate+export only.
// validateRecoveryData runs the same pipeline the boot load and the
// server gate apply; exportFilename stamps source + revision onto the
// artifact name so a downloaded file identifies its provenance.
import { describe, expect, it } from 'vitest'
import { exportFilename, validateRecoveryData } from './recoveryApi'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { createDefaultPlayer } from '../../core/player/Player'
import type { GameSave } from './saveTypes'

function validGameSave(): GameSave {
  const player = createDefaultPlayer()
  player.mortalBasicSkillId = 'tram'
  player.nodeLevels = { ...player.nodeLevels, core_tram: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_tram']
  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [],
    skills: [
      {
        id: 'tram',
        name: 'Trảm',
        description: 'creation pick',
        type: 'active',
        level: 1,
        maxLevel: 10,
        cooldown: 0,
        target: 'enemy',
        effects: [],
      },
    ],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

describe('validateRecoveryData - same pipeline as the authoritative load', () => {
  it('a valid current-version save validates and returns normalized bytes', () => {
    const raw = JSON.stringify(validGameSave())
    const result = validateRecoveryData(raw)

    expect(result.status).toBe('valid')
    if (result.status === 'valid') {
      expect(result.version).toBe(CURRENT_SAVE_VERSION)
      expect(JSON.parse(result.normalizedRaw)).toMatchObject({ version: CURRENT_SAVE_VERSION })
    }
  })

  it('unparseable content → invalid', () => {
    expect(validateRecoveryData('not json {{{').status).toBe('invalid')
  })

  it('missing version/player fields → invalid', () => {
    expect(validateRecoveryData(JSON.stringify({ version: CURRENT_SAVE_VERSION })).status).toBe('invalid')
    expect(validateRecoveryData(JSON.stringify({ player: {} })).status).toBe('invalid')
  })

  it('a different-version payload → incompatible + raw preserved verbatim', () => {
    const raw = JSON.stringify({ version: 42, player: { name: 'Old' } })
    const result = validateRecoveryData(raw)

    expect(result).toEqual({ status: 'incompatible', raw, foundVersion: 42 })
  })

  it('current version but broken shape → invalid (same as the boot gate)', () => {
    const raw = JSON.stringify({ ...validGameSave(), player: null })
    expect(validateRecoveryData(raw).status).toBe('invalid')
  })

  it('a payload the acceptance gate rejects → invalid (no poison resurrection)', () => {
    const broken = validGameSave()
    // Mortal boundary: pick + learned entry + core grant are mandatory.
    broken.player.mortalBasicSkillId = ''
    const raw = JSON.stringify(broken)
    expect(validateRecoveryData(raw).status).toBe('invalid')
  })
})

describe('exportFilename - provenance stamped artifact name (B1.9a)', () => {
  it('no provenance keeps the legacy name', () => {
    expect(exportFilename(undefined, 123)).toBe('tien-hiep-idle-save-123.json')
  })

  it.each([
    [{ source: 'cloud' as const, revision: 5 }, 'tien-hiep-idle-save-cloud-r5-123.json'],
    [{ source: 'local' as const, revision: 5 }, 'tien-hiep-idle-save-local-r5-123.json'],
    [{ source: 'recovery-import' as const }, 'tien-hiep-idle-save-recovery-import-123.json'],
  ])('provenance %j → %s', (provenance, expected) => {
    expect(exportFilename(provenance, 123)).toBe(expected)
  })
})
