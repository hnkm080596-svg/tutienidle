import { describe, expect, it } from 'vitest'
import {
  applyCompanionExp,
  applyConstellationRank,
  companionBattleExpPerKill,
  companionExpRequiredForLevel,
  companionFeedExpValue,
  companionGlobalLevel,
  companionStatsAt,
  isCompanionLevelMaxed,
  isCompanionSkillUnlocked,
  MAX_CONSTELLATION_RANK,
  resolveCompanionSkillKit,
} from './CompanionProgression'
import type { CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'
import type { Material } from '@/core/material/Material'

function makeInstance(overrides: Partial<CompanionInstance> = {}): CompanionInstance {
  return {
    instanceId: 'inst_1',
    definitionId: 'def_1',
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
    ...overrides,
  }
}

const BASE_STATS = { maxHp: 100, attack: 10, speed: 100 }

function makeDefinition(overrides: Partial<CompanionDefinition> = {}): CompanionDefinition {
  return {
    id: 'def_1',
    name: 'Test',
    grade: 'hoang',
    growthRate: 0.05,
    unlockThresholds: {},
    baseStats: { ...BASE_STATS },
    basic: {
      id: 'def_1_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    },
    ...overrides,
  }
}

describe('companionExpRequiredForLevel', () => {
  it('mortal tier 1 costs exactly 40', () => {
    expect(companionExpRequiredForLevel('mortal', 1)).toBe(40)
  })

  it('scales with tier within a realm', () => {
    expect(companionExpRequiredForLevel('mortal', 5)).toBeGreaterThan(
      companionExpRequiredForLevel('mortal', 1),
    )
  })

  it('scales with realm index (qi_refining is 2x mortal at the same tier)', () => {
    expect(companionExpRequiredForLevel('qi_refining', 1)).toBe(80)
    expect(companionExpRequiredForLevel('qi_refining', 7)).toBe(
      2 * companionExpRequiredForLevel('mortal', 7),
    )
  })
})

describe('companionBattleExpPerKill', () => {
  it('scales with the stage realm index', () => {
    expect(companionBattleExpPerKill('mortal')).toBe(2)
    expect(companionBattleExpPerKill('qi_refining')).toBe(4)
  })
})

describe('companionGlobalLevel', () => {
  it('uses real per-realm maxLevel (mortal 18 + qi_refining 18 + foundation 18 -> golden_core 1 is global 55)', () => {
    expect(companionGlobalLevel({ realmId: 'golden_core', realmLevel: 1 })).toBe(55)
  })

  it('mortal tier 1 is global level 1', () => {
    expect(companionGlobalLevel({ realmId: 'mortal', realmLevel: 1 })).toBe(1)
  })
})

describe('applyCompanionExp', () => {
  it('levels up once and carries leftover exp', () => {
    const instance = makeInstance({ realmId: 'mortal', realmLevel: 1, exp: 0 })

    const result = applyCompanionExp(instance, 50, 'mortal')

    expect(result.instance.realmLevel).toBe(2)
    expect(result.instance.exp).toBe(10) // 50 - 40 required at mortal tier 1
    expect(result.levelsGained).toBe(1)
    expect(result.realmBreakthroughs).toEqual([])
    expect(result.clampedExp).toBe(0)
    expect(instance.realmLevel).toBe(1) // input untouched
    expect(instance.exp).toBe(0)
  })

  it('banks exp without leveling when below the requirement', () => {
    const result = applyCompanionExp(makeInstance({ exp: 5 }), 10, 'mortal')

    expect(result.instance.realmLevel).toBe(1)
    expect(result.instance.exp).toBe(15)
    expect(result.levelsGained).toBe(0)
  })

  it('breaks through to the next realm past maxLevel and carries exp', () => {
    const required = companionExpRequiredForLevel('mortal', 18)
    const instance = makeInstance({ realmId: 'mortal', realmLevel: 18, exp: 0 })

    const result = applyCompanionExp(instance, required + 30, 'qi_refining')

    expect(result.instance.realmId).toBe('qi_refining')
    expect(result.instance.realmLevel).toBe(1)
    expect(result.instance.exp).toBe(30) // 30 < 80 required at qi_refining tier 1
    expect(result.levelsGained).toBe(1)
    expect(result.realmBreakthroughs).toEqual(['qi_refining'])
    expect(result.clampedExp).toBe(0)
  })

  it('chains multiple realm breakthroughs in one apply', () => {
    let amount = companionExpRequiredForLevel('mortal', 18)

    for (let tier = 1; tier <= 18; tier++) {
      amount += companionExpRequiredForLevel('qi_refining', tier)
    }

    amount += 5

    const instance = makeInstance({ realmId: 'mortal', realmLevel: 18, exp: 0 })
    const result = applyCompanionExp(instance, amount, 'foundation_establishment')

    expect(result.instance.realmId).toBe('foundation_establishment')
    expect(result.instance.realmLevel).toBe(1)
    expect(result.instance.exp).toBe(5)
    // 1 mortal level-up (18 -> breakthrough) + 18 qi_refining level-ups (1..18 -> breakthrough)
    expect(result.levelsGained).toBe(19)
    expect(result.realmBreakthroughs).toEqual(['qi_refining', 'foundation_establishment'])
    expect(result.clampedExp).toBe(0)
  })

  it('clamps at the player realm ceiling: leftover exp is discarded, exp resets to 0', () => {
    const required = companionExpRequiredForLevel('mortal', 17)
    const instance = makeInstance({ realmId: 'mortal', realmLevel: 17, exp: 0 })

    const result = applyCompanionExp(instance, required + 300, 'mortal')

    expect(result.instance.realmLevel).toBe(18)
    expect(result.levelsGained).toBe(1)
    expect(result.clampedExp).toBe(300)
    expect(result.instance.exp).toBe(0)
    expect(isCompanionLevelMaxed(result.instance, 'mortal')).toBe(true)
  })

  it('already-maxed instance discards the whole amount', () => {
    const instance = makeInstance({ realmId: 'mortal', realmLevel: 18, exp: 0 })

    const result = applyCompanionExp(instance, 500, 'mortal')

    expect(result.instance.realmLevel).toBe(18)
    expect(result.levelsGained).toBe(0)
    expect(result.clampedExp).toBe(500)
    expect(result.instance.exp).toBe(0)
  })

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    'guards non-positive/non-finite amount %s: returns the input unchanged',
    (amount) => {
      const instance = makeInstance({ exp: 3 })

      const result = applyCompanionExp(instance, amount, 'mortal')

      expect(result.instance).toBe(instance)
      expect(result.levelsGained).toBe(0)
      expect(result.clampedExp).toBe(0)
    },
  )
})

describe('isCompanionLevelMaxed', () => {
  it('true only at the top tier of the player realm', () => {
    expect(isCompanionLevelMaxed(makeInstance({ realmId: 'mortal', realmLevel: 18 }), 'mortal')).toBe(true)
    expect(isCompanionLevelMaxed(makeInstance({ realmId: 'mortal', realmLevel: 17 }), 'mortal')).toBe(false)
    // Same top tier, but the player realm is higher -> not maxed.
    expect(isCompanionLevelMaxed(makeInstance({ realmId: 'mortal', realmLevel: 18 }), 'qi_refining')).toBe(false)
  })
})

describe('applyConstellationRank', () => {
  it('increments rank on a new instance below the cap', () => {
    const instance = makeInstance({ constellationRank: 2 })

    const result = applyConstellationRank(instance)

    expect(result).toEqual({ maxed: false, instance: { ...instance, constellationRank: 3 } })
    expect(instance.constellationRank).toBe(2)
  })

  it('returns maxed at MAX_CONSTELLATION_RANK', () => {
    const result = applyConstellationRank(makeInstance({ constellationRank: MAX_CONSTELLATION_RANK }))

    expect(result).toEqual({ maxed: true })
  })
})

describe('companionStatsAt', () => {
  const definition = makeDefinition() // growthRate 0.05, base {100/10/100}

  it('growthRate 0.05 at global level 21 gives a x2 multiplier', () => {
    // qi_refining tier 3 = 18 mortal tiers + 3 = global level 21.
    const stats = companionStatsAt(definition, makeInstance({ realmId: 'qi_refining', realmLevel: 3 }))

    expect(stats).toEqual({ maxHp: 200, attack: 20, speed: 100 })
  })

  it('speed does not scale with level', () => {
    const stats = companionStatsAt(definition, makeInstance({ realmId: 'mortal', realmLevel: 10 }))

    expect(stats.speed).toBe(100)
  })

  it('constellation rank 3 adds a x1.3 multiplier - including speed', () => {
    const stats = companionStatsAt(
      definition,
      makeInstance({ realmId: 'qi_refining', realmLevel: 3, constellationRank: 3 }),
    )

    expect(stats).toEqual({ maxHp: 260, attack: 26, speed: 130 })
  })

  it('stat perks apply flat first then percent, only when atRank <= constellationRank', () => {
    const withPerk = makeDefinition({
      constellationPerks: [{ atRank: 2, kind: 'stat', stat: 'attack', flat: 5, percent: 50 }],
    })

    // Rank 3: 10 x 2 (growth) x 1.3 (constellation) = 26 -> +5 -> x1.5 = 46.5 -> 47.
    const atRank3 = companionStatsAt(
      withPerk,
      makeInstance({ realmId: 'qi_refining', realmLevel: 3, constellationRank: 3 }),
    )
    expect(atRank3.attack).toBe(47)

    // Rank 1 below atRank 2: perk inactive, 10 x 2 x 1.1 = 22.
    const atRank1 = companionStatsAt(
      withPerk,
      makeInstance({ realmId: 'qi_refining', realmLevel: 3, constellationRank: 1 }),
    )
    expect(atRank1.attack).toBe(22)
  })

  it('speed takes authored stat perks despite ignoring level growth', () => {
    const withSpeedPerk = makeDefinition({
      constellationPerks: [{ atRank: 1, kind: 'stat', stat: 'speed', flat: 10 }],
    })

    const stats = companionStatsAt(withSpeedPerk, makeInstance({ constellationRank: 1 }))

    expect(stats.speed).toBeCloseTo(120) // 100 x 1.1 + 10 (float)
  })
})

describe('isCompanionSkillUnlocked', () => {
  const definition = makeDefinition({
    special: {
      id: 'def_1_special',
      cooldownTurns: 3,
      damage: { kind: 'physical', multiplier: 1.5 },
      targeting: { shape: 'single' },
    },
    unlockThresholds: { special: { realmId: 'qi_refining', realmLevel: 5 } },
  })

  it('basic is always unlocked', () => {
    expect(isCompanionSkillUnlocked(definition, makeInstance(), 'basic')).toBe(true)
  })

  it('special is locked below the realm threshold and unlocked at/above it', () => {
    expect(
      isCompanionSkillUnlocked(definition, makeInstance({ realmId: 'mortal', realmLevel: 18 }), 'special'),
    ).toBe(false)
    expect(
      isCompanionSkillUnlocked(definition, makeInstance({ realmId: 'qi_refining', realmLevel: 4 }), 'special'),
    ).toBe(false)
    expect(
      isCompanionSkillUnlocked(definition, makeInstance({ realmId: 'qi_refining', realmLevel: 5 }), 'special'),
    ).toBe(true)
    // A higher realm index satisfies the threshold regardless of tier.
    expect(
      isCompanionSkillUnlocked(
        definition,
        makeInstance({ realmId: 'foundation_establishment', realmLevel: 1 }),
        'special',
      ),
    ).toBe(true)
  })

  it('returns false when the slot has no declared skill or no threshold', () => {
    const noSkill = makeDefinition({ unlockThresholds: { ultimate: { realmId: 'mortal', realmLevel: 1 } } })
    expect(isCompanionSkillUnlocked(noSkill, makeInstance(), 'ultimate')).toBe(false)

    const noThreshold = makeDefinition({
      ultimate: { id: 'u', cooldownTurns: 5, targeting: { shape: 'single' } },
    })
    expect(isCompanionSkillUnlocked(noThreshold, makeInstance({ realmId: 'tribulation', realmLevel: 9 }), 'ultimate')).toBe(false)
  })
})

describe('resolveCompanionSkillKit', () => {
  const definition = makeDefinition({
    special: {
      id: 'def_1_special',
      cooldownTurns: 3,
      damage: { kind: 'physical', multiplier: 1.5 },
      targeting: { shape: 'single' },
    },
    ultimate: {
      id: 'def_1_ultimate',
      cooldownTurns: 8,
      targeting: { shape: 'single' },
    },
    unlockThresholds: {
      special: { realmId: 'qi_refining', realmLevel: 1 },
      ultimate: { realmId: 'golden_core', realmLevel: 1 },
    },
  })

  it('locked slots are absent from the kit; basic is always present', () => {
    const kit = resolveCompanionSkillKit(definition, makeInstance({ realmId: 'mortal', realmLevel: 5 }))

    expect(kit.basic.id).toBe('def_1_basic')
    expect(kit.special).toBeUndefined()
    expect(kit.ultimate).toBeUndefined()
  })

  it('unlocked special appears once the threshold is met', () => {
    const kit = resolveCompanionSkillKit(definition, makeInstance({ realmId: 'qi_refining', realmLevel: 1 }))

    expect(kit.special?.id).toBe('def_1_special')
    expect(kit.special?.cooldownTurns).toBe(3)
    expect(kit.ultimate).toBeUndefined()
  })

  it('skill_override perks apply only at sufficient rank and never mutate the definition', () => {
    const withPerks = makeDefinition({
      special: definition.special,
      unlockThresholds: definition.unlockThresholds,
      constellationPerks: [
        {
          atRank: 1,
          kind: 'skill_override',
          slot: 'special',
          overrides: { cooldownTurns: 1, damageMultiplierPercent: 20, healPercentOfDamage: 30 },
        },
      ],
    })
    const instance = makeInstance({ realmId: 'qi_refining', realmLevel: 1, constellationRank: 1 })

    const kit = resolveCompanionSkillKit(withPerks, instance)

    expect(kit.special?.cooldownTurns).toBe(1)
    expect(kit.special?.damage?.multiplier).toBeCloseTo(1.8) // 1.5 x 1.2
    expect(kit.special?.healPercentOfDamage).toBe(30)

    // Source definition untouched.
    expect(withPerks.special?.cooldownTurns).toBe(3)
    expect(withPerks.special?.damage?.multiplier).toBe(1.5)
    expect(withPerks.special?.healPercentOfDamage).toBeUndefined()

    // Below the perk rank the raw skill comes through.
    const rank0 = resolveCompanionSkillKit(withPerks, makeInstance({ realmId: 'qi_refining', realmLevel: 1 }))
    expect(rank0.special?.cooldownTurns).toBe(3)
  })

  it('damageMultiplierPercent is a no-op on skills without damage', () => {
    const healOnly = makeDefinition({
      special: { id: 'heal', cooldownTurns: 2, targetScope: 'self', targeting: { shape: 'single' } },
      unlockThresholds: { special: { realmId: 'mortal', realmLevel: 1 } },
      constellationPerks: [
        { atRank: 1, kind: 'skill_override', slot: 'special', overrides: { damageMultiplierPercent: 50 } },
      ],
    })

    const kit = resolveCompanionSkillKit(healOnly, makeInstance({ constellationRank: 1 }))

    expect(kit.special?.damage).toBeUndefined()
    expect(kit.special?.cooldownTurns).toBe(2)
  })

  it('overrides on a still-locked slot do nothing', () => {
    const withPerks = makeDefinition({
      special: definition.special,
      unlockThresholds: definition.unlockThresholds,
      constellationPerks: [
        { atRank: 0, kind: 'skill_override', slot: 'special', overrides: { cooldownTurns: 1 } },
      ],
    })

    const kit = resolveCompanionSkillKit(withPerks, makeInstance({ realmId: 'mortal', realmLevel: 1 }))

    expect(kit.special).toBeUndefined()
  })
})

describe('companionFeedExpValue', () => {
  it('flat 10 for materials without profession meta', () => {
    const material: Material = { id: 'm1', name: 'M1', category: 'other', sourceType: 'monster' }

    expect(companionFeedExpValue(material)).toBe(10)
  })

  it('scales with the profession material realm index', () => {
    const mortal: Material = {
      id: 'm2',
      name: 'M2',
      category: 'ore',
      sourceType: 'exploration',
      profession: { resourceKind: 'ore', realmId: 'mortal' },
    }
    const qiRefining: Material = {
      id: 'm3',
      name: 'M3',
      category: 'ore',
      sourceType: 'exploration',
      profession: { resourceKind: 'ore', realmId: 'qi_refining' },
    }

    expect(companionFeedExpValue(mortal)).toBe(10)
    expect(companionFeedExpValue(qiRefining)).toBe(20)
  })
})
