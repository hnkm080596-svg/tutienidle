// M-F-BODY-HIDDEN (spec sec.2, plan Step 1.1) - the two test classes on the
// channel registry:
//
//   (a) shape - validate/assert over FIXTURE registries reject malformed
//       channels without touching live catalogs.
//
//   (b) integrity - cross-catalog arms composed HERE (validate stays
//       catalog-free per data/ purity): bandRealmId/enemyId/materialId
//       resolution, enemy realmId === bandRealmId, and the hidden-only
//       invariant (a channel-emitted material never rides a normal loot
//       surface: stage tables, family tables, non-channel signature lines).
//
// 2026-09-23 hidden-perfection-lineage sec.19: the perfection-TRANSFORMATION
// arms retired with BodyPerfection - this infra is generic hidden-
// acquisition plumbing now ("it emits loot, it does not transform").
// B/C author their own acquisition-material registries on top.
import { describe, expect, it } from 'vitest'
import {
  GROTTO_CHANNEL_SEED_TAG,
  HIDDEN_MATERIAL_CHANNELS,
  VISIBLE_GRANT_SOURCES,
  assertHiddenMaterialChannels,
  channelEmittedMaterialIds,
  hiddenBeastChannels,
  hiddenGrottoChannels,
  validateHiddenMaterialChannels,
  type GrottoChannel,
  type HiddenBeastChannel,
  type HiddenMaterialChannel,
  type VisibleGrantSource,
} from './HiddenMaterialChannels'
import { REALMS } from '../realms/realm'
import { ENEMIES } from '../enemy/Enemies'
import { materials } from '../materials/materials'
import { QUESTS } from '../quest/quests'
import { buildings } from '../building/buildings'
import { defineEnemy, type Enemy } from '../../core/enemy/Enemy'
import type { Material } from '../../core/material/Material'
import type { SignatureDrop } from '../../core/drop/DropTable'

// ----------------------------- fixture builders ------------------------------

function beastChannel(overrides: Partial<HiddenBeastChannel> = {}): HiddenBeastChannel {
  return {
    kind: 'hidden_beast',
    id: 'fixture_beast',
    bandRealmId: 'qi_refining',
    enemyId: 'fixture_enemy',
    killThreshold: 10,
    spawnChancePerSpawn: 0.1,
    ...overrides,
  }
}

function grottoChannel(overrides: Partial<GrottoChannel> = {}): GrottoChannel {
  return {
    kind: 'grotto',
    id: 'fixture_grotto',
    bandRealmId: 'qi_refining',
    materialId: 'fixture_material',
    chancePerCycle: 0.2,
    ...overrides,
  }
}

// ------------------------- fixture catalog builders --------------------------

