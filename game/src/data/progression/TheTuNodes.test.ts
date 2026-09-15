import { describe, expect, it } from 'vitest'
import { THE_TU_NODES } from './TheTuNodes'
import { NodeRegistry } from '../../core/progression/NodeRegistry'
import { canPurchaseNode, getNodeLevel, purchaseNode } from '../../core/progression/NodeSystem'
import { createDefaultPlayer } from '../../core/player/Player'
import { collectTheTuKitModifiers } from '../../core/the-tu/TheTuKitModifiers'
import { buildTheTuKit } from '../skill/TheTuSkills'
import { BAT_TU_BA_THE, BAT_TU_BA_THE_TURNS, CUONG_QUYEN, CUONG_QUYEN_MISSING_HP_PER_PERCENT, SON_NHAC_WARD_RATIO } from '../skill/TheTuSkills'
import { BAT_TU_BA_THE_BUFF, KHIEM_KHICH_DEBUFF, KHIEM_KHICH_TURNS } from '../buff/TheTuBuffs'
import { BuffPool } from '../../core/buff/BuffPool'
import { BuffSystem } from '../../core/buff/BuffSystem'
import type { CombatEntity } from '../../core/combat/CombatEntity'
import { createBaseStats } from '../../core/stats/StatBlock'
import { STAT_DOMAIN } from '../../core/stats/StatDomain'
import type { StatType } from '../../core/stats/StatTypes'

function fixtureCombatant(id: string, statOverrides: Parameters<typeof createBaseStats>[0]): CombatEntity {
  const stats = createBaseStats(statOverrides)
  return {
    id,
    name: id,
    type: 'enemy',
    stats,
    baseStats: stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: 0,
    currentSwordIntent: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 0,
    alive: true,
  } as CombatEntity
}

// The Tu Reimagined (plan Task 12, spec section 8.1) — the_tu tree data:
// mutex roots, realm gates, collector->kit delivery, INV-13 authoring ban.

function playerWith(overrides: Partial<ReturnType<typeof createDefaultPlayer>> = {}) {
  return { ...createDefaultPlayer(), skillInsight: 99, ...overrides }
}

function registryWithNodes() {
  const registry = new NodeRegistry()
  for (const node of THE_TU_NODES) {
    registry.register(node)
  }
  return registry
}

function node(id: string) {
  const found = THE_TU_NODES.find((candidate) => candidate.id === id)
  if (!found) {
    throw new Error(`node ${id} not authored`)
  }
  return found
}

describe('TheTuNodes — root mutex + realm gates (INV-2)', () => {
  it('cuong_chien and tran_the are excludesNode-mutual roots gated at qi_refining', () => {
    const cuong = node('cuong_chien')
    const tran = node('tran_the')

    expect(cuong.prerequisites).toContainEqual({ kind: 'excludesNode', nodeId: 'tran_the' })
    expect(tran.prerequisites).toContainEqual({ kind: 'excludesNode', nodeId: 'cuong_chien' })
    expect(cuong.prerequisites).toContainEqual({ kind: 'realm', realmId: 'qi_refining' })
    expect(tran.prerequisites).toContainEqual({ kind: 'realm', realmId: 'qi_refining' })
  })

  it('owning one root blocks purchasing the other (both directions)', () => {
    const playerA = playerWith({ realmId: 'qi_refining', nodeLevels: { cuong_chien: 1 }, purchasedNodeIds: ['cuong_chien'] })
    const playerB = playerWith({ realmId: 'qi_refining', nodeLevels: { tran_the: 1 }, purchasedNodeIds: ['tran_the'] })

    expect(canPurchaseNode(playerA, node('tran_the'))).toBe(false)
    expect(canPurchaseNode(playerB, node('cuong_chien'))).toBe(false)
  })

  it('roots are purchasable at qi_refining; deeper nodes require foundation_establishment', () => {
    const qiPlayer = playerWith({ realmId: 'qi_refining' })
    expect(canPurchaseNode(qiPlayer, node('cuong_chien'))).toBe(true)

    const deeper = THE_TU_NODES.filter(
      (candidate) =>
        (candidate.prerequisites ?? []).some(
          (prerequisite) => prerequisite.kind === 'realm' && prerequisite.realmId === 'foundation_establishment',
        ),
    )
    expect(deeper.length).toBeGreaterThan(0)
    for (const gated of deeper) {
      const nodePrereqs = (gated.prerequisites ?? [])
        .filter((prerequisite) => prerequisite.kind === 'node')
        .map((prerequisite) => (prerequisite as { nodeId: string }).nodeId)
      const nodeLevels: Record<string, number> = { cuong_chien: 1, tran_the: 1 }
      for (const prereqId of nodePrereqs) {
        nodeLevels[prereqId] = 1
      }
      const owner = playerWith({
        realmId: 'qi_refining',
        nodeLevels,
        purchasedNodeIds: Object.keys(nodeLevels),
      })
      expect(canPurchaseNode(owner, gated), `${gated.id} must stay gated at qi_refining`).toBe(false)
      owner.realmId = 'foundation_establishment'
      expect(canPurchaseNode(owner, gated), `${gated.id} opens at foundation_establishment`).toBe(true)
    }
  })
})

