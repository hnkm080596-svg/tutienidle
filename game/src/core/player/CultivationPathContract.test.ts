/**
 * Cultivation Path Framework contract runner (M10, spec -28) -
 * `runCultivationPathContractTests(module)` applies the structural way
 * contract to every registered path module, so a NEW path/way is held
 * to the same shape the moment it is added to the catalog.
 *
 * Also pins the node-side wiring: way ids are globally unique but
 * still PATH-OWNED ('sword_pathway' belongs to the sword module
 * alone), so a node carrying `requiredWay` must also carry
 * `requiredCultivationPath`, and the
 * pair must resolve in the catalog - otherwise a way-gated node would
 * open to a same-named way on the wrong path.
 */
import { describe, expect, it } from 'vitest'
import {
  CULTIVATION_PATH_MODULES,
  CULTIVATION_PATH_WAY_IDS,
  getActiveWayDefinition,
  HIDDEN_SPELL_REQUIRED_SKILLS,
  type CultivationPathId,
  type CultivationPathModule,
  type CultivationWayId,
  type PathWayDefinition,
} from './CultivationPathKit'
import { createDefaultPlayer } from './Player'
import { listOfferableWays } from './CultivationPathSystem'
import { RESPEC_PRESERVED_NODE_IDS } from '../game/GameManagerProgressionOps'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import { CANONICAL_REALM_PASSIVE_LADDER } from '../../data/progression/RealmPassiveLadder'
import { isMortalPrecursorSkillId } from '../skill/MortalPrecursors'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import { SKILLS } from '../../data/skill/Skills'
import { BASIC_ATTACKS_BY_BUILD, THUY_GIAP_LONG_WATER_SURGE } from '../../data/skill/TurnBasicAttacks'
import { KIEM_PHO_ORBS } from '../../data/skill/KiemPhoOrbs'
import { NGU_KIEM_THUAT } from '../../data/skill/NguKiemDaoSkills'
import {
  BAT_TU_BA_THE,
  PHAN_KICH,
  QUAN_THE,
  SON_NHAC,
  THAM_THE,
  THE_TU_KIT_BY_ROOT,
  TRO_KICH,
  TRONG_PHAN_KICH,
} from '../../data/skill/TheTuSkills'
import { PHAP_TU_EMPOWERED_ULTS } from '../../data/skill/PhapTuEmpoweredUlts'

// P1-M2 - the skill-id universe ownedContent refs resolve against: the
// learnable template catalog (SKILLS) plus every authored
// TurnSkillDefinition source (there is no central turn-skill registry -
// the same sources the display-meta sweep enumerates).
const KNOWN_SKILL_IDS: ReadonlySet<string> = new Set<string>([
  ...SKILLS.map((skill) => skill.id),
  ...Object.values(BASIC_ATTACKS_BY_BUILD).map((def) => def.id),
  THUY_GIAP_LONG_WATER_SURGE.id,
  ...Object.values(KIEM_PHO_ORBS).map((def) => def.id),
  NGU_KIEM_THUAT.id,
  ...Object.values(THE_TU_KIT_BY_ROOT).flatMap((kit) => [
    kit.basic.id,
    kit.special.id,
  ]),
  // Parked post-beta ultimates - authored defs, referenced by
  // ownedContent but never granted inside the beta realm window.
  BAT_TU_BA_THE.id,
  SON_NHAC.id,
  THAM_THE.id,
  QUAN_THE.id,
  PHAN_KICH.id,
  TRO_KICH.id,
  TRONG_PHAN_KICH.id,
  ...Object.values(PHAP_TU_EMPOWERED_ULTS).flatMap((byVariant) =>
    Object.values(byVariant).map((def) => def.id),
  ),
])

const ALL_NODES: readonly ProgressionNode[] = [
  ...PHAP_TU_NODES,
  ...PHAP_TU_AN_NODES,
  ...KIEM_TU_NODES,
  ...THE_TU_NODES,
  ...THE_TU_AN_NODES,
]

