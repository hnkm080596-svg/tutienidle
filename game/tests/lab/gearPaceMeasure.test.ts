import { describe, expect, it } from 'vitest'
import { createEquipmentInstance } from '@/core/equipment/EquipmentRolling'
import {
  ITEM_QUALITY_DROP_WEIGHT,
  itemQualityCeilingForFloor,
} from '@/core/equipment/ItemQualityBalance'
import { ENHANCE_SLOT_SCALE, enhanceSuccessRate } from '@/core/equipment/EnhanceCurve'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '@/core/item/ItemQuality'
import { EquipmentRegistry } from '@/core/equipment/EquipmentRegistry'
import { AffixRegistry } from '@/core/equipment/AffixRegistry'
import { equipment } from '@/data/equipment/equipment'
import { affixes } from '@/data/equipment/affixes'
import { createDefaultPlayer } from '@/core/player/Player'
import { mulberry32 } from '@/core/battle/SeededRandom'

// Gear pace measurement harness (balance-worker scratch evidence, NOT
// committed as a pin): prints expected item power per quality, quality
// distribution per floor band after the retune, and the enhance ladder.

const equipReg = new EquipmentRegistry()
for (const e of equipment) equipReg.register(e)
const affixReg = new AffixRegistry()
for (const a of affixes) affixReg.register(a)

interface RollStats {
  quality: ItemQuality
  mainValue: number
  affixCount: number
  affixValueSum: number
  avgTier: number
}

function sampleRolls(
  realmId: 'mortal' | 'qi_refining' | 'foundation_establishment',
  realmLevel: number,
  templateId: string,
  n: number,
  maxQuality?: ItemQuality,
): { byQuality: Map<ItemQuality, RollStats[]>; total: number } {
  const template = equipReg.get(templateId)
  if (!template) throw new Error(`missing template ${templateId}`)
  const rng = mulberry32(0x5eed)
  const byQuality = new Map<ItemQuality, RollStats[]>()
  for (let i = 0; i < n; i++) {
    const player = createDefaultPlayer()
    player.realmId = realmId
    player.realmLevel = realmLevel
    const inst = createEquipmentInstance(template, player, affixReg, undefined, 0, rng, maxQuality)
    if (!inst) continue
    const affixSum = inst.affixes.reduce((s, a) => s + a.value, 0)
    const avgTier =
      inst.affixes.length === 0
        ? 0
        : inst.affixes.reduce((s, a) => s + a.tier, 0) / inst.affixes.length
    const row: RollStats = {
      quality: inst.quality,
      mainValue: inst.mainStat.flat ?? 0,
      affixCount: inst.affixes.length,
      affixValueSum: affixSum,
      avgTier,
    }
    const list = byQuality.get(inst.quality) ?? []
    list.push(row)
    byQuality.set(inst.quality, list)
  }
  return { byQuality, total: n }
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}

