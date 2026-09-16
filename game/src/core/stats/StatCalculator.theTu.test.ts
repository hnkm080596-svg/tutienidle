import { describe, expect, it } from 'vitest'
import { createBaseStats } from './StatBlock'
import type { Stats } from './StatBlock'
import {
  calculateEffectiveStats,
  resolveAttributeTotals,
  type StatModifier,
} from './StatCalculator'
import { applyDomainGate } from './StatDomain'
import { clampStatValue } from './StatMetadata'
import { collectActiveWayStatModifiers } from '../player/CultivationPathSystem'
import {
  theTuAnReactiveModifiers,
  theTuEnduranceModifiers,
} from '../the-tu/TheTuPath'
import { createDefaultPlayer, resolvePlayerFinalStats } from '../player/Player'
import { REACTIVE_CHANCE_CAP } from './TheTuStatChannels'

// The Tu Reimagined (spec 2026-09-15 section 3) — Task 3:
//  - three new derived chance stats live in the the_tu_an domain,
//    emitted by BOTH channels (assembly emitter + domain delta deriver).
//  - emitters emit RAW uncapped values; REACTIVE_CHANCE_CAP applies only
//    at consumption (clampStatValue at the roll/display site) so a mid-
//    battle attribute debuff composes correctly against an over-cap base.
//  - vitality -> enduranceThreshold leaves the universal derivation and
//    becomes a the_tu-domain channel; the four defensive stats are
//    gated to the_tu.

function statMod(overrides: Partial<StatModifier>): StatModifier {
  return {
    id: 'test',
    sourceId: 'test',
    sourceType: 'equipment',
    stat: 'might',
    ...overrides,
  }
}

function playerWithPath(path: 'the_tu' | 'the_tu_an' | 'phap_tu' | 'kiem_tu' | undefined) {
  const player = createDefaultPlayer()
  player.cultivationPath = path
  return player
}

describe('the_tu_an reactive chance stats — assembly emission', () => {
  it('emits domain-tagged raw chance modifiers from attribute totals', () => {
    const totals = resolveAttributeTotals(
      createBaseStats({ strength: 100, dexterity: 100, intelligence: 100, vitality: 100 }),
      [],
    )

    // M5 — the emitter is totals-driven (facet internals); the way gate
    // is the facet resolution below.
    const mods = theTuAnReactiveModifiers(totals, 'the_tu_an:attributes')

    const byStat = new Map(mods.map((m) => [m.stat, m]))
    expect(byStat.get('counterChance')?.flat).toBeCloseTo(0.8, 5)
    expect(byStat.get('protectChance')?.flat).toBeCloseTo(0.7, 5)
    expect(byStat.get('followUpChance')?.flat).toBeCloseTo(0.7, 5)
    for (const m of mods) {
      expect(m.domain).toBe('the_tu_an')
    }
  })

  it('the ung_the way facet emits the same triple through the sole channel', () => {
    const totals = resolveAttributeTotals(
      createBaseStats({ strength: 100, dexterity: 100, intelligence: 100, vitality: 100 }),
      [],
    )

    const mods = collectActiveWayStatModifiers(playerWithPath('the_tu_an'), totals)

    expect(mods).toEqual(theTuAnReactiveModifiers(totals, 'the_tu_an:attributes'))
  })

  it('emits NO the_tu_an-domain modifier for non-ung_the players (no leak across ways)', () => {
    const totals = resolveAttributeTotals(createBaseStats({ strength: 100, dexterity: 100 }), [])

    for (const path of ['the_tu', 'phap_tu', 'kiem_tu', undefined] as const) {
      const mods = collectActiveWayStatModifiers(playerWithPath(path), totals)
      expect(mods.filter((m) => m.domain === 'the_tu_an')).toEqual([])
    }
  })

  it('resolvePlayerFinalStats stores the RAW value — over cap is correct pre-consumption', () => {
    const player = playerWithPath('the_tu_an')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100
    player.baseStats.intelligence = 100
    player.baseStats.vitality = 100

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.counterChance).toBeCloseTo(0.8, 5)
    expect(stats.protectChance).toBeCloseTo(0.7, 5)
    expect(stats.followUpChance).toBeCloseTo(0.7, 5)
  })

  it('non-the_tu_an players resolve to 0 chance stats', () => {
    const player = playerWithPath('the_tu')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.counterChance).toBe(0)
    expect(stats.protectChance).toBe(0)
    expect(stats.followUpChance).toBe(0)
  })
})

describe('the_tu_an reactive chance stats — cap at consumption', () => {
  // Review-locked contract (P0.1): emitters/deriver emit raw linear
  // values; clampStatValue at the roll/display site applies the cap.
  it('raw 0.80 with a -0.05 effective delta stays capped at 0.60', () => {
    const player = playerWithPath('the_tu_an')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100
    const resolved = resolvePlayerFinalStats(player, [])
    expect(resolved.counterChance).toBeCloseTo(0.8, 5)

    // Mid-battle debuff: -12.5 strength -> delta counterChance -0.05.
    const effective = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'strength', flat: -12.5 })],
      { activeDomains: new Set(['the_tu_an']) },
    )

    // raw effective = 0.75 — over the cap, so the roll still clamps 0.60.
    expect(effective.counterChance).toBeCloseTo(0.75, 5)
    expect(clampStatValue('counterChance', effective.counterChance)).toBeCloseTo(0.6, 5)
  })

  it('raw 0.80 with a -0.25 effective delta rolls at 0.55', () => {
    const player = playerWithPath('the_tu_an')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'strength', flat: -62.5 })],
      { activeDomains: new Set(['the_tu_an']) },
    )

    expect(effective.counterChance).toBeCloseTo(0.55, 5)
    expect(clampStatValue('counterChance', effective.counterChance)).toBeCloseTo(0.55, 5)
  })

  it('delta deriver is domain-gated: no the_tu_an context -> no chance delta', () => {
    const player = playerWithPath('the_tu_an')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'strength', flat: -62.5 })],
      { activeDomains: new Set(['kiem_tu']) },
    )

    expect(effective.counterChance).toBeCloseTo(0.8, 5)
  })

  it('REACTIVE_CHANCE_CAP is the metadata max for all three chance stats', () => {
    expect(REACTIVE_CHANCE_CAP).toBe(0.6)
    expect(clampStatValue('counterChance', 1)).toBe(0.6)
    expect(clampStatValue('protectChance', 1)).toBe(0.6)
    expect(clampStatValue('followUpChance', 1)).toBe(0.6)
  })
})

