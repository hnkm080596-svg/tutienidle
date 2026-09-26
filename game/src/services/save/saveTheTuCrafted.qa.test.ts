import { describe, expect, it } from 'vitest'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import { collectBodyKitModifiers } from '../../core/the-tu/TheTuKitModifiers'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { resolveCultivationPathRuntime } from '../../core/player/CultivationPathRegistry'
import type { CultivationPathRuntimeDeps } from '../../core/player/CultivationPathRuntime'
import { getNodeLevel } from '../../core/progression/NodeSystem'
import type { Technique } from '../../core/technique/Technique'

// QA ROUND B (integration/adversarial) — crafted-save probes against the
// the-tu beta tree. The save boundary already audits node canonicality
// (D9d/D9f grant<->core coherence, core level caps, mirror membership).
// These tests pin the INVARIANTS a crafted payload could violate that the
// boundary does not currently replay: the excludesNode root mutex, node
// prerequisite chains, and non-core level caps.
//
// Each `expected` assertion encodes the house contract ("a state no legal
// path can produce" must reject). A failing test here is defect evidence.

function craftedPlayer(nodeLevels: Record<string, number>): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 1
  player.cultivationPath = 'body'
  player.cultivationWay = 'body_pathway'
  player.nodeLevels = nodeLevels
  player.purchasedNodeIds = Object.keys(nodeLevels)
  return player
}

function craftedSave(player: PlayerData): Record<string, unknown> {
  const technique: Technique = {
    id: 'diamond_body_art',
    name: 'Diamond Body Art',
    description: 'way technique',
    grade: 1,
    rank: 0,
    mastery: 0,
    quality: 'hoang',
    gradeHistory: {},
  }
  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [technique],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

describe('crafted v85 save — the-tu node canonicality (QA round B)', () => {
  it('rejects a save owning BOTH mutex roots (cuong_chien + tran_the)', () => {
    const save = craftedSave(
      craftedPlayer({
        cuong_chien: 1,
        tran_the: 1,
        core_cuong_quyen: 1,
        core_tran_ap: 1,
      }),
    )
    // The load path runs validateGameSaveShape before isSaveAcceptable
    // (SaveSystem ~:729-740), so a shape rejection already blocks the
    // save end-to-end. isSaveAcceptable itself is a registry-reference
    // gate, not a canonicality replay -- it is asserted separately only
    // where its own scope applies.
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('rejects a non-core node leveled past its authored maxLevel', () => {
    const save = craftedSave(
      craftedPlayer({ cuong_chien: 1, minor_trong_quyen: 99, core_cuong_quyen: 1 }),
    )
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('rejects a keystone owned without its node/realm/techniqueRank prerequisites', () => {
    // qi_refining realm + no cuong_chien + techniqueRank 0: major_loan_dau
    // is purchase-impossible, yet the grant coherence only checks
    // owned-node -> granted-core, so this passes today.
    const save = craftedSave(
      craftedPlayer({ major_loan_dau: 1, core_loan_dau: 1 }),
    )
    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

describe('downstream resolution of a both-roots save (documentation, actual behavior)', () => {
  const deps: CultivationPathRuntimeDeps = {
    skillManager: { get: () => undefined, has: () => false },
    skillSystem: { getEffectiveSkill: () => ({}) as never },
    skillTemplates: { get: () => undefined },
    nodeRegistry: { getAll: () => THE_TU_NODES },
    getNodeLevel: (nodeId, player) => getNodeLevel(player, nodeId),
    getSpellPathElement: () => undefined,
    routeProfileProvider: () => ({}) as never,
  }

  it('resolveBodyKit silently prefers cuong_chien when both roots are owned', () => {
    const player = craftedPlayer({
      cuong_chien: 1,
      tran_the: 1,
      core_cuong_quyen: 1,
      core_tran_ap: 1,
      major_loan_dau: 1,
      core_loan_dau: 1,
      major_phan_chan: 1,
      core_phan_chan: 1,
    })
    const runtime = resolveCultivationPathRuntime(player, deps)
    // cuong kit wins by first-check order; tran kit + phan_chan suppressed.
    expect(runtime.resolveBasic(player)?.id).toBe('cuong_quyen')
    expect(runtime.resolveSpecialUltimate(player)?.special?.id).toBe('loan_dau')
  })

  it('over-leveled non-core nodes aggregate unbounded (minor_trong_quyen:99 -> +9.9)', () => {
    const player = craftedPlayer({
      cuong_chien: 1,
      minor_trong_quyen: 99,
      core_cuong_quyen: 1,
    })
    const mods = collectBodyKitModifiers({ getAll: () => THE_TU_NODES }, player)
    expect(mods.cuongQuyenCoefficientBonus).toBeCloseTo(9.9)
  })
})
