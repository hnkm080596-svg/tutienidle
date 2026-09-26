import { describe, expect, it } from 'vitest'
import { THE_TU_AN_NODES } from './TheTuAnNodes'
import { NodeRegistry } from '../../core/progression/NodeRegistry'
import { getNodeLevel, purchaseNode, upgradeNode } from '../../core/progression/NodeSystem'
import { createDefaultPlayer } from '../../core/player/Player'
import { collectHiddenBodyMechanicModifiers } from '../../core/the-tu/TheTuAnMechanicModifiers'
import { buildTheTuAnKit, PHAN_KICH, QUAN_THE } from '../skill/TheTuSkills'
import { THE_PROC_COST } from '../../core/the-tu/TheEconomy'
import type { TheEconomyPayload } from '../../core/the-tu/TheTuCapabilities'
import type { ReactiveProcPayload } from '../../core/proc/ProcCapabilities'
import type { BuffDefinition } from '../../core/buff2/BuffDefinition'
import type { StatType } from '../../core/stats/StatTypes'

// Ung The beta - kit clones bake node modifiers into capability payloads
// (the retired effects[] channel). These helpers read the typed payloads
// straight off the clone defs.
function procPayloads(def: BuffDefinition): ReactiveProcPayload[] {
  return (def.capabilities ?? [])
    .filter((capability) => capability.type === 'reactive_proc')
    .map((capability) => capability.payload as ReactiveProcPayload)
}

function economyPayload(def: BuffDefinition): TheEconomyPayload | undefined {
  const grant = (def.capabilities ?? []).find((capability) => capability.type === 'the_economy')
  return grant?.payload as TheEconomyPayload | undefined
}

// Ung The beta tree (design Part XIII): 6 nodes - LQ minors Thau The +
// Phan Kinh behind tham_the; Truc Co major_quan_the grants the quan_the
// core; ho_bi / trong_phan / dan_the gate on it. The design forbids
// tree content touching chances, main stats, debt, proc cost, or free
// reactions.

function playerWith(overrides: Partial<ReturnType<typeof createDefaultPlayer>> = {}) {
  return { ...createDefaultPlayer(), skillInsight: 99, ...overrides }
}

function registryWithNodes() {
  const registry = new NodeRegistry()
  for (const node of THE_TU_AN_NODES) {
    registry.register(node)
  }
  return registry
}

function node(id: string) {
  const found = THE_TU_AN_NODES.find((candidate) => candidate.id === id)
  expect(found, `node '${id}' exists`).toBeDefined()
  return found!
}

function buy(player: ReturnType<typeof playerWith>, _registry: NodeRegistry, id: string, levels = 1) {
  const target = node(id)
  if (getNodeLevel(player, id) === 0) {
    purchaseNode(player, target)
  }
  while (getNodeLevel(player, id) < levels) {
    if (!upgradeNode(player, target)) break
  }
}

describe('the_tu_an node tree (Ung The beta)', () => {
  it('ships exactly the six beta nodes', () => {
    expect(THE_TU_AN_NODES.map((candidate) => candidate.id).sort()).toEqual([
      'major_dan_the',
      'major_ho_bi',
      'major_quan_the',
      'major_trong_phan',
      'minor_phan_kinh',
      'minor_thau_the',
    ])
  })

  it('LQ minors gate on qi_refining; Quan The + its majors gate on foundation_establishment', () => {
    for (const id of ['minor_thau_the', 'minor_phan_kinh']) {
      expect(node(id).prerequisites?.some((p) => p.kind === 'realm' && p.realmId === 'qi_refining')).toBe(true)
    }
    expect(
      node('major_quan_the').prerequisites?.some(
        (p) => p.kind === 'realm' && p.realmId === 'foundation_establishment',
      ),
    ).toBe(true)
    for (const id of ['major_ho_bi', 'major_trong_phan', 'major_dan_the']) {
      expect(node(id).prerequisites?.some((p) => p.kind === 'node' && p.nodeId === 'major_quan_the')).toBe(true)
    }
  })

  it('every node is hidden_body_pathway gated; no node authors a chance/stat modifier', () => {
    const banned: StatType[] = ['counterChance', 'protectChance', 'followUpChance', 'evasionRate']
    for (const candidate of THE_TU_AN_NODES) {
      expect(candidate.requiredWay).toBe('hidden_body_pathway')
      for (const modifier of candidate.effect.statModifiers ?? []) {
        expect(banned.includes(modifier.stat), `${candidate.id} grants ${modifier.stat}`).toBe(false)
      }
      // No main-stat channels at all on this tree.
      expect(candidate.effect.statModifiers ?? []).toEqual([])
    }
  })

  it('major_quan_the grants the quan_the skill core (techniqueRank-gated)', () => {
    const grant = node('major_quan_the')
    expect(grant.effect.grantsSkillCoreIds).toEqual(['quan_the'])
    expect(grant.prerequisites?.some((p) => p.kind === 'techniqueRank')).toBe(true)
  })
})