describe('gear pace measurement', () => {
  it('prints quality power table per realm', () => {
    const N = 20000
    for (const [realmId, level] of [
      ['mortal', 10],
      ['qi_refining', 10],
      ['foundation_establishment', 10],
    ] as const) {
      const { byQuality } = sampleRolls(realmId, level, 'base_kiem', N)
      console.log(`\n=== ${realmId} L${level} base_kiem (weapon, might mainstat) ===`)
      console.log('quality | share | E[mainStat] | E[affixes] | E[affixSum] | E[tier]')
      for (const q of ITEM_QUALITY_ORDER) {
        const list = byQuality.get(q) ?? []
        if (list.length === 0) continue
        console.log(
          `${q.padEnd(6)} | ${(list.length / N).toFixed(4)} | ` +
            `${mean(list.map((r) => r.mainValue)).toFixed(2)} | ` +
            `${mean(list.map((r) => r.affixCount)).toFixed(2)} | ` +
            `${mean(list.map((r) => r.affixValueSum)).toFixed(2)} | ` +
            `${mean(list.map((r) => r.avgTier)).toFixed(2)}`,
        )
      }
    }
    expect(true).toBe(true)
  })

  it('prints AFTER-retune quality distribution per floor band', () => {
    const N = 20000
    for (const floor of [1, 3, 4, 6, 7, 9, 10]) {
      const ceiling = itemQualityCeilingForFloor(floor)
      const { byQuality } = sampleRolls('qi_refining', 10, 'base_kiem', N, ceiling)
      const parts = ITEM_QUALITY_ORDER.map(
        (q) => `${q}=${(((byQuality.get(q)?.length ?? 0) / N) * 100).toFixed(1)}%`,
      ).join(' ')
      console.log(`floor ${floor} (cap ${ceiling}): ${parts}`)
    }
    // affix-tier distribution conditioned on the item's rolled quality
    {
      const rng = mulberry32(0xcafe)
      const template = equipReg.get('base_kiem')!
      const perQuality = new Map<ItemQuality, Map<number, number>>()
      for (let i = 0; i < N; i++) {
        const player = createDefaultPlayer()
        player.realmId = 'qi_refining'
        player.realmLevel = 10
        const inst = createEquipmentInstance(template, player, affixReg, undefined, 0, rng)
        const bucket = perQuality.get(inst.quality) ?? new Map<number, number>()
        for (const a of inst.affixes) bucket.set(a.tier, (bucket.get(a.tier) ?? 0) + 1)
        perQuality.set(inst.quality, bucket)
      }
      for (const q of ITEM_QUALITY_ORDER) {
        const bucket = perQuality.get(q)
        if (!bucket) continue
        const total = [...bucket.values()].reduce((a, b) => a + b, 0)
        const parts = [...bucket.entries()]
          .sort(([a], [b]) => a - b)
          .map(([t, c]) => `t${t}=${((c / total) * 100).toFixed(1)}%`)
        console.log(`affix tiers @${q} (uncapped rolls): ${parts.join(' ')}`)
      }
    }
    expect(true).toBe(true)
  })

  it('prints enhance ladder + expected kill cost to reach level', () => {
    console.log('\n=== enhance ladder (slot scale 1+L*0.06) ===')
    console.log('L | scale | success% | E[attempts to +1] | cumulative E[attempts]')
    let cum = 0
    for (const L of [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20]) {
      const p = enhanceSuccessRate(L + 1) / 100
      const attempts = 1 / Math.max(p, 1 / 10)
      cum += attempts
      console.log(
        `${L}->${L + 1} | ${(1 + L * ENHANCE_SLOT_SCALE).toFixed(2)} | ${enhanceSuccessRate(L + 1)} | ${attempts.toFixed(1)} | ${cum.toFixed(0)}`,
      )
    }
    expect(true).toBe(true)
  })

  it('prints drop supply: equipment draws per hour per realm stage', () => {
    const share = { mortal: 30 / 30, qi: 20 / 70, foundation: 20 / 70 }
    const rolls = { mortal: 1, qi: 2, foundation: 1 }
    const killsPerMin = 20
    console.log('\n=== equipment drops per hour (20 kills/min while farming) ===')
    for (const [k, s] of Object.entries(share)) {
      const perKill = s * (rolls[k as keyof typeof rolls] ?? 1)
      console.log(`${k}: share=${s.toFixed(2)} rolls~${rolls[k as keyof typeof rolls]} -> ${(perKill * killsPerMin * 60).toFixed(0)} items/h`)
    }
    const pThien = ITEM_QUALITY_DROP_WEIGHT.thien / 100
    for (const [k, s] of Object.entries(share)) {
      const itemsNeeded = 1 / pThien
      const kills = itemsNeeded / s
      console.log(`${k}: P(thien)/drop=${pThien} -> E[kills to first thien]=${kills.toFixed(0)} = ${(kills / killsPerMin).toFixed(1)} min (BEFORE, any floor)`)
    }
    console.log('\nAFTER: thien only rolls on floors 7-9+; E[kills to first thien] farming floor 7-9:')
    for (const [k, s] of Object.entries(share)) {
      const kills = 1 / pThien / s
      console.log(`${k} floor7-9: ${kills.toFixed(0)} kills = ${(kills / killsPerMin).toFixed(1)} min`)
    }
    expect(true).toBe(true)
  })
})
