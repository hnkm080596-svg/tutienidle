import type { Stats } from './StatBlock'
import type { StatModifier } from './StatCalculator'
import type { StatType } from './StatTypes'
import { STAT_DOMAIN } from './StatDomain'

// Save payloads written before the stat-system-reimagined rename pass
// persist stat records (baseStats) under the OLD key names. RENAME maps
// each old key to its successor; DROP lists keys that were retired with
// no successor, so a stale saved value can never shadow a live stat.
//
// The drop list lands ahead of the StatType removal (a later task takes
// attackRange / maxMpPercent / manaRegenPercent / poisonRecoveryPercent
// out of the union) so restores are safe in either order.
const STAT_KEY_RENAMES: Record<string, StatType> = {
  attack: 'might',
  hpRegenPerSecond: 'hpRegenPerTurn',
  manaRegenPerSecond: 'manaRegenPerTurn',
  wardRegenPerSecond: 'wardRegenPerTurn',
  speedMultiplier: 'productionSpeedMultiplier',
}

const STAT_KEY_DROPS: ReadonlySet<string> = new Set([
  'attackRange',
  'maxMpPercent',
  'manaRegenPercent',
  'poisonRecoveryPercent',
])

// Remap a persisted stat record onto the current key names. Keys that
// already use the new names pass through untouched; when a record
// carries BOTH an old key and its successor (partially migrated save),
// the new-name value wins.
export function migrateStatRecordKeys(record: Record<string, number>): Stats {
  const migrated: Record<string, number> = {}

  for (const [key, value] of Object.entries(record)) {
    const renamed = STAT_KEY_RENAMES[key]

    if (renamed !== undefined) {
      if (!(renamed in record)) {
        migrated[renamed] = value
      }
      continue
    }

    if (STAT_KEY_DROPS.has(key)) {
      continue
    }

    migrated[key] = value
  }

  return migrated as Stats
}

// StatModifier.stat fields persisted outside baseStats (player.modifiers,
// persistentTimedEffects, equipment mainStat, socketed talisman/formation
// copies) carry the same legacy keys. This string-level helper only
// renames: callers that keep the raw result (equipment mainStat
// validation) WANT a retired key to survive so the downstream STAT_TYPES
// check can flag/discard the entry instead of silently accepting it.
export function migrateStatModifierStat(stat: string): string {
  return STAT_KEY_RENAMES[stat] ?? stat
}

export function isRetiredStatKey(stat: string): boolean {
  return STAT_KEY_DROPS.has(stat)
}

// Same migration for a typed StatModifier — returns the input unchanged
// (same reference) when neither key nor domain needs a touch, and NULL
// when the modifier carries a retired stat: the key no longer exists in
// StatType, so restoring it would persist an inert zombie modifier into
// state/saves forever.
export function migrateStatModifier(modifier: StatModifier): StatModifier | null {
  if (STAT_KEY_DROPS.has(modifier.stat)) {
    return null
  }

  const stat = migrateStatModifierStat(modifier.stat) as StatType

  // QA-2026-09-14-001: saves persisted before the domain tag existed can
  // carry modifiers on now-gated stats (timed MP regen, production
  // speed). Backfill the stat's OWNING domain so a legit legacy payload
  // restores its intended grant instead of tripping applyDomainGate. A
  // persisted modifier predates the gate — it was legal when written.
  // A saved wrong-domain tag is NOT rewritten (that is tamper surface,
  // not legacy shape).
  const domain = modifier.domain ?? STAT_DOMAIN[stat]

  if (stat === modifier.stat && domain === modifier.domain) {
    return modifier
  }

  return { ...modifier, stat, ...(domain === undefined ? {} : { domain }) }
}

// List-level helper for restore call sites: renames/backfills live
// modifiers, drops retired-stat zombies, keeps non-object passthrough.
export function migrateStatModifiers(modifiers: StatModifier[]): StatModifier[] {
  const migrated: StatModifier[] = []

  for (const modifier of modifiers) {
    if (!modifier || typeof modifier !== 'object') {
      migrated.push(modifier)
      continue
    }

    const result = migrateStatModifier(modifier)
    if (result !== null) {
      migrated.push(result)
    }
  }

  return migrated
}
