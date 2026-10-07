import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import {
  collectPhapTuSkillDefinitionModifiers,
  applyPhapTuSkillDefinitionModifiers,
  SPECIAL_CD_FLOOR_TURNS,
  type PhapTuSkillDefinitionModifier,
} from './PhapTuNodeModifiers'
import { buildBasicBranch } from '../../data/progression/PhapTuBasicNodes'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'

// Fire tree rulings (Minh, 2026-10-06 spec v4) - pins for the
// node -> def fold channels that power the Hoa lane:
//  * castStatModifiers fold onto the def's castModifiers and apply
//    only while that skill's hit resolves (never character stats);
//  * cooldownTurnsDelta lands on the special def, floored at
//    SPECIAL_CD_FLOOR_TURNS;
//  * collect() gates on element effectiveness (a committed different
//    element's nodes must not leak) and node level > 0.

const FIRE_NODES = buildBasicBranch('fire')

function hoaPlayer(
  nodeLevels: Record<string, number>,
  committed: 'fire' | 'water' = 'fire',
): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  player.spellPath = { element: committed }
  player.nodeLevels = { ...nodeLevels }
  return player
}

function kitDef(overrides: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id: 'hoa_cau_thuat',
    name: 'Ly Hỏa',
    type: 'damage',
    targeting: 'enemy',
    damage: { percent: 1 },
    cooldownTurns: 0,
    ...overrides,
  } as TurnSkillDefinition
}

function mod(partial: Partial<PhapTuSkillDefinitionModifier> & Pick<PhapTuSkillDefinitionModifier, 'nodeId' | 'skillId'>): PhapTuSkillDefinitionModifier {
  return { level: 1, priority: 0, ...partial }
}

describe('collectPhapTuSkillDefinitionModifiers', () => {
  it('returns nothing for a different committed element (level > 0 but gate off)', () => {
    const player = hoaPlayer({ hoa_diem_uy: 5 }, 'water')
    expect(collectPhapTuSkillDefinitionModifiers(player, FIRE_NODES)).toEqual([])
  })

  it('returns nothing when the element is committed but nodes are unowned', () => {
    expect(collectPhapTuSkillDefinitionModifiers(hoaPlayer({}), FIRE_NODES)).toEqual([])
  })

  it('collects the cast-scoped stat channels per owned node level', () => {
    const mods = collectPhapTuSkillDefinitionModifiers(
      hoaPlayer({ hoa_diem_uy: 3, hoa_hoa_nhan: 2 }),
      FIRE_NODES,
    )
    expect(mods.map((m) => m.nodeId).sort()).toEqual(['hoa_diem_uy', 'hoa_hoa_nhan'])
    expect(mods.find((m) => m.nodeId === 'hoa_diem_uy')!.level).toBe(3)
  })
})

describe('applyPhapTuSkillDefinitionModifiers - castModifiers', () => {
  it('folds per-level cast stats onto a derived copy (source untouched)', () => {
    const def = kitDef()
    const folded = applyPhapTuSkillDefinitionModifiers(def, [
      mod({
        nodeId: 'hoa_diem_uy',
        skillId: 'hoa_cau_thuat',
        level: 3,
        castStatModifiers: [{ stat: 'skillDamagePercent', perLevel: 0.06 }],
      }),
    ], 0)
    expect(folded.castModifiers).toEqual([{ stat: 'skillDamagePercent', value: 0.18 }])
    expect(def.castModifiers).toBeUndefined()
    expect(folded).not.toBe(def)
  })

  it('sums same-stat entries from different nodes into one record', () => {
    const folded = applyPhapTuSkillDefinitionModifiers(kitDef(), [
      mod({
        nodeId: 'hoa_diem_uy',
        skillId: 'hoa_cau_thuat',
        level: 2,
        castStatModifiers: [{ stat: 'skillDamagePercent', perLevel: 0.06 }],
      }),
      mod({
        nodeId: 'ngu_viem_tam',
        skillId: 'hoa_cau_thuat',
        level: 1,
        castStatModifiers: [{ stat: 'skillDamagePercent', perLevel: 0.06 }],
      }),
    ], 0)
    expect(folded.castModifiers).toEqual([{ stat: 'skillDamagePercent', value: 0.18 }])
  })

  it('returns the def untouched when no modifier targets its skill id', () => {
    const def = kitDef()
    const folded = applyPhapTuSkillDefinitionModifiers(def, [
      mod({
        nodeId: 'ngu_hoa',
        skillId: 'tam_muoi_chan_hoa',
        level: 3,
        cooldownTurnsDelta: { perLevel: -0.5 },
      }),
    ], 0)
    expect(folded).toBe(def)
  })
})

