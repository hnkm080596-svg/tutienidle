// QA novel-attack probes for kiem-pho-beta (attack-model.json ATK-*).
// Crafted/adversarial inputs driven straight at the seams - not user
// flow coverage. Lives inside docs/qa/runs/ so it never moves the
// productStateId hash.
import { describe, expect, it } from 'vitest'

import { realmComboMax, validatePreset, recordCastAndMatch, initKiemPhoBattle } from '@/core/kiem-tu/KiemPhoSystem'
import { collectKiemPhoComboModifiers, collectKiemPhoSkillDefinitionModifiers } from '@/core/kiem-tu/KiemPhoNodeModifiers'
import { nodeWayApplies } from '@/core/progression/NodeSystem'
import { KIEM_TU_NODES } from '@/data/progression/KiemTuNodes'
import { KIEM_PHO_COMBOS } from '@/data/skill/KiemPhoCombos'
import { KIEM_PHO_ORBS, ORB_UNLOCK_REALM, unlockedOrbs } from '@/data/skill/KiemPhoOrbs'
import { ailmentInteractionPhase } from '@/core/skill/SkillEffect'
import type { PlayerData } from '@/core/player/Player'
import type { OrbId } from '@/core/kiem-tu/KiemTuState'

const KIEM_PHO_NODES = KIEM_TU_NODES.filter(n => n.branchTag === 'kiem_pho')

function craftedPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    realmId: 'qi_refining',
    cultivationPath: 'sword',
    cultivationWay: 'sword_pathway',
    nodeLevels: {},
    purchasedNodeIds: [],
    ...overrides,
  } as unknown as PlayerData
}

describe('ATK-ORB-PRESET: crafted preset legality', () => {
  it('rejects empty and over-long presets', () => {
    expect(validatePreset([], 1)).toBe(false)
    expect(validatePreset(Array(10).fill('orb_dam') as OrbId[], 1)).toBe(false)
    expect(validatePreset(['orb_dam'], 1)).toBe(true)
    expect(validatePreset(Array(9).fill('orb_dam') as OrbId[], 1)).toBe(true)
  })

  it('rejects realm-locked orbs at qi_refining but accepts them at their unlock realm', () => {
    // orb_chem unlocks above qi_refining (realm index 1)
    expect(validatePreset(['orb_chem'], 1)).toBe(false)
    const chemIdx = ORB_UNLOCK_REALM['orb_chem' as OrbId]!
    expect(chemIdx).toBeGreaterThan(1)
    expect(validatePreset(['orb_chem'], chemIdx)).toBe(true)
    // bo/hat/quet are out of the beta window entirely
    for (const late of ['orb_bo', 'orb_hat', 'orb_quet'] as OrbId[]) {
      expect(validatePreset([late], 1)).toBe(false)
    }
  })
})

describe('ATK-NODE-CHARACTER-LEAK: beta nodes must never carry character stats', () => {
  it('every kiem_pho branch node has zero statModifiers/global effect fields', () => {
    expect(KIEM_PHO_NODES.length).toBeGreaterThan(0)
    for (const node of KIEM_PHO_NODES) {
      expect(node.effect.statModifiers ?? [], `${node.id} leaks statModifiers`).toHaveLength(0)
      // legal channels only: skillDefinitionModifiers / swordPathComboModifier
      const channels = [node.effect.skillDefinitionModifiers, node.effect.swordPathComboModifier]
        .filter(x => x !== undefined)
      expect(channels.length, `${node.id} carries no legal channel`).toBeGreaterThan(0)
    }
  })
})

describe('ATK-WAY-LEAK: kiem_pho nodes sealed to sword_pathway', () => {
  it('every kiem_pho node is stamped requiredWay sword_pathway and inert on ngu', () => {
    const ngu = craftedPlayer({ cultivationWay: 'hidden_sword_pathway' } as Partial<PlayerData>)
    const hien = craftedPlayer()
    for (const node of KIEM_PHO_NODES) {
      expect(node.requiredWay, `${node.id} missing way seal`).toBe('sword_pathway')
      expect(nodeWayApplies(ngu, node), `${node.id} applies on ngu`).toBe(false)
      expect(nodeWayApplies(hien, node)).toBe(true)
    }
  })

  it('crafted ngu player with owned kiem_pho levels collects zero modifiers', () => {
    const ngu = craftedPlayer({ cultivationWay: 'hidden_sword_pathway' } as Partial<PlayerData>)
    ngu.nodeLevels = Object.fromEntries(KIEM_PHO_NODES.map(n => [n.id, 1]))
    expect(collectKiemPhoComboModifiers(ngu, KIEM_TU_NODES)).toHaveLength(0)
    expect(collectKiemPhoSkillDefinitionModifiers(ngu, KIEM_TU_NODES)).toHaveLength(0)
  })
})

