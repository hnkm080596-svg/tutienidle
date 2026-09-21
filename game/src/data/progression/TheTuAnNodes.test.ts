import { describe, expect, it } from 'vitest'
import { THE_TU_AN_NODES } from './TheTuAnNodes'
import { NodeRegistry } from '../../core/progression/NodeRegistry'
import { getNodeLevel, purchaseNode, upgradeNode } from '../../core/progression/NodeSystem'
import { createDefaultPlayer } from '../../core/player/Player'
import { collectHiddenBodyMechanicModifiers } from '../../core/the-tu/TheTuAnMechanicModifiers'
import { buildTheTuAnKit, PHAN_KICH } from '../skill/TheTuSkills'
import { MAX_THE } from '../../core/combat/CombatTypes'
import { THE_PROC_COST, THE_PROC_GAIN } from '../../core/the-tu/TheEconomy'
import type { TheEconomyPayload } from '../../core/the-tu/TheTuCapabilities'
import type { ReactiveProcPayload } from '../../core/proc/ProcCapabilities'
import type { BuffDefinition } from '../../core/buff2/BuffDefinition'
import type { StatType } from '../../core/stats/StatTypes'

// buff2 M4 — kit clones bake node modifiers into capability payloads
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

// The Tu Reimagined (plan Task 20, spec section 8.2) — the_tu_an tree
// data: non-mutex roots (T9), trunk economy nodes feeding
// collectHiddenBodyMechanicModifiers (review P1.7 — the ONE locked
// channel), realm gates, INV-13 authoring ban on chance stats.

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

describe('the_tu_an node tree (spec 8.2)', () => {
  it('ships the three non-mutex roots ho_mon/phan_mon/tro_mon at qi_refining', () => {
    for (const rootId of ['ho_mon', 'phan_mon', 'tro_mon']) {
      const root = node(rootId)
      expect(root.role).toBe('root')
      expect(root.branchTag).toBe('the_tu_an')
      expect(root.prerequisites?.some((p) => p.kind === 'realm' && p.realmId === 'qi_refining')).toBe(true)
      // T9 — non-mutex: no root excludes another root.
      expect(root.prerequisites?.some((p) => p.kind === 'excludesNode')).toBe(false)
    }
  })

  it('roots are purchasable together — buying all three is legal', () => {
    const registry = registryWithNodes()
    const player = playerWith({
      realmId: 'qi_refining',
      cultivationPath: 'body',
      cultivationWay: 'hidden_body_pathway',
    })

    buy(player, registry, 'ho_mon')
    buy(player, registry, 'phan_mon')
    buy(player, registry, 'tro_mon')

    expect(getNodeLevel(player, 'ho_mon')).toBe(1)
    expect(getNodeLevel(player, 'phan_mon')).toBe(1)
    expect(getNodeLevel(player, 'tro_mon')).toBe(1)
  })

  it('deeper branch keystones gate on foundation_establishment', () => {
    const deeper = THE_TU_AN_NODES.filter(
      (candidate) =>
        candidate.role === 'keystone' ||
        (candidate.prerequisites ?? []).some((p) => p.kind === 'realm' && p.realmId === 'foundation_establishment'),
    )
    expect(deeper.length).toBeGreaterThan(0)
    for (const candidate of deeper) {
      expect(candidate.prerequisites?.some((p) => p.kind === 'realm' && p.realmId === 'foundation_establishment')).toBe(
        true,
      )
    }
  })

  it('INV-13 — no node authors a reactive chance stat (attributes are the only source)', () => {
    const banned: StatType[] = ['counterChance', 'protectChance', 'followUpChance', 'evasionRate']
    for (const candidate of THE_TU_AN_NODES) {
      for (const modifier of candidate.effect.statModifiers ?? []) {
        expect(banned.includes(modifier.stat), `${candidate.id} grants ${modifier.stat}`).toBe(false)
      }
    }
  })

  it('economy nodes live on the trunk — never gated behind a mechanic root', () => {
    const economy = THE_TU_AN_NODES.filter((candidate) => candidate.effect.hiddenBodyMechanicModifiers !== undefined)
    const trunkEconomy = economy.filter(
      (candidate) =>
        !(candidate.prerequisites ?? []).some((p) => p.kind === 'node' && ['ho_mon', 'phan_mon', 'tro_mon'].includes(p.nodeId)),
    )
    // At least cap + cost + gain channels exist on the trunk.
    const channels = new Set(
      trunkEconomy.flatMap((candidate) => Object.keys(candidate.effect.hiddenBodyMechanicModifiers ?? {})),
    )
    for (const channel of ['maxTheBonus', 'procCostDelta', 'procGainBonus']) {
      expect(channels.has(channel), `trunk economy channel '${channel}'`).toBe(true)
    }
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

    expect(collectHiddenBodyMechanicModifiers(registry, player).maxTheBonus).toBe(0)

    buy(player, registry, 'minor_ung_the_bi_the', 3)
    const mods = collectHiddenBodyMechanicModifiers(registry, player)
    expect(mods.maxTheBonus).toBe(30)
    expect(mods.procCostDelta).toBe(0)
  })
})

