// Cultivation Path Framework — M6: Kiếm Tu way-normalisation contract
// tests. sword never had a hidden-variant path id — BOTH ways
// persist cultivationPath 'sword' and cultivationWay ('sword_pathway'|'hidden_sword_pathway')
// is the sole discriminator (the retired swordPath.mode field is gone).
// Every kiem way-specific gate (Kiem Pho preset/provider, the Ngu Kiem
// Dao economy + provider, the node subtrees) resolves on the WAY.
//
// Mirrors core/the-tu/TheTuPath.way.test.ts: strict-pair doctrine,
// fail-closed on corrupt (path, way) pairs, node stamp audit.

import { describe, expect, it } from 'vitest'

import type { PlayerData } from '../player/Player'
import { createDefaultPlayer } from '../player/Player'
import {
  collectActiveWayStatModifiers,
  resolveActiveWayStatDomains,
  getActiveWay,
} from '../player/CultivationPathSystem'
import { getActiveWayDefinition } from '../player/CultivationPathKit'
import {
  aggregateNodeStatModifiers,
  purchaseNode,
} from '../progression/NodeSystem'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { gainKiemY, grantKiemDao } from './NguKiemDao'
import {
  isSwordPathway,
  isHiddenSwordPathway,
  SWORD_PATHWAY,
  HIDDEN_SWORD_PATHWAY,
} from './KiemTuPath'

const NODE_REGISTRY = { getAll: () => KIEM_TU_NODES }

function nodeById(id: string) {
  const node = KIEM_TU_NODES.find((candidate) => candidate.id === id)
  expect(node, `node ${id} registered`).toBeDefined()
  return node!
}

function swordPathPlayer(way: 'sword_pathway' | 'hidden_sword_pathway'): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'sword'
  player.cultivationWay = way
  player.realmId = 'qi_refining'
  player.skillInsight = 99
  player.swordPath = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }
  return player
}

describe('Kiếm Tu way predicates — strict pair doctrine', () => {
  it.each([
    [{ cultivationPath: 'sword', cultivationWay: 'sword_pathway' }, true],
    [{ cultivationPath: 'sword', cultivationWay: 'hidden_sword_pathway' }, false],
    // sword has exactly one persisted era — but the WAY field is
    // still authoritative: a way-less kiem player is not hien.
    [{ cultivationPath: 'sword' }, false],
    [{ cultivationPath: 'body', cultivationWay: 'sword_pathway' }, false],
    [{ cultivationPath: 'spell', cultivationWay: 'sword_pathway' }, false],
    [{}, false],
    [undefined, false],
    [null, false],
  ])('isSwordPathway(%o) → %s', (slice, expected) => {
    expect(isSwordPathway(slice as PlayerData | undefined | null)).toBe(expected)
  })

  it.each([
    [{ cultivationPath: 'sword', cultivationWay: 'hidden_sword_pathway' }, true],
    [{ cultivationPath: 'sword', cultivationWay: 'sword_pathway' }, false],
    [{ cultivationPath: 'sword' }, false],
    // Cross-path way bleed: 'hidden_sword_pathway' exists only under sword, but a
    // corrupt foreign pair must still fail closed.
    [{ cultivationPath: 'body', cultivationWay: 'hidden_sword_pathway' }, false],
    [{ cultivationPath: 'phap_tu_an', cultivationWay: 'hidden_sword_pathway' }, false],
    [{}, false],
    [undefined, false],
    [null, false],
  ])('isHiddenSwordPathway(%o) → %s', (slice, expected) => {
    expect(isHiddenSwordPathway(slice as PlayerData | undefined | null)).toBe(expected)
  })

  it('corrupt pairs fail closed on BOTH predicates', () => {
    for (const pair of [
      { cultivationPath: 'sword', cultivationWay: 'hidden_body_pathway' },
      { cultivationPath: 'sword', cultivationWay: 'hidden_spell_pathway' },
      { cultivationPath: 'body', cultivationWay: 'hidden_sword_pathway' },
    ] as const) {
      expect(isSwordPathway(pair as PlayerData)).toBe(false)
      expect(isHiddenSwordPathway(pair as PlayerData)).toBe(false)
    }
  })
})

describe('Kiếm Tu way definitions', () => {
  it('hien way: ngu_kiem technique, no gate, no skillIds (orb preset supplies basics)', () => {
    expect(SWORD_PATHWAY.id).toBe('sword_pathway')
    expect(SWORD_PATHWAY.pathId).toBe('sword')
    expect(SWORD_PATHWAY.techniqueId).toBe('sword_control_art')
    expect(SWORD_PATHWAY.offerGate).toBeUndefined()
    expect(SWORD_PATHWAY.skillIds).toBeUndefined()
  })

  it('ngu way: van_kiem_quyet technique + tram Lv3 offerGate (port of the retired flip-node prereq)', () => {
    expect(HIDDEN_SWORD_PATHWAY.id).toBe('hidden_sword_pathway')
    expect(HIDDEN_SWORD_PATHWAY.pathId).toBe('sword')
    expect(HIDDEN_SWORD_PATHWAY.techniqueId).toBe('myriad_swords_art')
    expect(HIDDEN_SWORD_PATHWAY.offerGate).toEqual({
      requiresSkillLevel: { skillId: 'tram', level: 3 },
    })
    expect(HIDDEN_SWORD_PATHWAY.skillIds).toBeUndefined()
  })
})

