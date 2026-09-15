import { describe, expect, it } from 'vitest'
import {
  initKiemPhoBattle,
  nextOrb,
  realmComboMax,
  recordCastAndMatch,
  validatePreset,
  type KiemPhoBattleState,
  type KiemPhoCombo,
} from './KiemPhoSystem'
import type { OrbId } from './KiemTuState'
import { createDefaultPlayer, type PlayerData } from '../player/Player'

// Kiem Tu Reimagined Task 4 — KiemPhoSystem matcher core (spec
// 2026-09-15 §4.1): preset cursor, <=5-entry cast log, longest-first
// TAIL match gated by realmComboMax, full reset on fire. The combo
// TABLE is Task-5 data — matcher tests inject fixture combos (A6: core
// never imports data).

function hienPlayer(preset: OrbId[], realmId = 'qi_refining'): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = realmId
  player.cultivationPath = 'kiem_tu'
  player.kiemTu = {
    mode: 'hien',
    preset,
    kiemY: 0,
    kiemDaoCount: 1,
    kiemDaoBase: 1,
  }
  return player
}

// Fixture combos — real patterns land in Task 5's KIEM_PHO_COMBOS.
const COMBO_LEN3: KiemPhoCombo = {
  id: 'test_len3',
  pattern: ['orb_dam', 'orb_dam', 'orb_dam'],
  presetId: 'slash',
}
const COMBO_LEN4: KiemPhoCombo = {
  id: 'test_len4',
  pattern: ['orb_bo', 'orb_chem', 'orb_dam', 'orb_bo'],
  presetId: 'slash',
}
const COMBOS = [COMBO_LEN3, COMBO_LEN4]

describe('realmComboMax', () => {
  it('gates combo length by realm: <3→3, 3..5→4, >=6→5', () => {
    expect(realmComboMax(1)).toBe(3)
    expect(realmComboMax(2)).toBe(3)
    expect(realmComboMax(3)).toBe(4)
    expect(realmComboMax(5)).toBe(4)
    expect(realmComboMax(6)).toBe(5)
    expect(realmComboMax(9)).toBe(5)
  })
})

describe('initKiemPhoBattle + nextOrb', () => {
  it('snapshots the persisted preset, starts cursor at 0 and log empty', () => {
    const player = hienPlayer(['orb_dam', 'orb_chem'] as OrbId[])
    const state = initKiemPhoBattle(player)

    expect(state.preset).toEqual(['orb_dam', 'orb_chem'])
    expect(state.cursor).toBe(0)
    expect(state.log).toEqual([])
    expect(state.comboMaxLength).toBe(3)
  })

  it('preset snapshot is detached from PlayerData (A3)', () => {
    const player = hienPlayer(['orb_dam'] as OrbId[])
    const state = initKiemPhoBattle(player)
    player.kiemTu!.preset = ['orb_bo']

    expect(state.preset).toEqual(['orb_dam'])
  })

  it('nextOrb advances the cursor and wraps mod preset.length', () => {
    const player = hienPlayer(['orb_dam', 'orb_chem', 'orb_bo'] as OrbId[], 'golden_core')
    const state = initKiemPhoBattle(player)

    expect(nextOrb(state)).toBe('orb_dam')
    expect(nextOrb(state)).toBe('orb_chem')
    expect(nextOrb(state)).toBe('orb_bo')
    expect(nextOrb(state)).toBe('orb_dam')
    expect(state.cursor).toBe(1)
  })
})

describe('recordCastAndMatch', () => {
  function freshState(realmId = 'qi_refining'): KiemPhoBattleState {
    return initKiemPhoBattle(hienPlayer(['orb_dam'] as OrbId[], realmId))
  }

  it('matches a len-3 tail and resets the log', () => {
    const state = freshState()
    expect(recordCastAndMatch(state, 'orb_dam', COMBOS)).toBeNull()
    expect(recordCastAndMatch(state, 'orb_dam', COMBOS)).toBeNull()
    const fired = recordCastAndMatch(state, 'orb_dam', COMBOS)

    expect(fired?.id).toBe('test_len3')
    expect(state.log).toEqual([])
  })

  it('longest-first: a len-4 tail beats a len-3 tail when comboMaxLength >= 4', () => {
    const state = freshState('golden_core')
    const len3: KiemPhoCombo = { id: 'tail3', pattern: ['orb_chem', 'orb_dam', 'orb_bo'], presetId: 'slash' }
    const combos = [...COMBOS, len3]

    recordCastAndMatch(state, 'orb_bo', combos)
    recordCastAndMatch(state, 'orb_chem', combos)
    recordCastAndMatch(state, 'orb_dam', combos)
    const fired = recordCastAndMatch(state, 'orb_bo', combos)

    // tail4 B-C-D-B wins over tail3 C-D-B
    expect(fired?.id).toBe('test_len4')
  })

  it('realm gate: len-4 combos cannot match while comboMaxLength === 3', () => {
    const state = freshState('qi_refining')
    const combos: KiemPhoCombo[] = [
      { id: 'only4', pattern: ['orb_bo', 'orb_chem', 'orb_dam', 'orb_bo'], presetId: 'slash' },
    ]

    for (const orb of ['orb_bo', 'orb_chem', 'orb_dam', 'orb_bo'] as OrbId[]) {
      expect(recordCastAndMatch(state, orb, combos)).toBeNull()
    }
  })

  it('log never exceeds 5 entries', () => {
    const state = freshState('tribulation')
    for (let i = 0; i < 9; i++) {
      recordCastAndMatch(state, 'orb_chem', COMBOS)
    }
    expect(state.log.length).toBeLessThanOrEqual(5)
  })

  it('a fired combo cannot chain into a second fire on the same cast', () => {
    const state = freshState()
    recordCastAndMatch(state, 'orb_dam', COMBOS)
    recordCastAndMatch(state, 'orb_dam', COMBOS)
    recordCastAndMatch(state, 'orb_dam', COMBOS) // fires, log cleared
    // one more cast cannot re-fire — log only holds 1 entry
    expect(recordCastAndMatch(state, 'orb_dam', COMBOS)).toBeNull()
    expect(state.log).toEqual(['orb_dam'])
  })
})

describe('validatePreset', () => {
  it('rejects empty, >9-length, and locked orbs', () => {
    expect(validatePreset([], 1)).toBe(false)
    expect(validatePreset(Array(10).fill('orb_dam'), 9)).toBe(false)
    expect(validatePreset(['orb_chem'], 1)).toBe(false)   // chem unlocks at realm 2
    expect(validatePreset(['orb_dam'], 1)).toBe(true)
    expect(validatePreset(['orb_dam', 'orb_quet'], 5)).toBe(true)
    expect(validatePreset(['orb_dam', 'orb_quet'], 4)).toBe(false)
  })
})
