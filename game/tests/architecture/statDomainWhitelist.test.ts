import { describe, expect, it } from 'vitest'
import { DOMAIN_SOURCE_WHITELIST, STAT_DOMAIN } from '../../src/core/stats/StatDomain'
import type { StatDomain } from '../../src/core/stats/StatDomain'
import type { StatType } from '../../src/core/stats/StatTypes'
import { createBaseStats } from '../../src/core/stats/StatBlock'

/**
 * Domain whitelist lint (stat-system-reimagined Task 7, spec section 2.1 --
 * INV-11). The runtime gate in StatDomain.ts can only police modifiers at
 * delivery time; this guard polices AUTHORING: any StatModifier-shaped object
 * emitted from src/data/** that carries a `domain` tag must be declared in
 * DOMAIN_SOURCE_WHITELIST (file predicate + optional per-stat scope), and any
 * authored modifier targeting a gated stat WITHOUT the matching domain tag is
 * dead content (the gate would reject it) and fails here at build time.
 *
 * Scope note: system-emitted modifiers (CultivationPathKit, PillSystem,
 * GameManagerPersistentEffectOps, ...) live under src/core -- they are not
 * file-scannable and are guarded by the runtime gate alone, per spec.
 *
 * Scan strategy: import.meta.glob eager-loads every data module and deep-walks
 * its exported values. A source-text scan was rejected -- RealmPassives binds
 * `stat` through a mapped variable and PhapTuNodes stamps `domain` inside a
 * shared helper, so only the EMITTED objects carry the true (stat, domain)
 * pair. (Precedent for importing app modules from an architecture guard:
 * nodeBranchCoverage.test.ts.)
 *
 * Barrel handling: data/buff/buffs.ts re-exports every domain file's arrays,
 * so the same modifier object is reachable from several module paths. Findings
 * group by object identity and remember every exposing file; a tag is
 * authorized when ANY exposing file satisfies the whitelist. Whitelisted
 * entries are leaf content files that never re-export foreign content, so
 * "any exposing file" cannot launder a modifier authored elsewhere.
 */

const STAT_TYPE_SET = new Set<string>(Object.keys(createBaseStats()))

interface FoundModifier {
  stat?: string
  domain?: string
  files: Set<string>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStatModifierShape(obj: Record<string, unknown>): boolean {
  if (typeof obj.stat !== 'string' || !STAT_TYPE_SET.has(obj.stat)) {
    return false
  }
  // BuffEffects author { type:'statModifier', stat, ... }; pipeline-ready
  // StatModifiers carry sourceId/sourceType. SkillModifier.stat is a
  // SkillResourceStatKey (not a StatType) and is filtered by the set above.
  return obj.type === 'statModifier' || typeof obj.sourceType === 'string'
}

function collectModuleModifiers(
  moduleExports: Record<string, unknown>,
  file: string,
  found: Map<object, FoundModifier>,
): void {
  const visited = new Set<unknown>()

  const visit = (value: unknown): void => {
    if (!isObject(value) || visited.has(value)) {
      return
    }
    visited.add(value)

    const isTag = typeof value.domain === 'string'
    const isMod = !isTag && isStatModifierShape(value)

    if (isTag || isMod) {
      const entry = found.get(value) ?? {
        stat: typeof value.stat === 'string' ? value.stat : undefined,
        domain: typeof value.domain === 'string' ? value.domain : undefined,
        files: new Set<string>(),
      }
      entry.files.add(file)
      found.set(value, entry)
    }

    for (const child of Object.values(value)) {
      visit(child)
    }
  }

  for (const exported of Object.values(moduleExports)) {
    visit(exported)
  }
}

function filePatternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  const globbed = escaped.replace(/\*\*/g, ' ').replace(/\*/g, '[^/]*').replace(/ /g, '.*')
  return new RegExp(`(^|/)${globbed}$`)
}

interface WhitelistViolation {
  files: string[]
  modifier: FoundModifier
  reason: string
}

function checkModifier(modifier: FoundModifier): WhitelistViolation | null {
  if (modifier.domain !== undefined) {
    const entries = DOMAIN_SOURCE_WHITELIST[modifier.domain as StatDomain] ?? []

    const allowed = [...modifier.files].some((file) =>
      entries.some((entry) => {
        if (!filePatternToRegex(entry.file).test(file)) {
          return false
        }
        // stats-scoped grant: the modifier's stat must be listed. A tag with
        // no resolvable stat can only satisfy stat-less (whole-file) grants.
        if (entry.stats === undefined) {
          return true
        }
        return modifier.stat !== undefined && entry.stats.includes(modifier.stat as StatType)
      }),
    )

    if (!allowed) {
      return {
        files: [...modifier.files],
        modifier,
        reason: `domain '${modifier.domain}' not whitelisted for this file/stat`,
      }
    }
    return null
  }

  // Untagged modifier on a gated stat = dead content (runtime gate rejects).
  if (modifier.stat !== undefined && STAT_DOMAIN[modifier.stat as StatType] !== undefined) {
    return {
      files: [...modifier.files],
      modifier,
      reason: `targets gated stat '${modifier.stat}' (${STAT_DOMAIN[modifier.stat as StatType]}) without a domain tag`,
    }
  }
  return null
}

describe('domain source whitelist (INV-11)', () => {
  it('predicate check: phap_tu tag in a non-whitelisted file is rejected', () => {
    const violation = checkModifier({
      files: new Set(['src/data/enemy/ExampleEnemy.ts']),
      stat: 'maxMp',
      domain: 'phap_tu',
    })
    expect(violation).not.toBeNull()
  })

  it('predicate check: whitelisted file authoring a different domain is rejected', () => {
    const violation = checkModifier({
      files: new Set(['src/data/progression/PhapTuNodes.ts']),
      stat: 'might',
      domain: 'cultivation',
    })
    expect(violation).not.toBeNull()
  })

  it('predicate check: stats-scoped entry rejects a tag on a non-listed stat', () => {
    const violation = checkModifier({
      files: new Set(['src/data/realm/RealmPassives.ts']),
      stat: 'might',
      domain: 'phap_tu',
    })
    expect(violation).not.toBeNull()
  })

  it('every authored domain tag in src/data/** is whitelisted', () => {
    const modules = import.meta.glob('../../src/data/**/*.ts', { eager: true })
    const found = new Map<object, FoundModifier>()

    for (const [path, moduleExports] of Object.entries(modules)) {
      if (path.endsWith('.test.ts')) {
        continue
      }
      const file = path.replace(/^(\.\.\/)+/, '')
      collectModuleModifiers(moduleExports as Record<string, unknown>, file, found)
    }

    const violations: WhitelistViolation[] = []
    for (const modifier of found.values()) {
      const violation = checkModifier(modifier)
      if (violation) {
        violations.push(violation)
      }
    }

    expect(
      violations.map(
        (v) => `${v.files.join(', ')}: ${v.modifier.stat ?? '?'} (${v.modifier.domain ?? 'no domain'}) -- ${v.reason}`,
      ),
    ).toEqual([])
  })
})