function fixtureEnemy(id: string, realmId: string, signatureMaterialIds: readonly string[] = []): Enemy {
  return defineEnemy({
    id,
    name: id,
    level: 1,
    realmId,
    lane: 'ground',
    statsInput: {
      maxHp: 1,
      might: 1,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
    signatureDrops: signatureMaterialIds.map(
      (itemId): SignatureDrop => ({ kind: 'material', itemId, chance: 1, amount: { min: 1, max: 1 } }),
    ),
  })
}

/** Minimal catalog bundle the integrity arms consult. */
interface FixtureWorld {
  realms: readonly { id: string }[]
  enemies: readonly Enemy[]
  materials: readonly Material[]
}

function world(overrides: Partial<FixtureWorld> = {}): FixtureWorld {
  return {
    realms: [{ id: 'qi_refining' }],
    enemies: [fixtureEnemy('fixture_enemy', 'qi_refining', ['fixture_material'])],
    materials: [{ id: 'fixture_material' } as Material],
    ...overrides,
  }
}

/**
 * The generic cross-catalog arms a channel registry must satisfy,
 * whatever material it emits: every referenced entity resolves, and a
 * hidden_beast's channel enemy lives inside its declared band realm.
 */
function checkChannelIntegrity(
  channels: readonly HiddenMaterialChannel[],
  worldNow: FixtureWorld,
): string[] {
  const issues: string[] = []
  const realmIds = new Set(worldNow.realms.map((realm) => realm.id))
  const materialIds = new Set(worldNow.materials.map((material) => material.id))

  for (const channel of channels) {
    const label = `channel '${channel.id}'`
    if (!realmIds.has(channel.bandRealmId)) {
      issues.push(`${label} bandRealmId '${channel.bandRealmId}' khong ton tai`)
      continue
    }

    if (channel.kind === 'hidden_beast') {
      const enemy = worldNow.enemies.find((e) => e.id === channel.enemyId)
      if (enemy === undefined) {
        issues.push(`${label} enemyId '${channel.enemyId}' khong ton tai`)
      } else if (enemy.realmId !== channel.bandRealmId) {
        issues.push(`${label} enemy '${channel.enemyId}' song o realm '${enemy.realmId}', khong phai band '${channel.bandRealmId}'`)
      }
    } else {
      if (!materialIds.has(channel.materialId)) {
        issues.push(`${label} materialId '${channel.materialId}' khong ton tai`)
      }
    }
  }

  return issues
}

// ----------------------------- shipped constant ------------------------------

describe('HIDDEN_MATERIAL_CHANNELS (shipped constant)', () => {
  it('validates clean at module load and on re-check', () => {
    expect(validateHiddenMaterialChannels(HIDDEN_MATERIAL_CHANNELS)).toEqual([])
    expect(() => assertHiddenMaterialChannels(HIDDEN_MATERIAL_CHANNELS)).not.toThrow()
  })

  it('huyet_mong migrates 1:1 (threshold 1000, chance 0.05, qi_refining band)', () => {
    expect(HIDDEN_MATERIAL_CHANNELS).toHaveLength(1)
    const channel = HIDDEN_MATERIAL_CHANNELS[0]!
    expect(channel.kind).toBe('hidden_beast')
    const beast = channel as HiddenBeastChannel
    expect(beast.id).toBe('huyet_mong')
    expect(beast.enemyId).toBe('huyet_mong')
    expect(beast.bandRealmId).toBe('qi_refining')
    expect(beast.killThreshold).toBe(1000)
    expect(beast.spawnChancePerSpawn).toBe(0.05)
  })

  it('cross-catalog integrity holds on the shipped catalog', () => {
    const shipped: FixtureWorld = { realms: REALMS, enemies: ENEMIES, materials }
    expect(checkChannelIntegrity(HIDDEN_MATERIAL_CHANNELS, shipped)).toEqual([])
  })

  it('channelEmittedMaterialIds maps grotto -> [materialId], beast -> signature ids', () => {
    const beast = beastChannel()
    const emitted = channelEmittedMaterialIds(beast, (enemyId) =>
      enemyId === 'fixture_enemy' ? ['sig_a', 'sig_b'] : [],
    )
    expect(emitted).toEqual(['sig_a', 'sig_b'])

    const grotto = grottoChannel()
    expect(channelEmittedMaterialIds(grotto, () => [])).toEqual(['fixture_material'])
  })

  it('hidden-only invariant: no channel-emitted material rides a non-channel signature drop', () => {
    // The signature line is the real leak vector: a hidden-channel
    // material authored onto a normal enemy's signatureDrops would hand
    // it to any normal kill. Stage/family tables legitimately host
    // shared normal materials the channel beast may also drop (the
    // documented M-QI-08 pham catch-up rides them), so table presence
    // is not a violation - exclusivity is pinned on signatures only.
    const channelEnemyIds = new Set(
      hiddenBeastChannels().map((channel) => channel.enemyId),
    )
    const normalSignatureIds = new Set<string>()
    for (const enemy of ENEMIES) {
      if (channelEnemyIds.has(enemy.id)) {
        continue
      }
      for (const drop of enemy.signatureDrops ?? []) {
        if (drop.kind === 'material' && drop.itemId) {
          normalSignatureIds.add(drop.itemId)
        }
      }
    }

    for (const channel of HIDDEN_MATERIAL_CHANNELS) {
      for (const materialId of channelEmittedMaterialIds(channel, (enemyId) => {
        const enemy = ENEMIES.find((e) => e.id === enemyId)
        return (enemy?.signatureDrops ?? [])
          .filter((drop) => drop.kind === 'material')
          .map((drop) => drop.itemId!)
      })) {
        expect(normalSignatureIds.has(materialId)).toBe(false)
      }
    }
  })

  it('VISIBLE_GRANT_SOURCES ships as an empty census; grant catalogs exist for B/C content', () => {
    expect(VISIBLE_GRANT_SOURCES).toEqual([])
    const fixtureRow: VisibleGrantSource = { materialId: 'm', kind: 'quest', grantId: 'g' }
    expect(fixtureRow.materialId).toBe('m')
    expect(GROTTO_CHANNEL_SEED_TAG).toBeTypeOf('number')
    // The census contract: a grant source id must resolve on the real
    // catalogs once authored - exercised here on fixtures only.
    expect(QUESTS.length).toBeGreaterThan(0)
    expect(buildings.length).toBeGreaterThan(0)
  })
})

// --------------------------- shape validation arms ---------------------------

describe('validateHiddenMaterialChannels / assertHiddenMaterialChannels (fixtures)', () => {
  it('accepts well-formed beast + grotto fixture channels', () => {
    expect(validateHiddenMaterialChannels([beastChannel(), grottoChannel()])).toEqual([])
  })

  it('rejects duplicate channel ids', () => {
    const issues = validateHiddenMaterialChannels([
      beastChannel({ id: 'dup' }),
      grottoChannel({ id: 'dup' }),
    ])
    expect(issues.some((issue) => issue.includes('dup'))).toBe(true)
  })

  it('rejects an empty id / bandRealmId', () => {
    const issues = validateHiddenMaterialChannels([
      beastChannel({ id: '', bandRealmId: '' }),
      grottoChannel({ id: '', bandRealmId: '' }),
    ])
    expect(issues.length).toBeGreaterThanOrEqual(4)
  })

  it('rejects non-integer / non-positive killThreshold', () => {
    for (const bad of [0, -1, 1.5]) {
      expect(
        validateHiddenMaterialChannels([beastChannel({ killThreshold: bad })]).length,
      ).toBeGreaterThan(0)
    }
  })

  it('rejects chance outside (0, 1]', () => {
    for (const bad of [0, -0.1, 1.1]) {
      expect(
        validateHiddenMaterialChannels([beastChannel({ spawnChancePerSpawn: bad })]).length,
      ).toBeGreaterThan(0)
      expect(
        validateHiddenMaterialChannels([grottoChannel({ chancePerCycle: bad })]).length,
      ).toBeGreaterThan(0)
    }
  })

  it('rejects guaranteedSpawnAfterKills < killThreshold', () => {
    const issues = validateHiddenMaterialChannels([
      beastChannel({ killThreshold: 10, guaranteedSpawnAfterKills: 5 }),
    ])
    expect(issues.length).toBe(1)
    // >= killThreshold is legal (the bound means something only inside the window)
    expect(
      validateHiddenMaterialChannels([
        beastChannel({ killThreshold: 10, guaranteedSpawnAfterKills: 10 }),
      ]),
    ).toEqual([])
  })

  it('rejects non-integer / non-positive guaranteedAfterCycles', () => {
    for (const bad of [0, -1, 2.5]) {
      expect(
        validateHiddenMaterialChannels([grottoChannel({ guaranteedAfterCycles: bad })]).length,
      ).toBeGreaterThan(0)
    }
  })

  it('rejects two hidden_beast channels sharing (bandRealmId, enemyId)', () => {
    const issues = validateHiddenMaterialChannels([
      beastChannel({ id: 'a' }),
      beastChannel({ id: 'b' }),
    ])
    expect(issues.some((issue) => issue.includes('cung (band, enemy)'))).toBe(true)
  })

  it('assert throws on malformed registries', () => {
    expect(() => assertHiddenMaterialChannels([beastChannel({ id: '' })])).toThrow()
  })
})

// ---------------------------- integrity arms -------------------------------

describe('cross-catalog integrity arms (fixture worlds)', () => {
  it('a complete channel route (resolvable refs + coherent band) passes', () => {
    expect(checkChannelIntegrity([beastChannel(), grottoChannel()], world())).toEqual([])
  })

  it('unknown bandRealmId / enemyId / materialId each fail', () => {
    expect(
      checkChannelIntegrity([beastChannel({ bandRealmId: 'missing' })], world()).length,
    ).toBeGreaterThan(0)
    expect(
      checkChannelIntegrity([beastChannel({ enemyId: 'missing' })], world()).length,
    ).toBeGreaterThan(0)
    expect(
      checkChannelIntegrity([grottoChannel({ materialId: 'missing' })], world()).length,
    ).toBeGreaterThan(0)
  })

  it('channel enemy living at a different realm than its band fails', () => {
    const mismatchedWorld = world({
      enemies: [fixtureEnemy('fixture_enemy', 'mortal', ['fixture_material'])],
    })
    const issues = checkChannelIntegrity([beastChannel()], mismatchedWorld)
    expect(issues.some((issue) => issue.includes('realm'))).toBe(true)
  })
})
