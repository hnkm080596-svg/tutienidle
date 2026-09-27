import { describe, expect, it } from 'vitest'
import { createBaseStats } from './StatBlock'
import {
  calculateEffectiveStats,
  resolveAttributeTotals,
  type StatModifier,
} from './StatCalculator'
import { applyDomainGate } from './StatDomain'
import { clampStatValue } from './StatMetadata'
import { collectActiveWayStatModifiers } from '../player/CultivationPathSystem'
import {
  hiddenBodyReactiveModifiers,
  bodyEnduranceModifiers,
} from '../the-tu/TheTuPath'
import { createDefaultPlayer, resolvePlayerFinalStats } from '../player/Player'
import { REACTIVE_CHANCE_CAP } from './TheTuStatChannels'

// The Tu Reimagined (spec 2026-09-15 section 3) — Task 3:
//  - three new derived chance stats live in the hidden_body domain,
//    emitted by BOTH channels (assembly emitter + domain delta deriver).
//  - emitters emit RAW uncapped values; REACTIVE_CHANCE_CAP applies only
//    at consumption (clampStatValue at the roll/display site) so a mid-
//    battle attribute debuff composes correctly against an over-cap base.
//  - vitality -> enduranceThreshold leaves the universal derivation and
//    becomes a body-domain channel; the four defensive stats are
//    gated to body.

function statMod(overrides: Partial<StatModifier>): StatModifier {
  return {
    id: 'test',
    sourceId: 'test',
    sourceType: 'equipment',
    stat: 'might',
    ...overrides,
  }
}

// M7 — the persisted pair: a path id alone is corrupt (way-less saves
// resolve nothing), so the helper always stamps an atomic (path, way)
// pair. 'hidden_body_pathway' selects the body's hidden way.
const BASE_WAY = {
  body: 'body_pathway',
  spell: 'spell_pathway',
  sword: 'sword_pathway',
} as const

function playerWithPath(
  path: keyof typeof BASE_WAY | 'hidden_body_pathway' | undefined,
) {
  const player = createDefaultPlayer()

  if (path === 'hidden_body_pathway') {
    player.cultivationPath = 'body'
    player.cultivationWay = 'hidden_body_pathway'
    return player
  }

  if (path !== undefined) {
    player.cultivationPath = path
    player.cultivationWay = BASE_WAY[path]
  }

  return player
}

describe('hidden_body reactive chance stats — assembly emission', () => {
  it('emits domain-tagged raw chance modifiers from attribute totals', () => {
    const totals = resolveAttributeTotals(
      createBaseStats({ strength: 100, dexterity: 100, intelligence: 100, vitality: 100 }),
      [],
    )

    // M5 — the emitter is totals-driven (facet internals); the way gate
    // is the facet resolution below.
    const mods = hiddenBodyReactiveModifiers(totals, 'hidden_body:attributes')

    const byStat = new Map(mods.map((m) => [m.stat, m]))
    expect(byStat.get('counterChance')?.flat).toBeCloseTo(0.8, 5)
    expect(byStat.get('protectChance')?.flat).toBeCloseTo(0.7, 5)
    expect(byStat.get('followUpChance')?.flat).toBeCloseTo(0.7, 5)
    for (const m of mods) {
      expect(m.domain).toBe('hidden_body')
    }
  })

  it('the ung_the way facet emits the same triple through the sole channel', () => {
    const totals = resolveAttributeTotals(
      createBaseStats({ strength: 100, dexterity: 100, intelligence: 100, vitality: 100 }),
      [],
    )

    const mods = collectActiveWayStatModifiers(playerWithPath('hidden_body_pathway'), totals)

    expect(mods).toEqual(hiddenBodyReactiveModifiers(totals, 'hidden_body:attributes'))
  })

  it('emits NO hidden_body-domain modifier for non-ung_the players (no leak across ways)', () => {
    const totals = resolveAttributeTotals(createBaseStats({ strength: 100, dexterity: 100 }), [])

    for (const path of ['body', 'spell', 'sword', undefined] as const) {
      const mods = collectActiveWayStatModifiers(playerWithPath(path), totals)
      expect(mods.filter((m) => m.domain === 'hidden_body')).toEqual([])
    }
  })

  it('resolvePlayerFinalStats stores the RAW value — over cap is correct pre-consumption', () => {
    const player = playerWithPath('hidden_body_pathway')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100
    player.baseStats.intelligence = 100
    player.baseStats.vitality = 100

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.counterChance).toBeCloseTo(0.8, 5)
    expect(stats.protectChance).toBeCloseTo(0.7, 5)
    expect(stats.followUpChance).toBeCloseTo(0.7, 5)
  })

  it('non-hidden_body players resolve to 0 chance stats', () => {
    const player = playerWithPath('body')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.counterChance).toBe(0)
    expect(stats.protectChance).toBe(0)
    expect(stats.followUpChance).toBe(0)
  })
})