describe('the_tu domain migration — endurance channel', () => {
  it('vitality -> enduranceThreshold emits only for hien-way players', () => {
    const totals = resolveAttributeTotals(createBaseStats({ vitality: 50 }), [])

    const theTu = collectActiveWayStatModifiers(playerWithPath('the_tu'), totals)
    expect(theTu).toHaveLength(1)
    expect(theTu[0]!.stat).toBe('enduranceThreshold')
    expect(theTu[0]!.flat).toBeCloseTo(50, 5)
    expect(theTu[0]!.domain).toBe('the_tu')
    expect(theTu).toEqual(theTuEnduranceModifiers(totals.vitality, 'the_tu:vitality'))

    for (const path of ['the_tu_an', 'phap_tu', 'kiem_tu', undefined] as const) {
      const mods = collectActiveWayStatModifiers(playerWithPath(path), totals)
      expect(mods.filter((m) => m.domain === 'the_tu')).toEqual([])
    }
  })

  it('per-path matrix: only the_tu derives enduranceThreshold from vitality', () => {
    for (const path of ['the_tu', 'the_tu_an', 'phap_tu', 'kiem_tu', undefined] as const) {
      const player = playerWithPath(path)
      player.baseStats.vitality = 50

      const stats = resolvePlayerFinalStats(player, [])

      // base 10 + (the_tu only) vitality x 1.
      expect(stats.enduranceThreshold).toBeCloseTo(path === 'the_tu' ? 60 : 10, 5)
    }
  })

  it('mid-battle vitality delta re-emits enduranceThreshold only for the_tu', () => {
    const theTuPlayer = playerWithPath('the_tu')
    theTuPlayer.baseStats.vitality = 50
    const resolved = resolvePlayerFinalStats(theTuPlayer, [])

    const buffed = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'vitality', flat: 10 })],
      { activeDomains: new Set(['the_tu']) },
    )
    expect(buffed.enduranceThreshold).toBeCloseTo(70, 5)

    const wrongDomain = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'vitality', flat: 10 })],
      { activeDomains: new Set(['the_tu_an']) },
    )
    expect(wrongDomain.enduranceThreshold).toBeCloseTo(60, 5)
  })
})

describe('the_tu domain gate — four defensive stats', () => {
  it('untagged modifier on a the_tu-gated stat throws in dev/test', () => {
    for (const stat of ['blockChance', 'blockEffectiveness', 'enduranceThreshold', 'endurancePercent'] as const) {
      expect(() => applyDomainGate([statMod({ stat, flat: 1 })])).toThrow(/StatDomain/)
    }
  })

  it('wrong-domain modifier is rejected; the_tu-tagged is accepted', () => {
    expect(() =>
      applyDomainGate([statMod({ stat: 'blockChance', flat: 1, domain: 'kiem_tu' })]),
    ).toThrow(/StatDomain/)

    const accepted = applyDomainGate([
      statMod({ stat: 'blockChance', flat: 1, domain: 'the_tu' }),
      statMod({ stat: 'counterChance', flat: 0.1, domain: 'the_tu_an' }),
    ])
    expect(accepted).toHaveLength(2)
  })

  it('universal stats still accept any-domain modifiers', () => {
    const accepted = applyDomainGate([statMod({ stat: 'evasionRate', flat: 5, domain: 'kiem_tu' })])
    expect(accepted).toHaveLength(1)
  })
})

// INV-13: the attribute->chance derivation is the ONLY source of the
// three chance stats — no node/buff/technique/kit may author a modifier
// for them. The whitelist gate alone cannot catch a the_tu_an-tagged
// modifier inside a whitelisted TheTu* file, so this scan asserts the
// authoring rule directly (files may not exist yet — the guard is for
// the tasks that add them).
describe('INV-13 — no authored chance-stat modifiers', () => {
  const CHANCE_STATS = new Set(['counterChance', 'protectChance', 'followUpChance'])

  function scan(value: unknown, hits: string[], visited = new Set<unknown>()): void {
    if (typeof value !== 'object' || value === null || visited.has(value)) return
    visited.add(value)
    const record = value as Record<string, unknown>
    if (typeof record.stat === 'string' && CHANCE_STATS.has(record.stat)) {
      hits.push(record.stat)
    }
    for (const child of Object.values(record)) scan(child, hits, visited)
  }

  it('no TheTu*/TheTuAn* data module emits chance-stat modifiers', () => {
    const modules = import.meta.glob('../../data/**/TheTu*.ts', { eager: true })
    const hits: string[] = []

    for (const [path, moduleExports] of Object.entries(modules)) {
      if (path.endsWith('.test.ts')) continue
      for (const exported of Object.values(moduleExports as Record<string, unknown>)) {
        scan(exported, hits)
      }
    }

    expect(hits).toEqual([])
  })
})