describe('node stamps — requiredCultivationPath + requiredWay', () => {
  it('every kiem node is stamped on the sword path with a way', () => {
    for (const node of KIEM_TU_NODES) {
      expect(node.requiredCultivationPath, node.id).toBe('sword')
      expect(node.requiredWay, node.id).toMatch(/^(sword_pathway|hidden_sword_pathway)$/)
    }
  })

  it('orb-branch nodes are hien; ngu_kiem-tag nodes are ngu', () => {
    for (const node of KIEM_TU_NODES) {
      if (node.branchTag === 'kiem_pho') {
        expect(node.requiredWay, node.id).toBe('sword_pathway')
      } else if (node.branchTag === 'ngu_kiem') {
        expect(node.requiredWay, node.id).toBe('hidden_sword_pathway')
      }
    }
  })

  it('the retired flip node + mode machinery are gone', () => {
    expect(KIEM_TU_NODES.some((node) => node.id === 'kiem_tu_an')).toBe(false)
    expect(
      KIEM_TU_NODES.some((node) => 'swordPathModeSwitch' in node.effect),
    ).toBe(false)
    // No node prereq may point at the retired id.
    for (const node of KIEM_TU_NODES) {
      for (const prereq of node.prerequisites ?? []) {
        expect(
          prereq.kind === 'node' && prereq.nodeId === 'kiem_tu_an',
          `${node.id} prereqs on kiem_tu_an`,
        ).toBe(false)
      }
    }
  })

  it('hien player buys orb nodes but not ngu nodes; ngu player buys ngu nodes but not orb nodes', () => {
    const hien = swordPathPlayer('sword_pathway')
    expect(purchaseNode(hien, nodeById('thich_can'))).toBe(true)
    expect(purchaseNode(hien, nodeById('ngu_kiem_sac'))).toBe(false)

    const ngu = swordPathPlayer('hidden_sword_pathway')
    expect(purchaseNode(ngu, nodeById('ngu_kiem_sac'))).toBe(true)
    expect(purchaseNode(ngu, nodeById('thich_can'))).toBe(false)
  })

  it('cross-path way bleed: a body/hien player cannot buy kiem orb nodes', () => {
    const body = createDefaultPlayer()
    body.cultivationPath = 'body'
    body.cultivationWay = 'sword_pathway' // same way id, different path — path stamp must hold
    body.realmId = 'qi_refining'
    body.skillInsight = 99

    expect(purchaseNode(body, nodeById('thich_can'))).toBe(false)
  })

  it('aggregateNodeStatModifiers ignores cross-way levels both directions', () => {
    const hien = swordPathPlayer('sword_pathway')
    hien.nodeLevels = { ngu_kiem_sac: 3 }
    expect(aggregateNodeStatModifiers(NODE_REGISTRY, hien)).toEqual([])

    const ngu = swordPathPlayer('hidden_sword_pathway')
    ngu.nodeLevels = { thich_can: 3 }
    expect(aggregateNodeStatModifiers(NODE_REGISTRY, ngu)).toEqual([])
  })
})

describe('way-resolved stat/domain channels', () => {
  const TOT10 = {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    attunement: 0,
    vitality: 10,
  }

  it('kiem ways have no stat facet — collectActiveWayStatModifiers emits nothing', () => {
    expect(collectActiveWayStatModifiers(swordPathPlayer('sword_pathway'), TOT10)).toEqual([])
    expect(collectActiveWayStatModifiers(swordPathPlayer('hidden_sword_pathway'), TOT10)).toEqual([])
  })

  it('both kiem ways resolve the sword stat domain', () => {
    expect(resolveActiveWayStatDomains(swordPathPlayer('sword_pathway'))).toEqual(['sword'])
    expect(resolveActiveWayStatDomains(swordPathPlayer('hidden_sword_pathway'))).toEqual(['sword'])
  })

  it('getActiveWayDefinition resolves the persisted pair; a way-less kiem save fails closed (M7)', () => {
    expect(getActiveWayDefinition(swordPathPlayer('hidden_sword_pathway'))?.id).toBe('hidden_sword_pathway')
    expect(getActiveWayDefinition(swordPathPlayer('sword_pathway'))?.id).toBe('sword_pathway')

    const wayLess = swordPathPlayer('sword_pathway')
    delete wayLess.cultivationWay
    // M7: the LEGACY_PATH_TO_WAY lenient fallback is gone — a persisted
    // path without a way resolves nothing instead of guessing hien.
    expect(getActiveWayDefinition(wayLess)).toBeUndefined()
    expect(getActiveWay(wayLess)).toBeUndefined()
  })
})

describe('ngu economy — way-gated writes', () => {
  it('gainKiemY/grantKiemDao are no-ops off the ngu way', () => {
    const hien = swordPathPlayer('sword_pathway')
    gainKiemY(hien, 50_000)
    grantKiemDao(hien, 5)
    expect(hien.swordPath!.kiemY).toBe(0)
    expect(hien.swordPath!.kiemDaoCount).toBe(1)

    const mortal = createDefaultPlayer()
    mortal.swordPath = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }
    gainKiemY(mortal, 50_000)
    grantKiemDao(mortal, 5)
    expect(mortal.swordPath.kiemY).toBe(0)
    expect(mortal.swordPath.kiemDaoCount).toBe(1)
  })

  it('ngu player banks Kiem Y toward the realm forgeCost', () => {
    const ngu = swordPathPlayer('hidden_sword_pathway')
    gainKiemY(ngu, 100)
    expect(ngu.swordPath!.kiemY).toBe(100)
  })
})
