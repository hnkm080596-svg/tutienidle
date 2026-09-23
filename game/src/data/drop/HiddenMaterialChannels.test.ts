// M-F-BODY-HIDDEN (spec sec.2, plan Step 1.1) - the two test classes on the
// channel registry:
//
//   (a) shape - validate/assert over FIXTURE registries reject malformed
//       channels without touching live catalogs.
//
//   (b) integrity - cross-catalog arms composed HERE (validate stays
//       catalog-free per data/ purity): bandRealmId/enemyId/materialId
//       resolution, enemy realmId === bandRealmId, bound-required on
//       perfection channels, unconditional signature lines (chance: 1,
//       requiresModifier === undefined), band-material coherence,
//       breakthroughRealmId tag census, grotto perfection-only (F3),
//       inverse reachability completeness (r82-H1), and the
//       VISIBLE_GRANT_SOURCES census arms (r84-P1).
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
import {
  BODY_PERFECTION_REALM_MATERIALS,
  bodyPerfectionMaterialIds,
  bodyPerfectionRealmOf,
  isBodyPerfectionMaterial,
  type BodyPerfectionRegistry,
} from '../realm/BodyPerfection'
import { REALMS } from '../realms/realm'
import { ENEMIES } from '../enemy/Enemies'
import { materials } from '../materials/materials'
import { QUESTS } from '../quest/quests'
import { buildings } from '../building/buildings'
import { STAGE_DROP_TABLES } from './StageDropTables'
import { FAMILY_DROP_TABLES } from './FamilyDropTables'
import { defineEnemy, type Enemy } from '../../core/enemy/Enemy'
import type { Material } from '../../core/material/Material'
import type { Quest } from '../../core/quest/Quest'
import type { Building } from '../../core/building/Building'
import type { SignatureDrop } from '../../core/drop/DropTable'

const REALM_IDS = new Set(REALMS.map((realm) => realm.id))

// ----------------------------- fixture builders ------------------------------

function beastChannel(overrides: Partial<HiddenBeastChannel> = {}): HiddenBeastChannel {
  return {
    kind: 'hidden_beast',
    id: 'fixture_beast',
    bandRealmId: 'qi_refining',
    enemyId: 'fixture_enemy',
    killThreshold: 10,
    spawnChancePerSpawn: 0.5,
    guaranteedSpawnAfterKills: 25,
    ...overrides,
  }
}

function grottoChannel(overrides: Partial<GrottoChannel> = {}): GrottoChannel {
  return {
    kind: 'grotto',
    id: 'fixture_grotto',
    bandRealmId: 'qi_refining',
    materialId: 'fixture_material',
    chancePerCycle: 0.1,
    guaranteedAfterCycles: 5,
    ...overrides,
  }
}