const NODE_BY_ID = new Map<string, ProgressionNode>(ALL_NODES.map((node) => [node.id, node]))

function expectWellFormedWay(way: PathWayDefinition, moduleId: CultivationPathId, wayKey: string) {
  expect(way.id, `${moduleId}.${wayKey}: way.id must equal its catalog key`).toBe(wayKey)
  expect(way.pathId, `${moduleId}.${wayKey}: way.pathId must equal the module id`).toBe(moduleId)
  expect(way.name.trim().length, `${moduleId}.${wayKey}: name`).toBeGreaterThan(0)
  expect(way.techniqueId.trim().length, `${moduleId}.${wayKey}: techniqueId`).toBeGreaterThan(0)

  if (way.offerGate) {
    const { requiresSkillLevel, requiresSkillCastLevel } = way.offerGate
    expect(
      requiresSkillLevel !== undefined || requiresSkillCastLevel !== undefined,
      `${moduleId}.${wayKey}: offerGate declares no requirement`,
    ).toBe(true)
    for (const req of [requiresSkillLevel, requiresSkillCastLevel]) {
      if (req) {
        expect(req.skillId.trim().length).toBeGreaterThan(0)
        expect(Number.isInteger(req.level) && req.level >= 1).toBe(true)
      }
    }
  }

  for (const [label, ids] of [
    ['skillIds', way.skillIds],
    ['ownedContent.skillIds', way.ownedContent?.skillIds],
    ['ownedContent.buffIds', way.ownedContent?.buffIds],
  ] as const) {
    if (ids) {
      expect(ids.every((id) => typeof id === 'string' && id.trim().length > 0)).toBe(true)
      expect(new Set(ids).size, `${moduleId}.${wayKey}: duplicate ${label}`).toBe(ids.length)
    }
  }

  // P7-M4 - a declared starter basic is always a mortal precursor
  // (the only skills a fresh way player can already know).
  if (way.starterBasicSkillId !== undefined) {
    expect(
      isMortalPrecursorSkillId(way.starterBasicSkillId),
      `${moduleId}.${wayKey}: starterBasicSkillId must be a mortal precursor`,
    ).toBe(true)
  }

  // P1-M2 - a declared ownedContent must own something.
  if (way.ownedContent !== undefined) {
    expect(
      (way.ownedContent.skillIds?.length ?? 0) + (way.ownedContent.buffIds?.length ?? 0),
      `${moduleId}.${wayKey}: ownedContent declares nothing`,
    ).toBeGreaterThan(0)
  }

  if (way.stats) {
    expect(way.stats.domains.length, `${moduleId}.${wayKey}: stats.domains`).toBeGreaterThan(0)
    for (const domain of Object.keys(way.stats.deltaDerivers ?? {})) {
      expect(
        way.stats.domains,
        `${moduleId}.${wayKey}: deltaDeriver for undeclared domain '${domain}'`,
      ).toContain(domain)
    }
  }

  // P1 - capability ownership: every declared capability id carries the
  // owning path's prefix, static and conditional sets are disjoint, and a
  // conditional entry's record key IS the capability id it resolves.
  const staticCaps = way.capabilities?.static ?? []
  const conditionalCaps = Object.keys(way.capabilities?.conditional ?? {})

  for (const cap of [...staticCaps, ...conditionalCaps]) {
    expect(
      cap.startsWith(`${moduleId}.`),
      `${moduleId}.${wayKey}: capability '${cap}' is not prefixed by owning path '${moduleId}.'`,
    ).toBe(true)
  }

  for (const cap of conditionalCaps) {
    expect(
      staticCaps,
      `${moduleId}.${wayKey}: capability '${cap}' declared both static and conditional`,
    ).not.toContain(cap)
  }

  expect(
    new Set(staticCaps).size,
    `${moduleId}.${wayKey}: duplicate static capability`,
  ).toBe(staticCaps.length)

  // P1-M3 - a subpath axis's requiresCapability must be a STATIC
  // capability the SAME way declares: resolveSubpathAxis gates with
  // hasStaticPathCapability, so a conditional (or foreign/undeclared)
  // cap would render the axis permanently unreadable.
  for (const [axisId, axis] of Object.entries(way.subpaths ?? {})) {
    expect(
      axis !== undefined && typeof axis.state === 'string' && axis.state.trim().length > 0,
      `${moduleId}.${wayKey}: subpath '${axisId}' must declare its owned persisted field (state)`,
    ).toBe(true)
    if (axis?.requiresCapability !== undefined) {
      expect(
        staticCaps,
        `${moduleId}.${wayKey}: subpath '${axisId}' requires non-static capability '${axis.requiresCapability}'`,
      ).toContain(axis.requiresCapability)
    }
  }

  if (way.nodeTreeTag !== undefined) {
    expect(
      way.nodeTreeTag.trim().length,
      `${moduleId}.${wayKey}: nodeTreeTag must be a non-empty string`,
    ).toBeGreaterThan(0)
  }

  // grantedNodeIds - every member must resolve, be grant-only (or
  // cost-0), sit on the declaring way's tag subtree (requiredWay +
  // requiredCultivationPath stamps), and be respec-preserved;
  // otherwise grantSkillCore grants a purchasable node and respec/
  // devReset revokes it while refunding a cost never paid
  // (refund-oscillation loop).
  for (const nodeId of way.grantedNodeIds ?? []) {
    const node = NODE_BY_ID.get(nodeId)
    expect(
      node,
      `${moduleId}.${wayKey}: grantedNodeIds member '${nodeId}' not in catalog`,
    ).toBeDefined()
    if (node !== undefined) {
      expect(
        node.grantedOnly === true || node.insightCost === 0,
        `${moduleId}.${wayKey}: grantedNodeIds member '${nodeId}' is not grant-only/cost-0`,
      ).toBe(true)
      expect(
        node.requiredWay === way.id && node.requiredCultivationPath === moduleId,
        `${moduleId}.${wayKey}: grantedNodeIds member '${nodeId}' not tagged to declaring way`,
      ).toBe(true)
      expect(
        RESPEC_PRESERVED_NODE_IDS,
        `${moduleId}.${wayKey}: grantedNodeIds member '${nodeId}' is not respec-preserved`,
      ).toContain(nodeId)
    }
  }

  if (way.realmRewards) {
    for (const [realmId, reward] of Object.entries(way.realmRewards)) {
      expect(
        reward.artifactId !== undefined ||
          reward.passiveSkillId !== undefined,
        `${moduleId}.${wayKey}: realmRewards['${realmId}'] grants nothing`,
      ).toBe(true)
    }
  }
}