describe('collectHiddenBodyMechanicModifiers', () => {
  it('sums per-level channels across owned nodes; unowned contribute nothing', () => {
    const registry = registryWithNodes()
    const player = playerWith({
      realmId: 'qi_refining',
      cultivationPath: 'body',
      cultivationWay: 'hidden_body_pathway',
    })

    expect(collectHiddenBodyMechanicModifiers(registry, player).observationGainBonus).toBe(0)

    buy(player, registry, 'minor_thau_the', 3)
    const mods = collectHiddenBodyMechanicModifiers(registry, player)
    expect(mods.observationGainBonus).toBe(6)
    expect(mods.phanKinhArmorPierce).toBe(0)
  })
})

describe('buildTheTuAnKit modifier baking (participant-local clones)', () => {
  const fullMods = {
    observationGainBonus: 2,
    phanKinhArmorPierce: 0.15,
    interceptWardRatio: 0.15,
    evadeCounterMultiplierBonus: 0.6,
    danTheBonus: 1,
  }
  const quanTheOwned = { quanThe: true, quanTheCoreLevel: 1 }

  it('baseline kit: only Tham The basic + ung_the/phan_mon markers, phan_kich payload', () => {
    const kit = buildTheTuAnKit()
    expect(kit.basic.id).toBe('tham_the')
    expect(kit.special).toBeUndefined()
    expect(kit.ultimate).toBeUndefined()
    expect(Object.keys(kit.reactivePayloads)).toEqual(['phan_kich'])
    expect(kit.basic.grantsBuffsAtBuild!.map((def) => def.id)).toEqual(['ung_the', 'phan_mon'])
  })

  it('owned Quan The adds the special + ho_mon/tro_mon markers + tro_kich payload', () => {
    const kit = buildTheTuAnKit(undefined, quanTheOwned)
    expect(kit.special?.id).toBe('quan_the')
    expect(kit.basic.grantsBuffsAtBuild!.map((def) => def.id)).toEqual([
      'ung_the',
      'phan_mon',
      'ho_mon',
      'tro_mon',
    ])
    expect(Object.keys(kit.reactivePayloads).sort()).toEqual(['phan_kich', 'tro_kich'])
  })

  it('Quan The core level scales ONLY theGainOnLandedCast', () => {
    const level1 = buildTheTuAnKit(undefined, { quanThe: true, quanTheCoreLevel: 1 })
    const level5 = buildTheTuAnKit(undefined, { quanThe: true, quanTheCoreLevel: 5 })
    expect(level1.special?.theGainOnLandedCast).toBe(25)
    expect(level5.special?.theGainOnLandedCast).toBe(65)
    expect(level5.special?.appliesBuffs).toEqual(QUAN_THE.appliesBuffs)
    expect(level5.special?.cooldownTurns).toBe(QUAN_THE.cooldownTurns)
  })

  it('bakes Thau The onto the ung_the marker observation income', () => {
    const kit = buildTheTuAnKit(fullMods)
    const ungThe = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'ung_the')!
    expect(economyPayload(ungThe)).toMatchObject({
      gainOnBasicHit: 4,
      gainOnObservedAction: 6,
    })
  })

  it('no marker carries a cost override — the flat THE_PROC_COST fallback is the only authority', () => {
    const kit = buildTheTuAnKit(fullMods, quanTheOwned)
    const markers = Object.fromEntries(
      kit.basic.grantsBuffsAtBuild!.map((def) => [def.id, def]),
    )
    for (const id of ['ho_mon', 'phan_mon', 'tro_mon']) {
      for (const effect of procPayloads(markers[id]!)) {
        // CombatProcSystem resolves `theCost ?? THE_PROC_COST` — absence
        // of the field IS the invariant (no cost nodes exist to bake).
        expect(effect.theCost).toBeUndefined()
      }
    }
    expect(THE_PROC_COST).toBe(15)
  })

  it('bakes the intercept-ward rider onto the ho_mon marker (Ho Bich)', () => {
    const kit = buildTheTuAnKit({ ...fullMods, danTheBonus: 0 }, quanTheOwned)
    const marker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'ho_mon')!
    const effect = procPayloads(marker)[0]!
    expect(effect.grantsWardToOriginalTarget).toEqual({ buffDefinitionId: 'ho_ve', sourceMaxHpRatio: 0.15 })
  })

  it('bakes the evade-context heavy counter: onEvade swaps to trong_phan_kich payload clone', () => {
    const kit = buildTheTuAnKit(fullMods)
    const marker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'phan_mon')!
    const evadeEffect = procPayloads(marker).find((candidate) => candidate.trigger === 'onEvade')!
    expect(evadeEffect.queuedAction?.payloadSkillId).toBe('trong_phan_kich')

    const takenEffect = procPayloads(marker).find((candidate) => candidate.trigger === 'onImpactLanded')!
    expect(takenEffect.queuedAction?.payloadSkillId).toBe('phan_kich')

    const heavy = kit.reactivePayloads['trong_phan_kich']
    expect(heavy?.damage?.multiplier).toBeCloseTo((PHAN_KICH.damage?.multiplier ?? 0) + 0.6)
  })

  it('bakes Phan Kinh armorPierce onto the counter payload clones', () => {
    const kit = buildTheTuAnKit({ ...fullMods, evadeCounterMultiplierBonus: 0 }, quanTheOwned)
    const payload = kit.reactivePayloads['phan_kich']
    expect(payload?.instances?.each?.armorPierce).toEqual({ bypassChance: 0, pierceFraction: 0.15 })
    // Trong Phan Kich only exists when the evade bonus node is owned.
    expect(kit.reactivePayloads['trong_phan_kich']).toBeUndefined()
  })

  it('bakes Dan The: the tro_kich clone applies the one-shot mark on landed', () => {
    const kit = buildTheTuAnKit(fullMods, quanTheOwned)
    expect(kit.reactivePayloads['tro_kich']?.appliesAilments).toContainEqual({
      buffDefinitionId: 'dan_the',
      chance: 1,
    })
  })

  it('zero mods keep authored base values — no phantom riders', () => {
    const zero = {
      observationGainBonus: 0,
      phanKinhArmorPierce: 0,
      interceptWardRatio: 0,
      evadeCounterMultiplierBonus: 0,
      danTheBonus: 0,
    }
    const kit = buildTheTuAnKit(zero, quanTheOwned)

    const hoMarker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'ho_mon')!
    expect(procPayloads(hoMarker)[0]!.grantsWardToOriginalTarget).toBeUndefined()

    const phanMarker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'phan_mon')!
    const evadeEffect = procPayloads(phanMarker).find((candidate) => candidate.trigger === 'onEvade')
    expect(evadeEffect?.queuedAction?.payloadSkillId).toBe('phan_kich')
    expect(kit.reactivePayloads['trong_phan_kich']).toBeUndefined()
    expect(kit.reactivePayloads['phan_kich']?.instances).toBeUndefined()
    expect(kit.reactivePayloads['tro_kich']?.appliesAilments).toBeUndefined()
  })
})