describe('TheTuNodes — node -> collector -> kit-def delivery', () => {
  it('missing-HP scalar node scales the built cuong_quyen/loan_dau clone, not the registry def', () => {
    const registry = registryWithNodes()
    const player = playerWith({ realmId: 'qi_refining' })

    purchaseNode(player, node('cuong_chien'))
    const growth = node('minor_cuong_huyet_no')
    purchaseNode(player, growth)
    player.nodeLevels[growth.id] = 3

    const mods = collectTheTuKitModifiers(registry, player)
    expect(mods.missingHpBonusBonus).toBeCloseTo(0.005 * 3)

    const kit = buildTheTuKit('cuong_chien', mods)
    expect(kit.basic.damage?.missingHpBonusPerMissingPercent).toBeCloseTo(CUONG_QUYEN_MISSING_HP_PER_PERCENT + 0.015)
    expect(kit.special.damage?.missingHpBonusPerMissingPercent).toBeCloseTo(CUONG_QUYEN_MISSING_HP_PER_PERCENT + 0.015)
    // Registry def untouched — participant clones carry the bonus.
    expect(CUONG_QUYEN.damage?.missingHpBonusPerMissingPercent).toBeCloseTo(CUONG_QUYEN_MISSING_HP_PER_PERCENT)
  })

  it('Bất Tử duration node delivers durationOverride = base + bonus (manual and lethal share one channel)', () => {
    const registry = registryWithNodes()
    const player = playerWith({ realmId: 'foundation_establishment' })

    purchaseNode(player, node('cuong_chien'))
    purchaseNode(player, node('major_bat_tu_tuc_menh'))

    const mods = collectTheTuKitModifiers(registry, player)
    expect(mods.batTuDurationBonus).toBe(1)

    const kit = buildTheTuKit('cuong_chien', mods)
    const application = kit.ultimate.appliesBuffs?.find((entry) => entry.definitionId === 'bat_tu_ba_the')
    expect(application?.durationOverride).toBe(BAT_TU_BA_THE_TURNS + 1)
    // The lethal path reads the SAME slot application — no second channel.
    expect(BAT_TU_BA_THE.appliesBuffs?.[0]?.durationOverride).toBeUndefined()
  })

  it('fixed_holder_turns + node override: exactly 4 holder-turns regardless of ailment stats', () => {
    const pool = new BuffPool()
    const source = fixtureCombatant('src', { ailmentDurationPercent: 1 })
    const target = fixtureCombatant('tgt', { ailmentResistPercent: 0.75 })
    const registry = { get: (id: string) => (id === 'bat_tu_ba_the' ? BAT_TU_BA_THE_BUFF : undefined) as never }

    new BuffSystem(pool).apply(BAT_TU_BA_THE_BUFF, source, target, registry, BAT_TU_BA_THE_TURNS + 1)

    expect(BAT_TU_BA_THE_BUFF.durationPolicy).toBe('fixed_holder_turns')
    expect(pool.getAllById('bat_tu_ba_the')[0]!.remainingTurns).toBe(4)
  })

  it('taunt duration node delivers +1 enemy turns through the same override channel', () => {
    const registry = registryWithNodes()
    const player = playerWith({ realmId: 'foundation_establishment' })

    purchaseNode(player, node('tran_the'))
    purchaseNode(player, node('major_khiem_khich_dien'))

    const mods = collectTheTuKitModifiers(registry, player)
    const kit = buildTheTuKit('tran_the', mods)
    const taunt = kit.ultimate.appliesBuffs?.find((entry) => entry.definitionId === 'khiem_khich')

    expect(taunt?.durationOverride).toBe(KHIEM_KHICH_TURNS + 1)
    // Khiem Khich stays ailment_scaled — enemy resist may shorten Taunt.
    expect(KHIEM_KHICH_DEBUFF.durationPolicy ?? 'ailment_scaled').toBe('ailment_scaled')
  })

  it('son_nhac ward ratio node feeds the externalWardGrant channel', () => {
    const registry = registryWithNodes()
    const player = playerWith({ realmId: 'foundation_establishment' })

    purchaseNode(player, node('tran_the'))
    purchaseNode(player, node('major_son_nhac_bao_bi'))

    const mods = collectTheTuKitModifiers(registry, player)
    const kit = buildTheTuKit('tran_the', mods)
    const ward = kit.ultimate.appliesBuffs?.find((entry) => entry.definitionId === 'son_nhac_ho_the')

    expect(ward?.externalWardGrant?.sourceMaxHpRatio).toBeCloseTo(SON_NHAC_WARD_RATIO + 0.05)
  })
})

describe('TheTuNodes — authoring contract (INV-13 + single render path)', () => {
  const FORBIDDEN: StatType[] = ['counterChance', 'protectChance', 'followUpChance']

  it('no authored modifier targets the the_tu_an chance stats', () => {
    for (const candidate of THE_TU_NODES) {
      for (const modifier of candidate.effect.statModifiers ?? []) {
        expect(FORBIDDEN.includes(modifier.stat), `${candidate.id} emits ${modifier.stat}`).toBe(false)
      }
    }
  })

  it('every gated-stat modifier declares domain the_tu', () => {
    for (const candidate of THE_TU_NODES) {
      for (const modifier of candidate.effect.statModifiers ?? []) {
        const gate = STAT_DOMAIN[modifier.stat]
        if (gate && gate !== 'universal') {
          expect(modifier.domain, `${candidate.id}:${modifier.stat} missing domain tag`).toBe('the_tu')
        }
      }
    }
  })

  it('all nodes share the single the_tu branchTag (one tree view; mutex enforced by gates)', () => {
    for (const candidate of THE_TU_NODES) {
      expect(candidate.branchTag).toBe('the_tu')
    }
  })

  it('kit resolution roots exist exactly once', () => {
    expect(getNodeLevel(playerWith({ nodeLevels: { cuong_chien: 1 } }), 'cuong_chien')).toBe(1)
    expect(THE_TU_NODES.filter((candidate) => candidate.role === 'root').map((candidate) => candidate.id).sort()).toEqual([
      'cuong_chien',
      'tran_the',
    ])
  })
})