describe('buildTheTuAnKit modifier baking (participant-local clones)', () => {
  const fullMods = {
    maxTheBonus: 20,
    procCostDelta: -3,
    procGainBonus: 4,
    evadeGainBonus: 2,
    takenGainBonus: 1,
    basicGainBonus: 2,
    roundGainBonus: 3,
    interceptTheGainBonus: 8,
    interceptWardRatio: 0.15,
    evadeCounterMultiplierBonus: 0.6,
    counterChoangChance: 0.25,
    troHealTriggeringAllyRatio: 0.15,
    troCostDelta: -5,
    troAnyAction: 1,
  }

  it('bakes the maxThe cap onto the kit for the adapter to stamp on the entity', () => {
    const kit = buildTheTuAnKit(['ho_mon'], { ...fullMods, maxTheBonus: 0 })
    expect(kit.maxThe).toBe(MAX_THE)
    expect(buildTheTuAnKit(['ho_mon'], fullMods).maxThe).toBe(MAX_THE + 20)
  })

  it('bakes economy channels into the ung_the marker theEconomy fields', () => {
    const kit = buildTheTuAnKit([], fullMods)
    const ungThe = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'ung_the')!
    expect(economyPayload(ungThe)).toMatchObject({
      gainOnBasicHit: 6,
      gainOnEvade: 10,
      gainOnHitTaken: 7,
      gainPerRound: 8,
    })
  })

  it('bakes proc cost/gain into every reactiveProc effect; tro gets its own cost delta', () => {
    const kit = buildTheTuAnKit(['ho_mon', 'phan_mon', 'tro_mon'], fullMods)
    const markers = Object.fromEntries(
      kit.basic.grantsBuffsAtBuild!.map((def) => [def.id, def]),
    )

    for (const effect of procPayloads(markers['ho_mon']!)) {
      expect(effect.theCost).toBe(THE_PROC_COST - 3)
      expect(effect.theGainOnSuccess).toBe(THE_PROC_GAIN + 4 + 8)
    }
    for (const effect of procPayloads(markers['phan_mon']!)) {
      expect(effect.theCost).toBe(THE_PROC_COST - 3)
      expect(effect.theGainOnSuccess).toBe(THE_PROC_GAIN + 4)
    }
    for (const effect of procPayloads(markers['tro_mon']!)) {
      expect(effect.theCost).toBe(THE_PROC_COST - 3 - 5)
    }
  })

  it('bakes the intercept-ward rider onto the ho_mon marker', () => {
    const kit = buildTheTuAnKit(['ho_mon'], fullMods)
    const marker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'ho_mon')!
    const effect = procPayloads(marker)[0]!
    expect(effect.grantsWardToOriginalTarget).toEqual({ buffDefinitionId: 'ho_ve', sourceMaxHpRatio: 0.15 })
  })

  it('bakes the evade-context heavy counter: onEvade swaps to trong_phan_kich payload clone', () => {
    const kit = buildTheTuAnKit(['phan_mon'], fullMods)
    const marker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'phan_mon')!
    const evadeEffect = procPayloads(marker).find((candidate) => candidate.trigger === 'onEvade')!
    expect(evadeEffect.queuedAction?.payloadSkillId).toBe('trong_phan_kich')

    const takenEffect = procPayloads(marker).find((candidate) => candidate.trigger === 'onImpactLanded')!
    expect(takenEffect.queuedAction?.payloadSkillId).toBe('phan_kich')

    const heavy = kit.reactivePayloads['trong_phan_kich']
    expect(heavy?.damage?.multiplier).toBeCloseTo((PHAN_KICH.damage?.multiplier ?? 0) + 0.6)
  })

  it('bakes the counter break rider onto the counter payload clones', () => {
    const kit = buildTheTuAnKit(['phan_mon'], fullMods)
    for (const payloadId of ['phan_kich', 'trong_phan_kich']) {
      const payload = kit.reactivePayloads[payloadId]
      expect(payload?.appliesAilments).toContainEqual({ buffDefinitionId: 'choang', chance: 0.25 })
    }
  })

  it('bakes the tro riders: triggering-ally heal + non-damaging window', () => {
    const kit = buildTheTuAnKit(['tro_mon'], fullMods)
    const marker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'tro_mon')!
    const effect = procPayloads(marker)[0]!
    expect(effect.healsTriggeringAllyMaxHpRatio).toBe(0.15)
    expect(effect.firesOnNonDamagingAction).toBe(true)
  })

  it('zero mods keep authored base values — no phantom riders', () => {
    const zero = {
      maxTheBonus: 0,
      procCostDelta: 0,
      procGainBonus: 0,
      evadeGainBonus: 0,
      takenGainBonus: 0,
      basicGainBonus: 0,
      roundGainBonus: 0,
      interceptTheGainBonus: 0,
      interceptWardRatio: 0,
      evadeCounterMultiplierBonus: 0,
      counterChoangChance: 0,
      troHealTriggeringAllyRatio: 0,
      troCostDelta: 0,
      troAnyAction: 0,
    }
    const kit = buildTheTuAnKit(['ho_mon', 'phan_mon', 'tro_mon'], zero)

    const hoMarker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'ho_mon')!
    expect(procPayloads(hoMarker)[0]!.grantsWardToOriginalTarget).toBeUndefined()

    const phanMarker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'phan_mon')!
    const evadeEffect = procPayloads(phanMarker).find((candidate) => candidate.trigger === 'onEvade')
    expect(evadeEffect?.queuedAction?.payloadSkillId).toBe('phan_kich')
    expect(kit.reactivePayloads['trong_phan_kich']).toBeUndefined()
    expect(kit.reactivePayloads['phan_kich']?.appliesAilments).toBeUndefined()
  })
})
