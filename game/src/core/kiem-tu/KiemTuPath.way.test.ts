// Cultivation Path Framework — M6: Kiếm Tu way-normalisation contract
// tests. kiem_tu never had a hidden-variant path id — BOTH ways
// persist cultivationPath 'kiem_tu' and cultivationWay ('hien'|'ngu')
// is the sole discriminator (the retired kiemTu.mode field is gone).
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
  isKiemTuHien,
  isKiemTuNgu,
  KIEM_TU_HIEN_WAY,
  KIEM_TU_NGU_WAY,
} from './KiemTuPath'

const NODE_REGISTRY = { getAll: () => KIEM_TU_NODES }

function nodeById(id: string) {
  const node = KIEM_TU_NODES.find((candidate) => candidate.id === id)
  expect(node, `node ${id} registered`).toBeDefined()
  return node!
}

function kiemTuPlayer(way: 'hien' | 'ngu'): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'kiem_tu'
  player.cultivationWay = way
  player.realmId = 'qi_refining'
  player.skillInsight = 99
  player.kiemTu = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }
  return player
}

describe('Kiếm Tu way predicates — strict pair doctrine', () => {
  it.each([
    [{ cultivationPath: 'kiem_tu', cultivationWay: 'hien' }, true],
    [{ cultivationPath: 'kiem_tu', cultivationWay: 'ngu' }, false],
    // kiem_tu has exactly one persisted era — but the WAY field is
    // still authoritative: a way-less kiem player is not hien.
    [{ cultivationPath: 'kiem_tu' }, false],
    [{ cultivationPath: 'the_tu', cultivationWay: 'hien' }, false],
    [{ cultivationPath: 'phap_tu', cultivationWay: 'hien' }, false],
    [{}, false],
    [undefined, false],
    [null, false],
  ])('isKiemTuHien(%o) → %s', (slice, expected) => {
    expect(isKiemTuHien(slice as PlayerData | undefined | null)).toBe(expected)
  })

  it.each([
    [{ cultivationPath: 'kiem_tu', cultivationWay: 'ngu' }, true],
    [{ cultivationPath: 'kiem_tu', cultivationWay: 'hien' }, false],
    [{ cultivationPath: 'kiem_tu' }, false],
    // Cross-path way bleed: 'ngu' exists only under kiem_tu, but a
    // corrupt foreign pair must still fail closed.
    [{ cultivationPath: 'the_tu', cultivationWay: 'ngu' }, false],
    [{ cultivationPath: 'phap_tu_an', cultivationWay: 'ngu' }, false],
    [{}, false],
    [undefined, false],
    [null, false],
  ])('isKiemTuNgu(%o) → %s', (slice, expected) => {
    expect(isKiemTuNgu(slice as PlayerData | undefined | null)).toBe(expected)
  })

  it('corrupt pairs fail closed on BOTH predicates', () => {
    for (const pair of [
      { cultivationPath: 'kiem_tu', cultivationWay: 'ung_the' },
      { cultivationPath: 'kiem_tu', cultivationWay: 'ngo_dao' },
      { cultivationPath: 'the_tu', cultivationWay: 'ngu' },
    ] as const) {
      expect(isKiemTuHien(pair as PlayerData)).toBe(false)
      expect(isKiemTuNgu(pair as PlayerData)).toBe(false)
    }
  })
})

describe('Kiếm Tu way definitions', () => {
  it('hien way: ngu_kiem technique, no gate, no skillIds (orb preset supplies basics)', () => {
    expect(KIEM_TU_HIEN_WAY.id).toBe('hien')
    expect(KIEM_TU_HIEN_WAY.pathId).toBe('kiem_tu')
    expect(KIEM_TU_HIEN_WAY.techniqueId).toBe('ngu_kiem')
    expect(KIEM_TU_HIEN_WAY.offerGate).toBeUndefined()
    expect(KIEM_TU_HIEN_WAY.skillIds).toBeUndefined()
  })

  it('ngu way: van_kiem_quyet technique + tram Lv3 offerGate (port of the retired flip-node prereq)', () => {
    expect(KIEM_TU_NGU_WAY.id).toBe('ngu')
    expect(KIEM_TU_NGU_WAY.pathId).toBe('kiem_tu')
    expect(KIEM_TU_NGU_WAY.techniqueId).toBe('van_kiem_quyet')
    expect(KIEM_TU_NGU_WAY.offerGate).toEqual({
      requiresSkillLevel: { skillId: 'tram', level: 3 },
    })
    expect(KIEM_TU_NGU_WAY.skillIds).toBeUndefined()
  })
})