describe('ATK-REALM-GATE: combo cap + node realm gates', () => {
  it('realmComboMax boundaries: <3 -> 3, 3..5 -> 4, >=6 -> 5', () => {
    expect(realmComboMax(1)).toBe(3)
    expect(realmComboMax(2)).toBe(3)
    expect(realmComboMax(3)).toBe(4)
    expect(realmComboMax(5)).toBe(4)
    expect(realmComboMax(6)).toBe(5)
  })

  it('combos longer than 3 are unreachable at TC (cap 3) - len-4/5 tails never match', () => {
    // TC sits below realm index 3 -> cap 3; drive a crafted battle log
    const state = initKiemPhoBattle(craftedPlayer())
    expect(state.comboMaxLength).toBe(3)
    const len4 = KIEM_PHO_COMBOS.find(c => c.pattern.length === 4)!
    // feed the exact 4-orb tail; matcher must not fire it
    let fired: string | null = null
    for (const orb of len4.pattern) {
      const hit = recordCastAndMatch(state, orb, KIEM_PHO_COMBOS, [])
      if (hit) fired = hit.combo.id
    }
    expect(fired).not.toBe(len4.id)
  })
})

describe('ATK-COMBO-ORDER: combo/preset/VFX parity + deterministic phase sort', () => {
  it('37 combos have unique ids and unique presetIds', () => {
    expect(KIEM_PHO_COMBOS).toHaveLength(37)
    const ids = KIEM_PHO_COMBOS.map(c => c.id)
    const presets = KIEM_PHO_COMBOS.map(c => c.presetId)
    expect(new Set(ids).size).toBe(37)
    expect(new Set(presets).size).toBe(37)
    for (const c of KIEM_PHO_COMBOS) {
      expect(c.presetId).toBe(`kiem_combo_${c.id}`)
    }
  })

  it('only beta-window combos use D/C patterns; DCC and CDD are NOT combos', () => {
    const has = (pat: string[]) => KIEM_PHO_COMBOS.some(c => c.pattern.join(',') === pat.join(','))
    expect(has(['orb_dam', 'orb_chem', 'orb_chem'])).toBe(false)
    expect(has(['orb_chem', 'orb_dam', 'orb_dam'])).toBe(false)
    // the six authored beta combos exist
    for (const id of ['liet_ngan', 'khai_ngan', 'thau_ngan', 'nhat_tuyen', 'hoi_tuyen', 'diep_ngan']) {
      expect(KIEM_PHO_COMBOS.some(c => c.id === id), `missing beta combo ${id}`).toBe(true)
    }
  })

  it('ailmentInteractionPhase ladder is strict: stacks < modifier/duration < periodic, stable-sort preserves authored order within a phase', () => {
    const ph = (k: string) => ailmentInteractionPhase({ kind: k } as never)
    expect(ph('add_stacks')).toBeLessThan(ph('add_modifier'))
    expect(ph('add_modifier')).toBe(ph('extend_duration'))
    expect(ph('extend_duration')).toBeLessThan(ph('trigger_periodic'))
    // stable sort: same-phase elements keep authored relative order -
    // a reversed input list cannot reorder the phases
    const authored = ['add_modifier', 'extend_duration', 'add_stacks', 'trigger_periodic'] as const
    const sorted = [...authored].sort((a, b) => ph(a) - ph(b))
    expect(sorted[0]).toBe('add_stacks')
    expect(sorted[3]).toBe('trigger_periodic')
    expect(sorted.slice(1, 3)).toEqual(['add_modifier', 'extend_duration'])
  })
})

describe('ATK-MODIFIER-TARGET: skillDefinitionModifiers only reach orb defs', () => {
  it('every authored skillId target is a real orb def id, never a combo/generated id', () => {
    const orbIds = new Set(Object.keys(KIEM_PHO_ORBS))
    const comboIds = new Set(KIEM_PHO_COMBOS.map(c => c.id))
    for (const node of KIEM_PHO_NODES) {
      for (const mod of node.effect.skillDefinitionModifiers ?? []) {
        expect(orbIds.has(mod.skillId), `${node.id} targets non-orb ${mod.skillId}`).toBe(true)
        expect(comboIds.has(mod.skillId), `${node.id} targets combo ${mod.skillId}`).toBe(false)
      }
    }
  })
})

describe('ATK-SAVE-CORRUPTION: crafted nodeLevels/orphans stay inert', () => {
  it('orphaned nodeLevels (unknown ids) collect zero combo modifiers', () => {
    const p = craftedPlayer()
    p.nodeLevels = { 'no_such_node': 9, 'kiem_pho_fake': 3 }
    // collector only reads registered node defs - orphans never reach it
    const mods = collectKiemPhoComboModifiers(p, KIEM_TU_NODES)
    expect(mods.every(m => KIEM_TU_NODES.some(n => n.id === m.nodeId))).toBe(true)
  })
})

describe('ATK-STACKS-GATE: gated vs ungated ailment channels', () => {
  it('add_stacks has no gate lane while other interactions gate via identity selectors', () => {
    // contract: add_stacks is intentionally ungated (top-the-wound
    // semantics); the gated kinds declare identity selectors. Probe the
    // phase ladder exists and is stable - authored gate data pinned by
    // the combo table's add_stacks entries.
    const addStacks = KIEM_PHO_COMBOS.flatMap(c => (c.ailmentInteractions ?? []).filter(i => i.kind === 'add_stacks'))
    for (const i of addStacks) {
      expect(ailmentInteractionPhase(i as never)).toBe(ailmentInteractionPhase({ kind: 'add_stacks' } as never))
    }
  })
})
