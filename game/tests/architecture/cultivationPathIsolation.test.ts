/**
 * Cultivation Path Framework isolation guard (M10, spec §28).
 *
 * The framework's core law: generic systems MUST NOT branch on concrete
 * path/way identity. Path/way modules may know their own ids; content
 * (data/**, artifact maps, visual profiles) legitimately keys on them.
 *
 * Two checks, both dependency/branch-level rather than literal-grep:
 *
 * 1. MODULE ISOLATION (dependency direction, A6) — a path module
 *    (core/kiem-tu, core/phap-tu, core/the-tu) never imports upward into
 *    orchestration/presentation/persistence, and never imports a sibling
 *    path module. The catalog (core/player/CultivationPathKit) is the
 *    single aggregation point allowed to know every module.
 *
 * 2. IDENTITY-BRANCHING — outside the authority dir (core/player), the
 *    three module dirs, save shape validation, and tests, no file may
 *    compare cultivationPath / cultivationWay / pathId / wayId (or a
 *    getActivePath()/getActiveWay() read) to a concrete literal, nor
 *    switch on the identity fields. Comparisons against DECLARED data
 *    (node.requiredCultivationPath, catalog lookups, domain-capability
 *    checks on stat domains) are the approved shape and are not flagged.
 */
import { describe, expect, it } from 'vitest'
import { join, relative, sep } from 'node:path'
import { listAllTs, listVue, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const SRC = join(GAME_ROOT, 'src')

const PATH_MODULE_DIRS = ['core/kiem-tu/', 'core/phap-tu/', 'core/the-tu/'] as const

// ---------------------------------------------------------------------------
// Check 1 — module isolation
// ---------------------------------------------------------------------------

const UPWARD_LAYERS = [
  'core/game/',
  'components/',
  'composables/',
  'layouts/',
  'stores/',
  'services/',
  'presentation/',
] as const

function importSpecifiers(source: string): string[] {
  return importRecords(source).map((r) => r.specifier)
}

interface ImportRecord {
  specifier: string
  typeOnly: boolean
}

function importRecords(source: string): ImportRecord[] {
  const records: ImportRecord[] = []
  const re = /(import|export)\s+(type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    records.push({ specifier: m[3]!, typeOnly: m[2] !== undefined })
  }
  const dyn = /import\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = dyn.exec(source)) !== null) {
    records.push({ specifier: m[1]!, typeOnly: false })
  }
  return records
}

function resolveToSrc(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith('@/')) return specifier.slice(2).split('/').join(sep)
  if (specifier.startsWith('.')) {
    const abs = join(fromFile, '..', specifier)
    const rel = relative(SRC, abs)
    return rel.startsWith('..') ? null : rel.replaceAll('/', sep)
  }
  return null
}

// ---------------------------------------------------------------------------
// Check 2 — identity branching
// ---------------------------------------------------------------------------

// Path + way literals, longest-first so '_an' remnants match before
// their base prefixes inside the quoted alternation.
const CONCRETE_ID = String.raw`(?:kiem_tu_an|phap_tu_an|the_tu_an|kiem_tu|phap_tu|the_tu|ngu_hanh|ngo_dao|ung_the|hien|ngu)`
const IDENTITY_FIELD = String.raw`(?:cultivationPath|cultivationWay|pathId|wayId)`
const IDENTITY_READ = String.raw`(?:\b${IDENTITY_FIELD}\b|getActivePath\s*\([^)]*\)|getActiveWay\s*\([^)]*\))`

const BRANCH_PATTERNS: readonly { rule: string; re: RegExp }[] = [
  {
    rule: 'identity===literal',
    re: new RegExp(`${IDENTITY_READ}\\s*(?:===|!==)\\s*['"]${CONCRETE_ID}['"]`),
  },
  {
    rule: 'literal===identity',
    re: new RegExp(`['"]${CONCRETE_ID}['"]\\s*(?:===|!==)\\s*[^\\n;]{0,80}?${IDENTITY_READ}`),
  },
  {
    rule: 'switch-on-identity',
    re: new RegExp(`switch\\s*\\([^)]*\\b(?:cultivationPath|cultivationWay)\\b`),
  },
]

// Dirs whose job IS identity: the framework authority (catalog, ritual
// choice, resolvers), the three path modules (their own predicates),
// and save shape validation (owns the persisted union check).
const BRANCH_EXEMPT_PREFIXES: readonly string[] = [
  'core/player/',
  ...PATH_MODULE_DIRS,
  'services/save/',
]

// ---------------------------------------------------------------------------
// Check 3 — predicate/seam import allowlist (review cycle 2, F3)
// ---------------------------------------------------------------------------
// Value-level imports from a path module are the accepted seam shape
// (predicates, economy ops, providers) — but each site is an intentional
// cross-system coupling and must be visible. A NEW import site outside
// this allowlist fails here instead of sneaking into review.
// Type-only imports are data contracts (OrbId, PhapTuState, ...) and
// stay free.
const SEAM_ALLOWLIST_DIRS: readonly string[] = [
  // Orchestration layer — the battle-provider/ritual seams are owned here.
  'core/game/',
  // Presentation may render per-way UI through module predicates.
  'components/',
  'composables/',
  'presentation/',
]

