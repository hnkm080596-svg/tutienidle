/**
 * Cultivation Path Framework contract runner (M10, spec §28) —
 * `runCultivationPathContractTests(module)` applies the structural way
 * contract to every registered path module, so a NEW path/way is held
 * to the same shape the moment it is added to the catalog.
 *
 * Also pins the node-side wiring: way ids are PATH-SCOPED ('hien'
 * exists under both kiem_tu and the_tu), so a node carrying
 * `requiredWay` must also carry `requiredCultivationPath`, and the
 * pair must resolve in the catalog — otherwise a way-gated node would
 * open to a same-named way on the wrong path.
 */
import { describe, expect, it } from 'vitest'
import {
  CULTIVATION_PATH_MODULES,
  PHAP_TU_AN_REQUIRED_SKILLS,
  type CultivationPathId,
  type CultivationPathModule,
  type PathWayDefinition,
} from './CultivationPathKit'
import { createDefaultPlayer } from './Player'
import { listOfferableWays } from './CultivationPathSystem'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import { SKILLS } from '../../data/skill/Skills'
import { BASIC_ATTACKS_BY_BUILD, THUY_GIAP_LONG_WATER_SURGE } from '../../data/skill/TurnBasicAttacks'
import { KIEM_PHO_ORBS } from '../../data/skill/KiemPhoOrbs'
import {
  KIEM_DAO_CASCADE_EMBLEM,
  NGU_KIEM_THUAT,
  TU_KIEM_Y_EMBLEM,
} from '../../data/skill/NguKiemDaoSkills'
import {
  BACH_UNG,
  PHAN_KICH,
  THAM_THE,
  THE_TU_KIT_BY_ROOT,
  TRO_KICH,
  TRONG_PHAN_KICH,
  TU_THE,
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
  TU_KIEM_Y_EMBLEM.id,
  KIEM_DAO_CASCADE_EMBLEM.id,
  ...Object.values(THE_TU_KIT_BY_ROOT).flatMap((kit) => [
    kit.basic.id,
    kit.special.id,
    kit.ultimate.id,
  ]),
  THAM_THE.id,
  TU_THE.id,
  BACH_UNG.id,
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
    ['unequipSkillIds', way.unequipSkillIds],
    ['ownedContent.skillIds', way.ownedContent?.skillIds],
    ['ownedContent.buffIds', way.ownedContent?.buffIds],
  ] as const) {
    if (ids) {
      expect(ids.every((id) => typeof id === 'string' && id.trim().length > 0)).toBe(true)
      expect(new Set(ids).size, `${moduleId}.${wayKey}: duplicate ${label}`).toBe(ids.length)
    }
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

  if (way.realmRewards) {
    for (const [realmId, reward] of Object.entries(way.realmRewards)) {
      expect(
        reward.techniqueId !== undefined || reward.artifactId !== undefined,
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
    const ngoDao = CULTIVATION_PATH_MODULES.phap_tu.ways.ngo_dao
    expect(ngoDao).toBeDefined()

    // Same reference - the export derives FROM the way declaration, so
    // the kit cannot drift away from the ownership record.
    expect(PHAP_TU_AN_REQUIRED_SKILLS).toBe(ngoDao?.ownedContent?.skillIds)
    expect(ngoDao?.ownedContent?.skillIds).toHaveLength(3)
    // The Ngo Dao aura buff the runtime grant plants (carrier A).
    expect(ngoDao?.ownedContent?.buffIds).toContain('van_phap_than_hoa')
  })

  it('every module owning a persisted slice declares validatePersistedState (P1-M6)', () => {
    // Persisted-slice ownership: kiem_tu creates player.kiemTu via
    // createInitialState at ritual commit; phap_tu owns the birth field
    // player.phapTu (createDefaultPlayer) even without a slice factory.
    // the_tu owns no persisted slice (nodeLevels belongs to NodeSystem).
    const SLICE_OWNERS: ReadonlySet<string> = new Set(['kiem_tu', 'phap_tu'])

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
      id: 'kiem_tu',
      name: 'Fake Path',
      ways: {
        demo: {
          id: 'demo',
          pathId: 'kiem_tu',
          name: 'Demo Way',
          techniqueId: 'fake_technique',
        },
      },
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