export function runCultivationPathContractTests(module: CultivationPathModule) {
  describe(`path module contract: ${module.id}`, () => {
    it('declares a non-empty name and at least one way', () => {
      expect(module.name.trim().length).toBeGreaterThan(0)
      expect(Object.keys(module.ways).length).toBeGreaterThan(0)
    })

    it('every way is well-formed and owned by this module', () => {
      for (const [wayKey, way] of Object.entries(module.ways)) {
        expectWellFormedWay(way, module.id, wayKey)
      }
    })

    it('createInitialState, when declared, runs on a default player', () => {
      if (module.createInitialState) {
        const player = createDefaultPlayer()
        expect(() => module.createInitialState!(player)).not.toThrow()
      }
    })

    it('a declared validatePersistedState hook runs on a default player payload', () => {
      if (module.validatePersistedState) {
        const issues: { path: string; message: string }[] = []
        expect(() =>
          module.validatePersistedState!(createDefaultPlayer(), (issue) => issues.push(issue)),
        ).not.toThrow()
      }
    })
  })
}

describe('cultivation path catalog contract (M10)', () => {
  for (const [pathId, module] of Object.entries(CULTIVATION_PATH_MODULES)) {
    it(`catalog key '${pathId}' matches module.id`, () => {
      expect(module.id).toBe(pathId)
    })
    runCultivationPathContractTests(module)
  }

  it('every catalog (path, way) is offerable at the ritual — RITUAL_PATH_ORDER cannot silently drop a path', () => {
    const offered = new Set(listOfferableWays(createDefaultPlayer()).map((o) => `${o.pathId}/${o.wayId}`))
    const missing: string[] = []

    for (const [pathId, module] of Object.entries(CULTIVATION_PATH_MODULES)) {
      for (const wayId of Object.keys(module.ways)) {
        if (!offered.has(`${pathId}/${wayId}`)) {
          missing.push(`${pathId}/${wayId}`)
        }
      }
    }

    expect(missing, missing.join(', ')).toEqual([])
  })

  it('ownedContent refs resolve and no id is owned by two ways (P1-M2)', () => {
    const violations: string[] = []
    const skillOwners = new Map<string, string>()
    const buffOwners = new Map<string, string>()

    for (const [pathId, pathModule] of Object.entries(CULTIVATION_PATH_MODULES)) {
      for (const [wayKey, way] of Object.entries(pathModule.ways)) {
        const owner = `${pathId}.${wayKey}`

        for (const skillId of way.ownedContent?.skillIds ?? []) {
          if (!KNOWN_SKILL_IDS.has(skillId)) {
            violations.push(`${owner}: skill '${skillId}' resolves to no known skill def`)
          }
          const prior = skillOwners.get(skillId)
          if (prior !== undefined) {
            violations.push(`skill '${skillId}' owned by both ${prior} and ${owner}`)
          }
          skillOwners.set(skillId, owner)
        }

        for (const buffId of way.ownedContent?.buffIds ?? []) {
          if (!BUFF_REGISTRY.has(buffId)) {
            violations.push(`${owner}: buff '${buffId}' not in BUFF_REGISTRY`)
          }
          const prior = buffOwners.get(buffId)
          if (prior !== undefined) {
            violations.push(`buff '${buffId}' owned by both ${prior} and ${owner}`)
          }
          buffOwners.set(buffId, owner)
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('no capability is declared by two ways (P1)', () => {
    const owners = new Map<string, string>()
    const violations: string[] = []

    for (const [pathId, pathModule] of Object.entries(CULTIVATION_PATH_MODULES)) {
      for (const [wayKey, way] of Object.entries(pathModule.ways)) {
        const owner = `${pathId}.${wayKey}`
        const caps = [
          ...(way.capabilities?.static ?? []),
          ...Object.keys(way.capabilities?.conditional ?? {}),
        ]

        for (const cap of caps) {
          const prior = owners.get(cap)
          if (prior !== undefined) {
            violations.push(`capability '${cap}' declared by both ${prior} and ${owner}`)
          }
          owners.set(cap, owner)
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it("ngo_dao's ownedContent.skillIds is the kit declaration of record (P1-M2)", () => {
    const ngoDao = CULTIVATION_PATH_MODULES.spell.ways.hidden_spell_pathway
    expect(ngoDao).toBeDefined()

    // Same reference - the export derives FROM the way declaration, so
    // the kit cannot drift away from the ownership record.
    expect(HIDDEN_SPELL_REQUIRED_SKILLS).toBe(ngoDao?.ownedContent?.skillIds)
    expect(ngoDao?.ownedContent?.skillIds).toHaveLength(3)
    // The Ngo Dao aura buff the runtime grant plants (carrier A).
    expect(ngoDao?.ownedContent?.buffIds).toContain('van_phap_than_hoa')
  })

  it('every module owning a persisted slice declares validatePersistedState (P1-M6)', () => {
    // Persisted-slice ownership: sword creates player.swordPath via
    // createInitialState at ritual commit; spell owns the birth field
    // player.spellPath (createDefaultPlayer) even without a slice factory.
    // body owns no persisted slice (nodeLevels belongs to NodeSystem).
    const SLICE_OWNERS: ReadonlySet<string> = new Set(['sword', 'spell'])

    for (const [pathId, pathModule] of Object.entries(CULTIVATION_PATH_MODULES)) {
      const ownsSlice =
        SLICE_OWNERS.has(pathId) || pathModule.createInitialState !== undefined

      if (ownsSlice) {
        expect(
          pathModule.validatePersistedState,
          `${pathId}: owns a persisted slice but declares no validatePersistedState hook`,
        ).toBeTypeOf('function')
      }
    }
  })

  it('contract runner is infra-independent (proves out on a fake module)', () => {
    const fake: CultivationPathModule = {
      id: 'sword',
      name: 'Fake Path',
      // 'demo' is deliberately not a CultivationWayId - the runner must
      // prove out on infra that never joined the canonical catalog.
      ways: {
        demo: {
          id: 'demo',
          pathId: 'sword',
          name: 'Demo Way',
          techniqueId: 'fake_technique',
        },
      } as unknown as CultivationPathModule['ways'],
    }
    // A structurally valid fake passes every per-way check.
    for (const [wayKey, way] of Object.entries(fake.ways)) {
      expectWellFormedWay(way, fake.id, wayKey)
    }
  })

  it('every way-gated node also declares its owning path, and the pair resolves in the catalog', () => {
    const violations: string[] = []

    for (const node of ALL_NODES) {
      if (node.requiredWay !== undefined) {
        if (node.requiredCultivationPath === undefined) {
          violations.push(`${node.id}: requiredWay '${node.requiredWay}' without requiredCultivationPath`)
          continue
        }
        const way = CULTIVATION_PATH_MODULES[node.requiredCultivationPath]?.ways[node.requiredWay]
        if (!way) {
          violations.push(
            `${node.id}: (path '${node.requiredCultivationPath}', way '${node.requiredWay}') not in catalog`,
          )
        }
      }

      if (
        node.requiredCultivationPath !== undefined &&
        !Object.prototype.hasOwnProperty.call(CULTIVATION_PATH_MODULES, node.requiredCultivationPath)
      ) {
        violations.push(`${node.id}: requiredCultivationPath '${node.requiredCultivationPath}' not in catalog`)
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})

describe('P7-M1 identity spine', () => {
  it('each path module declares exactly its canonical way set', () => {
    for (const pathId of Object.keys(CULTIVATION_PATH_MODULES) as CultivationPathId[]) {
      const module = CULTIVATION_PATH_MODULES[pathId]
      expect([...Object.keys(module.ways)].sort()).toEqual(
        [...CULTIVATION_PATH_WAY_IDS[pathId]].sort(),
      )
      for (const wayId of Object.keys(module.ways)) {
        expect(module.ways[wayId as CultivationWayId]?.pathId).toBe(pathId)
      }
    }
  })

  it('covers all six CultivationWayId members exactly once', () => {
    const all = Object.values(CULTIVATION_PATH_MODULES).flatMap((m) => Object.keys(m.ways))
    expect(all.sort()).toEqual([
      'body_pathway',
      'hidden_body_pathway',
      'hidden_spell_pathway',
      'hidden_sword_pathway',
      'spell_pathway',
      'sword_pathway',
    ])
  })

  it('getActiveWayDefinition resolves all six pairs and fails closed cross-path', () => {
    for (const [pathId, wayIds] of Object.entries(CULTIVATION_PATH_WAY_IDS)) {
      for (const wayId of wayIds) {
        expect(
          getActiveWayDefinition({
            cultivationPath: pathId as CultivationPathId,
            cultivationWay: wayId,
          }),
        ).toBeDefined()
      }
    }
    expect(
      getActiveWayDefinition({ cultivationPath: 'sword', cultivationWay: 'spell_pathway' }),
    ).toBeUndefined()
    expect(
      getActiveWayDefinition({ cultivationPath: 'sword', cultivationWay: undefined }),
    ).toBeUndefined()
  })
})

describe('P7-M2 realm passive ownership', () => {
  it("every way's passiveSkillIds is a subset of its ownedContent.skillIds", () => {
    const violations: string[] = []

    for (const [pathId, pathModule] of Object.entries(CULTIVATION_PATH_MODULES)) {
      for (const [wayKey, way] of Object.entries(pathModule.ways)) {
        const owned = new Set(way.ownedContent?.skillIds ?? [])

        for (const passiveId of way.passiveSkillIds ?? []) {
          if (!owned.has(passiveId)) {
            violations.push(`${pathId}.${wayKey}: passive '${passiveId}' granted but not owned`)
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('every realmRewards record declares at least one field (null passive = authored suppression)', () => {
    const violations: string[] = []

    for (const [pathId, pathModule] of Object.entries(CULTIVATION_PATH_MODULES)) {
      for (const [wayKey, way] of Object.entries(pathModule.ways)) {
        for (const [realmId, reward] of Object.entries(way.realmRewards ?? {})) {
          if (
            reward.artifactId === undefined &&
            reward.passiveSkillId === undefined
          ) {
            violations.push(`${pathId}.${wayKey}: realmRewards['${realmId}'] is an empty record`)
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('all declared passives resolve to known skill defs', () => {
    const violations: string[] = []

    for (const [pathId, pathModule] of Object.entries(CULTIVATION_PATH_MODULES)) {
      for (const [wayKey, way] of Object.entries(pathModule.ways)) {
        const owner = `${pathId}.${wayKey}`

        for (const passiveId of way.passiveSkillIds ?? []) {
          if (!KNOWN_SKILL_IDS.has(passiveId)) {
            violations.push(`${owner}: passiveSkillIds member '${passiveId}' resolves to no known skill def`)
          }
        }

        for (const [realmId, reward] of Object.entries(way.realmRewards ?? {})) {
          if (reward.passiveSkillId != null && !KNOWN_SKILL_IDS.has(reward.passiveSkillId)) {
            violations.push(`${owner}: realmRewards['${realmId}'].passiveSkillId '${reward.passiveSkillId}' resolves to no known skill def`)
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('all declared passives resolve to defs of type passive', () => {
    const skillTypeById = new Map(SKILLS.map((skill) => [skill.id, skill.type]))
    const violations: string[] = []

    for (const [pathId, pathModule] of Object.entries(CULTIVATION_PATH_MODULES)) {
      for (const [wayKey, way] of Object.entries(pathModule.ways)) {
        const owner = `${pathId}.${wayKey}`

        for (const passiveId of way.passiveSkillIds ?? []) {
          if (skillTypeById.get(passiveId) !== 'passive') {
            violations.push(`${owner}: passiveSkillIds member '${passiveId}' is not a passive def`)
          }
        }

        for (const [realmId, reward] of Object.entries(way.realmRewards ?? {})) {
          if (reward.passiveSkillId != null && skillTypeById.get(reward.passiveSkillId) !== 'passive') {
            violations.push(
              `${owner}: realmRewards['${realmId}'].passiveSkillId '${reward.passiveSkillId}' is not a passive def`,
            )
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('every way composes the canonical ladder unmodified (no override/suppression at M2)', () => {
    const violations: string[] = []

    for (const [pathId, pathModule] of Object.entries(CULTIVATION_PATH_MODULES)) {
      for (const [wayKey, way] of Object.entries(pathModule.ways)) {
        for (const [realmId, passiveSkillId] of Object.entries(CANONICAL_REALM_PASSIVE_LADDER)) {
          const actual = way.realmRewards?.[realmId]?.passiveSkillId

          if (actual !== passiveSkillId) {
            violations.push(
              `${pathId}.${wayKey}: realmRewards['${realmId}'].passiveSkillId is ${String(actual)}, expected canonical '${passiveSkillId}'`,
            )
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})
