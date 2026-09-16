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
  type CultivationPathId,
  type CultivationPathModule,
  type PathWayDefinition,
} from './CultivationPathKit'
import { createDefaultPlayer } from './Player'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import type { ProgressionNode } from '../progression/ProgressionNode'

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
  ] as const) {
    if (ids) {
      expect(ids.every((id) => typeof id === 'string' && id.trim().length > 0)).toBe(true)
      expect(new Set(ids).size, `${moduleId}.${wayKey}: duplicate ${label}`).toBe(ids.length)
    }
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
  })
}

describe('cultivation path catalog contract (M10)', () => {
  for (const [pathId, module] of Object.entries(CULTIVATION_PATH_MODULES)) {
    it(`catalog key '${pathId}' matches module.id`, () => {
      expect(module.id).toBe(pathId)
    })
    runCultivationPathContractTests(module)
  }

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