function fixtureEnemy(id: string, realmId: string, signatureDrops: SignatureDrop[] = []): Enemy {
  return defineEnemy({
    id,
    name: id,
    level: 1,
    realmId,
    lane: 'ground',
    family: 'hidden_beast',
    statsInput: {
      maxHp: 10,
      might: 1,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
    signatureDrops,
  })
}

function fixtureMaterial(id: string, breakthroughRealmId?: string): Material {
  return {
    id,
    name: id,
    category: 'other',
    sourceType: 'exploration',
    description: '',
    breakthroughRealmId,
  } as Material
}

function fixtureQuest(id: string, materialId?: string): Quest {
  return {
    id,
    name: id,
    description: '',
    reward: materialId
      ? { itemDrops: [{ kind: 'material', itemId: materialId, amount: 1 }] }
      : {},
  } as Quest
}

function fixtureBuilding(id: string, producesMaterialId?: string): Building {
  return {
    id,
    name: id,
    maxLevel: 10,
    producesMaterialId,
  } as Building
}

function emptyRealmMaterials(fill: Record<string, readonly string[]> = {}): BodyPerfectionRegistry {
  const registry: Record<string, readonly string[]> = {}
  for (const realm of REALMS) {
    registry[realm.id] = fill[realm.id] ?? []
  }
  return registry as BodyPerfectionRegistry
}

// ------------------------- cross-catalog integrity ---------------------------
// The census + integrity arms live here because they must read ENEMIES /
// materials / QUESTS / buildings / BODY_PERFECTION_REALM_MATERIALS - a
// production validator in data/drop cannot import its sibling catalogs
// (data/ purity rule). Fixture worlds override the oracles so every arm is
// exercised both on the shipped constant and on synthetic cases.

interface IntegrityWorld {
  enemies?: readonly Enemy[]
  materials?: readonly Material[]
  quests?: readonly Quest[]
  buildings?: readonly Building[]
  realmMaterials?: BodyPerfectionRegistry
}

function checkChannelIntegrity(
  channels: readonly HiddenMaterialChannel[],
  sources: readonly VisibleGrantSource[],
  world: IntegrityWorld = {},
): string[] {
  const issues: string[] = []
  const enemyById = (id: string): Enemy | undefined =>
    (world.enemies ?? []).find((enemy) => enemy.id === id) ?? ENEMIES.find((enemy) => enemy.id === id)
  const materialById = (id: string): Material | undefined =>
    (world.materials ?? []).find((material) => material.id === id) ??
    materials.find((material) => material.id === id)
  const questById = (id: string): Quest | undefined =>
    (world.quests ?? []).find((quest) => quest.id === id) ?? QUESTS.find((quest) => quest.id === id)
  const buildingById = (id: string): Building | undefined =>
    (world.buildings ?? []).find((building) => building.id === id) ??
    buildings.find((building) => building.id === id)
  const realmMaterials = world.realmMaterials ?? BODY_PERFECTION_REALM_MATERIALS
  const perfectionRealmOf = (materialId: string): string | undefined => {
    for (const [realmId, list] of Object.entries(realmMaterials)) {
      if (list.includes(materialId)) return realmId
    }
    return undefined
  }
  const signatureOf = (enemyId: string): SignatureDrop[] => enemyById(enemyId)?.signatureDrops ?? []
  const signatureMaterialIdsOf = (enemyId: string): string[] =>
    signatureOf(enemyId)
      .filter((drop) => drop.kind === 'material' && drop.itemId)
      .map((drop) => drop.itemId!)

  const emittedUnion = new Set<string>()

  for (const channel of channels) {
    const label = `${channel.kind} channel '${channel.id}'`

    if (!REALM_IDS.has(channel.bandRealmId)) {
      issues.push(`${label} bands at unknown realm '${channel.bandRealmId}'`)
    }

    if (channel.kind === 'hidden_beast') {
      const enemy = enemyById(channel.enemyId)
      if (!enemy) {
        issues.push(`${label} references unknown enemy '${channel.enemyId}'`)
      } else if (enemy.realmId !== channel.bandRealmId) {
        issues.push(
          `${label} enemy '${channel.enemyId}' lives at realm '${enemy.realmId}', not band '${channel.bandRealmId}'`,
        )
      }
    } else {
      const material = materialById(channel.materialId)
      if (!material) {
        issues.push(`${label} emits unknown material '${channel.materialId}'`)
      } else if (!perfectionRealmOf(channel.materialId)) {
        // F3 - grotto channel kinds are pinned to perfection materials.
        issues.push(`${label} emits '${channel.materialId}' which is not a perfection material`)
      }
    }

    for (const materialId of channelEmittedMaterialIds(channel, signatureMaterialIdsOf)) {
      emittedUnion.add(materialId)

      if (channel.kind === 'grotto') {
        continue // emitted id === channel.materialId; perfection-only arm above.
      }

      const perfectionRealm = perfectionRealmOf(materialId)
      if (perfectionRealm === undefined) continue

      // Bound-required arm (F4): a perfection route must certify a finite
      // worst case. Per kind: guaranteedSpawnAfterKills / guaranteedAfterCycles.
      if (channel.kind === 'hidden_beast' && channel.guaranteedSpawnAfterKills === undefined) {
        issues.push(`${label} emits perfection material '${materialId}' without a bound`)
      }

      // Band-material coherence (F5): a channel's emitted perfection ids must
      // belong to its own band realm.
      if (perfectionRealm !== channel.bandRealmId) {
        issues.push(
          `${label} emits '${materialId}' which belongs to realm '${perfectionRealm}'`,
        )
      }

      // Tag census: the emitted perfection material's breakthrough tag must
      // equal its perfection realm so the emission gate (r84-F3 /
      // isBreakthroughAcquisitionEnabled) matches.
      const material = materialById(materialId)
      if (material && material.breakthroughRealmId !== perfectionRealm) {
        issues.push(
          `${label} emits '${materialId}' whose breakthroughRealmId '${material.breakthroughRealmId}' != '${perfectionRealm}'`,
        )
      }

      // Unconditional-route arm (r84-P1a): a signature line that counts as a
      // perfection acquisition route must fire on every kill - chance 1 and
      // no requiresModifier gate (a validated condition-source census does
      // not exist yet).
      if (channel.kind === 'hidden_beast') {
        for (const line of signatureOf(channel.enemyId)) {
          if (line.kind !== 'material' || line.itemId !== materialId) continue
          if (line.chance !== 1) {
            issues.push(`${label} perfection line '${materialId}' has chance ${line.chance} < 1`)
          }
          if (line.requiresModifier !== undefined) {
            issues.push(
              `${label} perfection line '${materialId}' is gated by requiresModifier '${line.requiresModifier}'`,
            )
          }
        }
      }
    }
  }

  // Inverse reachability (r82-H1): every perfection material id in the
  // realm-materials table must have at least one authored route - an
  // emitted channel id OR a censused visible grant source.
  for (const list of Object.values(realmMaterials)) {
    for (const materialId of list) {
      const hasChannel = emittedUnion.has(materialId)
      const hasSource = sources.some((source) => source.materialId === materialId)
      if (!hasChannel && !hasSource) {
        issues.push(`perfection material '${materialId}' has no authored acquisition route`)
      }
    }
  }

  // Census validation (r84-P1b): every VISIBLE_GRANT_SOURCES row must name a
  // perfection material in the table AND resolve to a grant that actually
  // delivers that material.
  for (const source of sources) {
    if (perfectionRealmOf(source.materialId) === undefined) {
      issues.push(`visible grant source '${source.grantId}' covers non-perfection '${source.materialId}'`)
      continue
    }
    let delivers = false
    if (source.kind === 'quest') {
      const quest = questById(source.grantId)
      delivers =
        quest?.reward.itemDrops?.some(
          (drop) => drop.kind === 'material' && drop.itemId === source.materialId,
        ) ?? false
    } else if (source.kind === 'building') {
      const building = buildingById(source.grantId)
      delivers = building?.producesMaterialId === source.materialId
    }
    if (!delivers) {
      issues.push(
        `visible grant source '${source.kind}:${source.grantId}' does not deliver '${source.materialId}'`,
      )
    }
    if (emittedUnion.has(source.materialId)) {
      issues.push(`material '${source.materialId}' is double-covered (channel + visible grant)`)
    }
  }

  return issues
}

// ------------------------------ the suite -----------------------------------

describe('HIDDEN_MATERIAL_CHANNELS (shipped constant)', () => {
  it('validates clean at module load and on re-check', () => {
    expect(validateHiddenMaterialChannels(HIDDEN_MATERIAL_CHANNELS)).toEqual([])
    expect(() => assertHiddenMaterialChannels()).not.toThrow()
  })

  it('huyet_mong migrates 1:1 (threshold 1000, chance 0.05, qi_refining band)', () => {
    const channels = hiddenBeastChannels()
    expect(channels.map((channel) => channel.id)).toEqual(['huyet_mong'])
    const huyetMong = channels[0]!
    expect(huyetMong).toMatchObject({
      kind: 'hidden_beast',
      bandRealmId: 'qi_refining',
      enemyId: 'huyet_mong',
      killThreshold: 1000,
      spawnChancePerSpawn: 0.05,
    })
    expect(hiddenGrottoChannels()).toEqual([])
  })

  it('cross-catalog integrity holds on the shipped catalog', () => {
    expect(checkChannelIntegrity(HIDDEN_MATERIAL_CHANNELS, VISIBLE_GRANT_SOURCES)).toEqual([])
  })

  it('completeness vacuously holds while the perfection table ships empty', () => {
    expect(Object.values(BODY_PERFECTION_REALM_MATERIALS).flat()).toEqual([])
  })

  it('channelEmittedMaterialIds maps grotto -> [materialId], beast -> signature ids', () => {
    const grotto = grottoChannel({ materialId: 'm_x' })
    expect(channelEmittedMaterialIds(grotto, () => [])).toEqual(['m_x'])

    const beast = beastChannel({ enemyId: 'enemy_x' })
    expect(channelEmittedMaterialIds(beast, () => ['m_a', 'm_b'])).toEqual(['m_a', 'm_b'])
  })
})

describe('validateHiddenMaterialChannels / assertHiddenMaterialChannels (fixtures)', () => {
  it('accepts well-formed beast + grotto fixture channels', () => {
    const fixture = [beastChannel(), grottoChannel()]
    expect(validateHiddenMaterialChannels(fixture)).toEqual([])
    expect(() => assertHiddenMaterialChannels(fixture)).not.toThrow()
  })

  it('rejects duplicate channel ids', () => {
    const fixture = [beastChannel({ id: 'dup' }), grottoChannel({ id: 'dup' })]
    expect(validateHiddenMaterialChannels(fixture).some((issue) => issue.includes('dup'))).toBe(true)
    expect(() => assertHiddenMaterialChannels(fixture)).toThrowError(/dup/)
  })

  it('rejects an empty id / bandRealmId', () => {
    expect(validateHiddenMaterialChannels([beastChannel({ id: '' })]).length).toBeGreaterThan(0)
    expect(validateHiddenMaterialChannels([beastChannel({ bandRealmId: '' })]).length).toBeGreaterThan(0)
  })

  it('rejects non-integer / non-positive killThreshold', () => {
    expect(validateHiddenMaterialChannels([beastChannel({ killThreshold: 0 })]).length).toBeGreaterThan(0)
    expect(validateHiddenMaterialChannels([beastChannel({ killThreshold: 2.5 })]).length).toBeGreaterThan(0)
  })

  it('rejects chance outside (0, 1]', () => {
    expect(validateHiddenMaterialChannels([beastChannel({ spawnChancePerSpawn: 0 })]).length).toBeGreaterThan(0)
    expect(validateHiddenMaterialChannels([beastChannel({ spawnChancePerSpawn: 1.5 })]).length).toBeGreaterThan(0)
    expect(validateHiddenMaterialChannels([grottoChannel({ chancePerCycle: -0.1 })]).length).toBeGreaterThan(0)
  })

  it('rejects guaranteedSpawnAfterKills < killThreshold', () => {
    const fixture = [beastChannel({ killThreshold: 10, guaranteedSpawnAfterKills: 5 })]
    expect(validateHiddenMaterialChannels(fixture).length).toBeGreaterThan(0)
  })

  it('rejects non-integer / non-positive guaranteedAfterCycles', () => {
    expect(validateHiddenMaterialChannels([grottoChannel({ guaranteedAfterCycles: 0 })]).length).toBeGreaterThan(0)
    expect(validateHiddenMaterialChannels([grottoChannel({ guaranteedAfterCycles: 1.5 })]).length).toBeGreaterThan(0)
  })

  it('rejects two hidden_beast channels sharing (bandRealmId, enemyId)', () => {
    const fixture = [
      beastChannel({ id: 'beast_a', enemyId: 'shared_enemy' }),
      beastChannel({ id: 'beast_b', enemyId: 'shared_enemy' }),
    ]
    expect(
      validateHiddenMaterialChannels(fixture).some((issue) => issue.includes('shared_enemy')),
    ).toBe(true)
  })
})

describe('cross-catalog integrity arms (fixture worlds)', () => {
  const PERF = 'bp_qi_perfection'
  const REALM_MATERIALS: BodyPerfectionRegistry = emptyRealmMaterials({ qi_refining: [PERF] })
  const PERF_MATERIAL = fixtureMaterial(PERF, 'qi_refining')
  const PERF_LINE: SignatureDrop = { kind: 'material', itemId: PERF, amount: { min: 1, max: 1 }, chance: 1 }
  const PERF_ENEMY = fixtureEnemy('perf_beast', 'qi_refining', [PERF_LINE])

  function world(extra: Partial<IntegrityWorld> = {}): IntegrityWorld {
    return {
      enemies: [PERF_ENEMY],
      materials: [PERF_MATERIAL],
      realmMaterials: REALM_MATERIALS,
      ...extra,
    }
  }

  function perfBeastChannel(overrides: Partial<HiddenBeastChannel> = {}): HiddenBeastChannel {
    return beastChannel({ enemyId: 'perf_beast', killThreshold: 10, ...overrides })
  }

  it('a complete perfection route (bound + unconditional line + coherent band) passes', () => {
    expect(checkChannelIntegrity([perfBeastChannel()], [], world())).toEqual([])
  })

  it('unknown bandRealmId / enemyId / materialId each fail', () => {
    expect(
      checkChannelIntegrity([perfBeastChannel({ bandRealmId: 'not_a_realm' })], [], world())
        .some((issue) => issue.includes('not_a_realm')),
    ).toBe(true)

    expect(
      checkChannelIntegrity([perfBeastChannel({ enemyId: 'ghost_enemy' })], [], world())
        .some((issue) => issue.includes('ghost_enemy')),
    ).toBe(true)

    expect(
      checkChannelIntegrity([grottoChannel({ materialId: 'ghost_material' })], [], world())
        .some((issue) => issue.includes('ghost_material')),
    ).toBe(true)
  })

  it('channel enemy living at a different realm than its band fails', () => {
    const strayEnemy = fixtureEnemy('perf_beast', 'foundation_establishment', [PERF_LINE])
    const issues = checkChannelIntegrity([perfBeastChannel()], [], world({ enemies: [strayEnemy] }))
    expect(issues.some((issue) => issue.includes('foundation_establishment'))).toBe(true)
  })

  it('perfection channel without a bound fails (F4)', () => {
    const unbound = perfBeastChannel({ guaranteedSpawnAfterKills: undefined })
    const issues = checkChannelIntegrity([unbound], [], world())
    expect(issues.some((issue) => issue.includes('bound'))).toBe(true)
  })

  it('perfection signature line with chance < 1 or requiresModifier fails (r84-P1a)', () => {
    const lowChance = fixtureEnemy('perf_beast', 'qi_refining', [{ ...PERF_LINE, chance: 0.5 }])
    expect(
      checkChannelIntegrity([perfBeastChannel()], [], world({ enemies: [lowChance] }))
        .some((issue) => issue.includes('chance')),
    ).toBe(true)

    const gated = fixtureEnemy('perf_beast', 'qi_refining', [
      { ...PERF_LINE, requiresModifier: 'night_spawn' },
    ])
    expect(
      checkChannelIntegrity([perfBeastChannel()], [], world({ enemies: [gated] }))
        .some((issue) => issue.includes('requiresModifier')),
    ).toBe(true)
  })

  it('band-material incoherence fails (F5): emitted perfection id belongs to another realm', () => {
    const wrongBand = perfBeastChannel({ bandRealmId: 'foundation_establishment' })
    const enemyAtBand = fixtureEnemy('perf_beast', 'foundation_establishment', [PERF_LINE])
    const issues = checkChannelIntegrity(
      [wrongBand],
      [],
      world({ enemies: [enemyAtBand] }),
    )
    // Enemy realmId === bandRealmId passes the residence check, but the
    // emitted material belongs to qi_refining -> coherence fails.
    expect(issues.some((issue) => issue.includes('belongs to realm'))).toBe(true)
  })

  it('breakthroughRealmId tag census fails when the tag mismatches the perfection realm', () => {
    const mistagged = fixtureMaterial(PERF, 'foundation_establishment')
    const issues = checkChannelIntegrity(
      [perfBeastChannel()],
      [],
      world({ materials: [mistagged] }),
    )
    expect(issues.some((issue) => issue.includes('breakthroughRealmId'))).toBe(true)
  })

  it('grotto channel on a non-perfection material fails (F3)', () => {
    const plainMaterial = fixtureMaterial('plain_drop')
    const channel = grottoChannel({ materialId: 'plain_drop' })
    const issues = checkChannelIntegrity(
      [channel],
      [],
      world({ materials: [PERF_MATERIAL, plainMaterial] }),
    )
    expect(issues.some((issue) => issue.includes('not a perfection material'))).toBe(true)
  })

  it('grotto channel emitting a coherent perfection material passes', () => {
    const channel = grottoChannel({ materialId: PERF })
    expect(
      checkChannelIntegrity([channel], [], world()),
    ).toEqual([])
  })

  it('inverse reachability (r82-H1): a table material with no route fails', () => {
    // Table requires PERF but no channel emits it and no source covers it.
    const issues = checkChannelIntegrity([], [], world())
    expect(issues.some((issue) => issue.includes('no authored acquisition route'))).toBe(true)
  })

  it('inverse reachability passes via a census row (visible grant route)', () => {
    const quest = fixtureQuest('q_grant', PERF)
    const sources: VisibleGrantSource[] = [
      { materialId: PERF, kind: 'quest', grantId: 'q_grant' },
    ]
    const issues = checkChannelIntegrity([], sources, world({ quests: [quest] }))
    expect(issues).toEqual([])
  })

  it('census arms: non-perfection row, unresolved grant, non-delivering grant, double coverage all fail', () => {
    // Row covering a material not in the table.
    expect(
      checkChannelIntegrity(
        [],
        [{ materialId: 'not_perfection', kind: 'quest', grantId: 'q' }],
        world(),
      ).some((issue) => issue.includes('not_perfection')),
    ).toBe(true)

    // Grant id does not resolve in its owning catalog.
    expect(
      checkChannelIntegrity(
        [],
        [{ materialId: PERF, kind: 'quest', grantId: 'ghost_quest' }],
        world(),
      ).some((issue) => issue.includes('does not deliver')),
    ).toBe(true)

    // Quest exists but drops a different material.
    const wrongQuest = fixtureQuest('q_wrong', 'other_material')
    expect(
      checkChannelIntegrity(
        [],
        [{ materialId: PERF, kind: 'quest', grantId: 'q_wrong' }],
        world({ quests: [wrongQuest] }),
      ).some((issue) => issue.includes('does not deliver')),
    ).toBe(true)

    // Building source that produces the material passes; wrong production fails.
    const goodBuilding = fixtureBuilding('b_good', PERF)
    expect(
      checkChannelIntegrity(
        [],
        [{ materialId: PERF, kind: 'building', grantId: 'b_good' }],
        world({ buildings: [goodBuilding] }),
      ),
    ).toEqual([])

    const badBuilding = fixtureBuilding('b_bad', 'other_material')
    expect(
      checkChannelIntegrity(
        [],
        [{ materialId: PERF, kind: 'building', grantId: 'b_bad' }],
        world({ buildings: [badBuilding] }),
      ).some((issue) => issue.includes('does not deliver')),
    ).toBe(true)

    // Material covered by BOTH a channel and a census row fails.
    const duplicateQuest = fixtureQuest('q_dup', PERF)
    expect(
      checkChannelIntegrity(
        [perfBeastChannel()],
        [{ materialId: PERF, kind: 'quest', grantId: 'q_dup' }],
        world({ quests: [duplicateQuest] }),
      ).some((issue) => issue.includes('double-covered')),
    ).toBe(true)
  })
})

describe('registry-vs-loot invariant (plan Step 1.8)', () => {
  it('no non-channel enemy signature line carries a perfection material', () => {
    const channelEnemyIds = new Set(hiddenBeastChannels().map((channel) => channel.enemyId))
    for (const enemy of ENEMIES) {
      if (channelEnemyIds.has(enemy.id)) continue
      for (const line of enemy.signatureDrops ?? []) {
        if (line.kind === 'material' && line.itemId) {
          expect(
            isBodyPerfectionMaterial(line.itemId),
            `non-channel enemy '${enemy.id}' carries perfection material '${line.itemId}'`,
          ).toBe(false)
        }
      }
    }
  })

  it('channel-enemy perfection lines are unconditional at shipped data (vacuous until content pass)', () => {
    for (const channel of hiddenBeastChannels()) {
      const enemy = ENEMIES.find((entry) => entry.id === channel.enemyId)
      expect(enemy, `channel '${channel.id}' enemy '${channel.enemyId}' missing`).toBeDefined()
      for (const line of enemy!.signatureDrops ?? []) {
        if (line.kind === 'material' && line.itemId && bodyPerfectionRealmOf(line.itemId)) {
          expect(line.chance).toBe(1)
          expect(line.requiresModifier).toBeUndefined()
        }
      }
    }
  })

  it('stage + family drop tables carry no perfection material id', () => {
    const checkEntries = (
      entries: readonly { kind: string; itemId?: string }[],
      where: string,
    ) => {
      for (const entry of entries) {
        if (entry.kind === 'material' && entry.itemId) {
          expect(
            isBodyPerfectionMaterial(entry.itemId),
            `${where} carries perfection material '${entry.itemId}'`,
          ).toBe(false)
        }
      }
    }
    for (const table of STAGE_DROP_TABLES) {
      checkEntries(table.guaranteed, `stage table '${table.realmId}' guaranteed`)
      checkEntries(table.pool, `stage table '${table.realmId}' pool`)
    }
    for (const table of FAMILY_DROP_TABLES) {
      checkEntries(table.guaranteed, `family table '${table.familyId}' guaranteed`)
      checkEntries(table.pool, `family table '${table.familyId}' pool`)
    }
  })
})