describe('hidden_body reactive chance stats — cap at consumption', () => {
  // Review-locked contract (P0.1): emitters/deriver emit raw linear
  // values; clampStatValue at the roll/display site applies the cap.
  it('raw 0.80 with a -0.05 effective delta stays capped at 0.60', () => {
    const player = playerWithPath('hidden_body_pathway')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100
    const resolved = resolvePlayerFinalStats(player, [])
    expect(resolved.counterChance).toBeCloseTo(0.8, 5)

    // Mid-battle debuff: -12.5 strength -> delta counterChance -0.05.
    const effective = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'strength', flat: -12.5 })],
      { activeDomains: new Set(['hidden_body']) },
    )

    // raw effective = 0.75 — over the cap, so the roll still clamps 0.60.
    expect(effective.counterChance).toBeCloseTo(0.75, 5)
    expect(clampStatValue('counterChance', effective.counterChance)).toBeCloseTo(0.6, 5)
  })

  it('raw 0.80 with a -0.25 effective delta rolls at 0.55', () => {
    const player = playerWithPath('hidden_body_pathway')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'strength', flat: -62.5 })],
      { activeDomains: new Set(['hidden_body']) },
    )

    expect(effective.counterChance).toBeCloseTo(0.55, 5)
    expect(clampStatValue('counterChance', effective.counterChance)).toBeCloseTo(0.55, 5)
  })

  it('delta deriver is domain-gated: no hidden_body context -> no chance delta', () => {
    const player = playerWithPath('hidden_body_pathway')
    player.baseStats.strength = 100
    player.baseStats.dexterity = 100
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'strength', flat: -62.5 })],
      { activeDomains: new Set(['sword']) },
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

describe('body domain migration — endurance channel', () => {
  it('vitality -> enduranceThreshold emits only for hien-way players', () => {
    const totals = resolveAttributeTotals(createBaseStats({ vitality: 50 }), [])

    const body = collectActiveWayStatModifiers(playerWithPath('body'), totals)
    expect(body).toHaveLength(1)
    expect(body[0]!.stat).toBe('enduranceThreshold')
    expect(body[0]!.flat).toBeCloseTo(50, 5)
    expect(body[0]!.domain).toBe('body')
    expect(body).toEqual(bodyEnduranceModifiers(totals.vitality, 'body:vitality'))

    for (const path of ['hidden_body_pathway', 'spell', 'sword', undefined] as const) {
      const mods = collectActiveWayStatModifiers(playerWithPath(path), totals)
      expect(mods.filter((m) => m.domain === 'body')).toEqual([])
    }
  })

  it('per-path matrix: only body derives enduranceThreshold from vitality', () => {
    for (const path of ['body', 'hidden_body_pathway', 'spell', 'sword', undefined] as const) {
      const player = playerWithPath(path)
      player.baseStats.vitality = 50

      const stats = resolvePlayerFinalStats(player, [])

      // base 10 + (body only) vitality x 1.
      expect(stats.enduranceThreshold).toBeCloseTo(path === 'body' ? 60 : 10, 5)
    }
  })

  it('mid-battle vitality delta re-emits enduranceThreshold only for body', () => {
    const bodyPlayer = playerWithPath('body')
    bodyPlayer.baseStats.vitality = 50
    const resolved = resolvePlayerFinalStats(bodyPlayer, [])

    const buffed = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'vitality', flat: 10 })],
      { activeDomains: new Set(['body']) },
    )
    expect(buffed.enduranceThreshold).toBeCloseTo(70, 5)

    const wrongDomain = calculateEffectiveStats(
      resolved,
      [statMod({ stat: 'vitality', flat: 10 })],
      { activeDomains: new Set(['hidden_body']) },
    )
    expect(wrongDomain.enduranceThreshold).toBeCloseTo(60, 5)
  })
})

describe('body domain gate — four defensive stats', () => {
  it('untagged modifier on a body-gated stat throws in dev/test', () => {
    for (const stat of ['blockChance', 'blockEffectiveness', 'enduranceThreshold', 'endurancePercent'] as const) {
      expect(() => applyDomainGate([statMod({ stat, flat: 1 })])).toThrow(/StatDomain/)
    }
  })

  it('wrong-domain modifier is rejected; body-tagged is accepted', () => {
    expect(() =>
      applyDomainGate([statMod({ stat: 'blockChance', flat: 1, domain: 'sword' })]),
    ).toThrow(/StatDomain/)

    const accepted = applyDomainGate([
      statMod({ stat: 'blockChance', flat: 1, domain: 'body' }),
      statMod({ stat: 'counterChance', flat: 0.1, domain: 'hidden_body' }),
    ])
    expect(accepted).toHaveLength(2)
  })

  it('universal stats still accept any-domain modifiers', () => {
    const accepted = applyDomainGate([statMod({ stat: 'evasionRate', flat: 5, domain: 'sword' })])
    expect(accepted).toHaveLength(1)
  })
})

// INV-13: the attribute->chance derivation is the ONLY source of the
// three chance stats — no node/buff/technique/kit may author a modifier
// for them. The whitelist gate alone cannot catch a hidden_body-tagged
// modifier inside a whitelisted Body* file, so this scan asserts the
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

  it('no Body*/TheTuAn* data module emits chance-stat modifiers', () => {
    // Glob negation (LegacySkillCoverage.test.ts precedent): TheTu*.ts
    // also matches TheTu*.test.ts; without the exclusion the eager import
    // executes those test modules and re-registers their suites inside
    // this file (measured: +59 duplicate case executions in one run).
    const modules = import.meta.glob(
      ['../../data/**/TheTu*.ts', '!../../data/**/*.test.ts'],
      { eager: true },
    )
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