const SEAM_ALLOWLIST_FILES: readonly string[] = [
  // Typed NodeEffect channels (elementTag/routeTag, kiemDaoCap) — the
  // spec-accepted per-path consumer fields.
  'core/progression/NodeSystem.ts',
  // MP pills are deliberately ngu_hanh-only (documented gate).
  'core/pill/PillSystem.ts',
  // ngu_hanh realm-technique grant inside the dead legacy block.
  'core/tribulation/BreakthroughOutcomeService.ts',
  // PhapTuRoutes value helpers for cast-leveled phap machinery.
  'core/skill/SkillSystem.ts',
  // The Tu mechanic wiring (TheEconomy / external ward).
  'core/battle/turn/TurnBattleSystem.ts',
  // Combat-contract M3 resource adapter -- the ResourceAuthority port
  // delegates 'the'-pool gains to TheEconomy's single clamp authority
  // (grantThe); consumes mirror consumeResourceFor's direct write.
  'core/battle/runtime/scheduler/adapters/EntityResourceAdapter.ts',
  // Save boundary validates module-owned slices (orb ids, way ownership).
  'services/save/saveShapeValidation.ts',
]

describe('cultivation path isolation (M10)', () => {
  const moduleFiles = PATH_MODULE_DIRS.flatMap((dir) =>
    listAllTs(join(SRC, dir)).filter((f) => !f.endsWith('.test.ts')),
  )

  it('scans a real module corpus (guard must not silently pass on empty input)', () => {
    expect(moduleFiles.length).toBeGreaterThan(10)
  })

  it(
    'path modules never import upward or a sibling path module',
    { timeout: SCAN_TIMEOUT },
    () => {
      const violations: string[] = []

      for (const file of moduleFiles) {
        const ownDir = PATH_MODULE_DIRS.find((dir) =>
          file.replaceAll(sep, '/').includes(`/src/${dir}`),
        )
        for (const spec of importSpecifiers(readTs(file))) {
          const target = resolveToSrc(spec, file)
          if (!target) continue
          const normalized = target.split(sep).join('/') + '/'

          for (const layer of UPWARD_LAYERS) {
            if (normalized.startsWith(layer)) {
              violations.push(`${relative(GAME_ROOT, file)} -> ${spec} [upward:${layer}]`)
            }
          }

          for (const sibling of PATH_MODULE_DIRS) {
            if (sibling !== ownDir && normalized.startsWith(sibling)) {
              violations.push(`${relative(GAME_ROOT, file)} -> ${spec} [sibling-module:${sibling}]`)
            }
          }
        }
      }

      expect(violations, violations.join('\n')).toEqual([])
    },
  )

  it(
    'generic code never compares path/way identity fields to concrete literals',
    { timeout: SCAN_TIMEOUT },
    () => {
      const scanned = [
        ...listAllTs(join(SRC, 'core')),
        ...listAllTs(join(SRC, 'components')),
        ...listAllTs(join(SRC, 'composables')),
        ...listAllTs(join(SRC, 'stores')),
        ...listAllTs(join(SRC, 'services')),
        ...listAllTs(join(SRC, 'presentation')),
        ...listVue(join(SRC, 'components')),
      ]
        .filter((f) => !f.endsWith('.test.ts'))
        .filter((f) => {
          const fromSrc = relative(SRC, f).split(sep).join('/') + '/'
          return !BRANCH_EXEMPT_PREFIXES.some((prefix) => fromSrc.startsWith(prefix))
        })

      expect(scanned.length).toBeGreaterThan(300)

      const violations: string[] = []
      for (const file of scanned) {
        const source = readTs(file)
        for (const { rule, re } of BRANCH_PATTERNS) {
          const m = source.match(re)
          if (m) {
            violations.push(`${relative(GAME_ROOT, file)} [${rule}]: ${m[0].slice(0, 120)}`)
          }
        }
      }

      expect(violations, violations.join('\n')).toEqual([])
    },
  )

  it(
    'value imports from path modules stay inside the documented seam allowlist',
    { timeout: SCAN_TIMEOUT },
    () => {
      const scanned = [
        ...listAllTs(join(SRC, 'core')),
        ...listAllTs(join(SRC, 'components')),
        ...listAllTs(join(SRC, 'composables')),
        ...listAllTs(join(SRC, 'stores')),
        ...listAllTs(join(SRC, 'services')),
        ...listAllTs(join(SRC, 'presentation')),
        ...listVue(join(SRC, 'components')),
      ].filter((f) => !f.endsWith('.test.ts'))

      const violations: string[] = []
      for (const file of scanned) {
        const fromSrc = relative(SRC, file).split(sep).join('/')

        // Authority, the modules themselves, and content data are exempt.
        if (
          fromSrc.startsWith('core/player/') ||
          PATH_MODULE_DIRS.some((dir) => fromSrc.startsWith(dir)) ||
          SEAM_ALLOWLIST_DIRS.some((dir) => fromSrc.startsWith(dir)) ||
          (SEAM_ALLOWLIST_FILES as readonly string[]).includes(fromSrc)
        ) {
          continue
        }

        for (const record of importRecords(readTs(file))) {
          if (record.typeOnly) continue
          const target = resolveToSrc(record.specifier, file)
          if (!target) continue
          const normalized = target.split(sep).join('/') + '/'
          if (PATH_MODULE_DIRS.some((dir) => normalized.startsWith(dir))) {
            violations.push(`${fromSrc} -> ${record.specifier} [unlisted-seam]`)
          }
        }
      }

      expect(violations, violations.join('\n')).toEqual([])
    },
  )
})