describe('node stamps — requiredCultivationPath + requiredWay', () => {
  it('every kiem node is stamped on the kiem_tu path with a way', () => {
    for (const node of KIEM_TU_NODES) {
      expect(node.requiredCultivationPath, node.id).toBe('kiem_tu')
      expect(node.requiredWay, node.id).toMatch(/^(hien|ngu)$/)
    }
  })

  it('orb-branch nodes are hien; ngu_kiem-tag nodes are ngu', () => {
    for (const node of KIEM_TU_NODES) {
      if (node.branchTag === 'kiem_pho') {
        expect(node.requiredWay, node.id).toBe('hien')
      } else if (node.branchTag === 'ngu_kiem') {
        expect(node.requiredWay, node.id).toBe('ngu')
      }
    }
  })

  it('the retired flip node + mode machinery are gone', () => {
    expect(KIEM_TU_NODES.some((node) => node.id === 'kiem_tu_an')).toBe(false)
    expect(
      KIEM_TU_NODES.some((node) => 'kiemTuModeSwitch' in node.effect),
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
    const hien = kiemTuPlayer('hien')
    expect(purchaseNode(hien, nodeById('orb_dam_1'))).toBe(true)
    expect(purchaseNode(hien, nodeById('ngu_kiem_sac'))).toBe(false)

    const ngu = kiemTuPlayer('ngu')
    expect(purchaseNode(ngu, nodeById('ngu_kiem_sac'))).toBe(true)
    expect(purchaseNode(ngu, nodeById('orb_dam_1'))).toBe(false)
  })

  it('cross-path way bleed: a the_tu/hien player cannot buy kiem orb nodes', () => {
    const theTu = createDefaultPlayer()
    theTu.cultivationPath = 'the_tu'
    theTu.cultivationWay = 'hien' // same way id, different path — path stamp must hold
    theTu.realmId = 'qi_refining'
    theTu.skillInsight = 99

    expect(purchaseNode(theTu, nodeById('orb_dam_1'))).toBe(false)
  })

  it('aggregateNodeStatModifiers ignores cross-way levels both directions', () => {
    const hien = kiemTuPlayer('hien')
    hien.nodeLevels = { ngu_kiem_sac: 3 }
    expect(aggregateNodeStatModifiers(NODE_REGISTRY, hien)).toEqual([])

    const ngu = kiemTuPlayer('ngu')
    ngu.nodeLevels = { orb_dam_1: 3 }
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
    expect(collectActiveWayStatModifiers(kiemTuPlayer('hien'), TOT10)).toEqual([])
    expect(collectActiveWayStatModifiers(kiemTuPlayer('ngu'), TOT10)).toEqual([])
  })

  it('both kiem ways resolve the kiem_tu stat domain', () => {
    expect(resolveActiveWayStatDomains(kiemTuPlayer('hien'))).toEqual(['kiem_tu'])
    expect(resolveActiveWayStatDomains(kiemTuPlayer('ngu'))).toEqual(['kiem_tu'])
  })

  it('getActiveWayDefinition resolves the persisted pair; a way-less kiem save derives hien', () => {
    expect(getActiveWayDefinition(kiemTuPlayer('ngu'))?.id).toBe('ngu')
    expect(getActiveWayDefinition(kiemTuPlayer('hien'))?.id).toBe('hien')

    const wayLess = kiemTuPlayer('hien')
    delete wayLess.cultivationWay
    // LEGACY_PATH_TO_WAY['kiem_tu'] -> hien: lenient read fallback.
    expect(getActiveWayDefinition(wayLess)?.id).toBe('hien')
    expect(getActiveWay(wayLess)).toBe('hien')
  })
})

describe('ngu economy — way-gated writes', () => {
  it('gainKiemY/grantKiemDao are no-ops off the ngu way', () => {
    const hien = kiemTuPlayer('hien')
    gainKiemY(hien, 50_000)
    grantKiemDao(hien, 5)
    expect(hien.kiemTu!.kiemY).toBe(0)
    expect(hien.kiemTu!.kiemDaoCount).toBe(1)

    const mortal = createDefaultPlayer()
    mortal.kiemTu = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }
    gainKiemY(mortal, 50_000)
    grantKiemDao(mortal, 5)
    expect(mortal.kiemTu.kiemY).toBe(0)
    expect(mortal.kiemTu.kiemDaoCount).toBe(1)
  })

  it('ngu player banks Kiem Y toward the realm forgeCost', () => {
    const ngu = kiemTuPlayer('ngu')
    gainKiemY(ngu, 100)
    expect(ngu.kiemTu!.kiemY).toBe(100)
  })
})