describe('applyPhapTuSkillDefinitionModifiers - cooldownTurnsDelta', () => {
  const special = () => kitDef({ id: 'tam_muoi_chan_hoa', cooldownTurns: 5 })

  it('perLevel delta trims the special cooldown', () => {
    const folded = applyPhapTuSkillDefinitionModifiers(special(), [
      mod({ nodeId: 'ngu_hoa', skillId: 'tam_muoi_chan_hoa', level: 4, cooldownTurnsDelta: { perLevel: -0.5 } }),
    ], SPECIAL_CD_FLOOR_TURNS)
    expect(folded.cooldownTurns).toBe(3)
  })

  it('flat trade penalty applies ONCE at any owned level (not per level)', () => {
    for (const level of [1, 5]) {
      const folded = applyPhapTuSkillDefinitionModifiers(special(), [
        mod({ nodeId: 'ngu_viem_tam', skillId: 'tam_muoi_chan_hoa', level, cooldownTurnsDelta: { flat: 1 } }),
      ], SPECIAL_CD_FLOOR_TURNS)
      expect(folded.cooldownTurns).toBe(6)
    }
  })

  it('floors the cooldown at SPECIAL_CD_FLOOR_TURNS', () => {
    const folded = applyPhapTuSkillDefinitionModifiers(special(), [
      mod({ nodeId: 'ngu_hoa', skillId: 'tam_muoi_chan_hoa', level: 5, cooldownTurnsDelta: { perLevel: -0.5 } }),
    ], SPECIAL_CD_FLOOR_TURNS)
    expect(folded.cooldownTurns).toBe(SPECIAL_CD_FLOOR_TURNS)
  })

  it('perLevel + flat compose: Ngu Hoa trim minus one learned trade', () => {
    const folded = applyPhapTuSkillDefinitionModifiers(special(), [
      mod({ nodeId: 'ngu_hoa', skillId: 'tam_muoi_chan_hoa', level: 4, cooldownTurnsDelta: { perLevel: -0.5 } }),
      mod({ nodeId: 'ngu_viem_y', skillId: 'tam_muoi_chan_hoa', level: 1, cooldownTurnsDelta: { flat: 1 } }),
    ], SPECIAL_CD_FLOOR_TURNS)
    // 5 - 4*0.5 + 1 = 4
    expect(folded.cooldownTurns).toBe(4)
  })

  it('basic-lane floor 0: a delta can neither invent a cooldown on a 0-CD def nor clamp below zero', () => {
    // REV-A latent finding: SPECIAL_CD_FLOOR_TURNS is the special-ult
    // contract ("minimum 2 turn CD"), not a universal law - folding a
    // basic with that floor would CREATE a 2-turn cooldown from a
    // 0-CD def on a positive delta and would lift a shallow negative
    // back to 2. The basic lane passes floor 0: a positive delta is
    // honored data-first, a negative one just clamps at 0.
    const basic = () => kitDef({ id: 'hoa_cau_thuat', cooldownTurns: 0 })

    const raised = applyPhapTuSkillDefinitionModifiers(basic(), [
      mod({ nodeId: 'n', skillId: 'hoa_cau_thuat', level: 1, cooldownTurnsDelta: { flat: 1 } }),
    ], 0)
    expect(raised.cooldownTurns).toBe(1)

    const clamped = applyPhapTuSkillDefinitionModifiers(basic(), [
      mod({ nodeId: 'n', skillId: 'hoa_cau_thuat', level: 1, cooldownTurnsDelta: { flat: -2 } }),
    ], 0)
    expect(clamped.cooldownTurns).toBe(0)
  })
})

describe('fire node data sanity', () => {
  const byId = new Map(FIRE_NODES.map((n) => [n.id, n]))

  it('the Ly Hoa chain + Tam Muoi lane + mana branch exist with expected prereqs', () => {
    for (const id of [
      'hoa_diem_uy', 'hoa_hoa_nhan', 'hoa_pha_giap_diem', 'hoa_bao_diem', 'hoa_phe_diem',
      'ngu_hoa', 'ngu_viem_tam', 'ngu_viem_y',
      'ho_the_mon', 'nguyen_kinh', 'linh_chuong', 'the_diem_kinh',
    ]) {
      expect(byId.has(id), id).toBe(true)
    }
    // Mana branch is SOLO off the element root (Minh ruling), not under
    // the Tam Muoi unlock.
    expect(byId.get('ho_the_mon')!.prerequisites).toEqual([
      { kind: 'node', nodeId: 'hoa_linh_ngo' },
      { kind: 'realm', realmId: 'foundation_establishment' },
    ])
    expect(byId.get('nguyen_kinh')!.prerequisites).toEqual([{ kind: 'node', nodeId: 'ho_the_mon' }])
    expect(byId.get('linh_chuong')!.prerequisites).toEqual([{ kind: 'node', nodeId: 'ho_the_mon' }])
    expect(byId.get('the_diem_kinh')!.prerequisites).toEqual([{ kind: 'node', nodeId: 'nguyen_kinh' }])
  })
})
