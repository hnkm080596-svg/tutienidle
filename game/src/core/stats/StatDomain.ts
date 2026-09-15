import type { StatModifier } from './StatCalculator'
import type { StatType } from './StatTypes'

// D10 (2026-09-14 stat-system-reimagined, spec section 2) -- the domain
// gate model: StatType stays one union, Stats stays one record, and
// calculateStats stays the single formula authority. Isolation between
// gameplay domains (paths, production, cultivation, ...) is enforced by
// gating which MODIFIER domains may move which stats, checked at the
// pipeline input of calculateStats()/calculateEffectiveStats().
//
// Delivery rule:
//   universal stat + any-domain modifier  -> accepted
//   gated stat    + matching domain       -> accepted
//   gated stat    + wrong/absent domain   -> rejected loudly
//     (dev/test throws on first violation; production filters the
//     modifier out, records it in domainViolations, and console.error --
//     never silently dropped or silently applied, A8)

export type StatDomain =
  | 'universal'
  | 'phap_tu'
  | 'the_tu'
  | 'the_tu_an'
  | 'kiem_tu'
  | 'hoa_tu'
  | 'production'
  | 'cultivation'
  | 'equipment_meta'
  | 'artifact'
  | 'realm'

// Stat -> owning domain. Stats absent from this registry are universal:
// they accept modifiers from every domain (INV-9). Task 7 populated the
// phap_tu gate (D10/D17/D19): MP is a Phap Tu resource+shield, and
// reactionEffectPercent exists only inside the hidden Phap Tu path.
// Tests may register temporary entries via direct mutation.
export const STAT_DOMAIN: Partial<Record<StatType, StatDomain>> = {
  maxMp: 'phap_tu',
  manaRegenPerTurn: 'phap_tu',
  manaShieldPercent: 'phap_tu',
  reactionEffectPercent: 'phap_tu',

  // The Tu Reimagined (spec 2026-09-15 section 3.3, T8) — block and
  // endurance are body-path identity: only the_tu-domain modifiers may
  // move them, and the_tu_an's three reactive chances accept only
  // the_tu_an-domain emission (which in practice is the attribute
  // deriver — INV-13 forbids authored modifiers for them entirely).
  blockChance: 'the_tu',
  blockEffectiveness: 'the_tu',
  enduranceThreshold: 'the_tu',
  endurancePercent: 'the_tu',
  counterChance: 'the_tu_an',
  protectChance: 'the_tu_an',
  followUpChance: 'the_tu_an',

  // Task 9 (D15): non-combat meta stats are gated to their owning domain
  // (same mechanism as path stats), not evicted. No authored emitter
  // exists for these today -- the gate reserves the channel so a future
  // emitter MUST declare its domain to deliver.
  productionSpeedMultiplier: 'production',
  cultivationPercent: 'cultivation',
  affixDeltaPercent: 'equipment_meta',
  artifactGradeMultiplier: 'artifact',
  realmPassivePercent: 'realm',
}

// Source-file -> domain authoring whitelist (spec section 2.1). Each
// entry is a predicate: `file` is a glob matched against the repo path
// (`*` stays inside one path segment, `**` crosses segments), optional
// `stats` scopes the grant to specific stats inside a mixed file.
// Consumed by tests/architecture/statDomainWhitelist.test.ts at build
// time, not at runtime -- the runtime gate alone guards system-emitted
// modifiers. Covers the real emitters audited in Task 7 beyond the
// spec's initial list (ThuanHeBuffs/LegacyBuffs MP regen buffs and the
// reaction path skill file are Phap Tu emissions by content ownership).
export const DOMAIN_SOURCE_WHITELIST: Record<
  string,
  Array<{ file: string; stats?: StatType[] }>
> = {
  phap_tu: [
    // The whole Phap Tu node tree + its builders file.
    { file: 'data/progression/PhapTu*' },
    // Reserved per spec 2.1 -- no data/buff/PhapTu*.ts exists yet.
    { file: 'data/buff/PhapTu*' },
    {
      file: 'data/realm/RealmPassives.ts',
      stats: ['maxMp', 'manaRegenPerTurn'],
    },
    {
      file: 'data/technique/Techniques.ts',
      stats: ['maxMp', 'manaRegenPerTurn'],
    },
    // BossBuffs.ts houses reaction_empowerment -- the player Phap Tu an
    // ultimate self-buff lives there by filename accident (D19 residual).
    { file: 'data/buff/BossBuffs.ts', stats: ['reactionEffectPercent'] },
    // Phap Tu Thuan He chain buffs (Th/Ngung Lo MP regen grants).
    { file: 'data/buff/ThuanHeBuffs.ts', stats: ['manaRegenPerTurn'] },
    { file: 'data/buff/LegacyBuffs.ts', stats: ['manaRegenPerTurn'] },
    // Turn-based reaction path skills (hidden Phap Tu path content, D19).
    { file: 'data/skill/TurnReactionPathSkills.ts', stats: ['reactionEffectPercent'] },
  ],

  // The Tu Reimagined (T8) — two separate domains: 'the_tu' owns the
  // visible path's defensive stats (block/endurance migration in Task 3)
  // and kit-authored modifiers; 'the_tu_an' owns the hidden path's
  // reactive chance stats (counterChance/protectChance/followUpChance).
  the_tu: [
    { file: 'data/progression/TheTu*' },
    { file: 'data/skill/TheTu*' },
    { file: 'data/buff/TheTu*' },
    // Techniques.ts houses kim_cang_bat_hoai_the — its block/endurance
    // stat rows are the_tu emissions by content ownership.
    {
      file: 'data/technique/Techniques.ts',
      stats: ['blockChance', 'blockEffectiveness', 'enduranceThreshold', 'endurancePercent'],
    },
  ],
  the_tu_an: [
    { file: 'data/progression/TheTuAn*' },
    // The hidden path's kit skills + buffs live in the TheTu* files
    // (one content file per path family); the chance-stat emitter is a
    // core-side deriver, not file-scanned. Unscoped rows: the domain
    // currently owns ONLY the three reactive chance stats (Task 3).
    { file: 'data/skill/TheTu*' },
    { file: 'data/buff/TheTu*' },
  ],

  // Task 9 (D15): meta-domain emitter homes. No data/** file authors
  // these today -- the lines declare which files MAY, so a new emitter
  // is a deliberate whitelist addition. (Core-side emitters are not
  // file-scanned; the runtime gate still enforces their tag.)
  production: [{ file: 'data/production/**' }],
  cultivation: [{ file: 'data/pill/**' }],
  equipment_meta: [{ file: 'data/equipment/**' }],
  artifact: [{ file: 'data/artifact/**' }],
  realm: [{ file: 'data/realm/**' }],
}

// Cultivation path id -> the combat stat domains that path owns.
// TurnBattleAdapter reads this when declaring a participant's
// EffectiveStatContext.activeDomains. Kept as an explicit map rather
// than a cast of the path id into StatDomain: a path id and a stat
// domain are different concepts, and a future path may OWN an existing
// domain without BEING one — Phap Tu An ('phap_tu_an') still owns the
// phap_tu stat channel and gets a row here when that path lands. Meta
// domains (production/cultivation/equipment_meta/artifact/realm) never
// appear here.
export const CULTIVATION_PATH_STAT_DOMAINS: Record<string, readonly StatDomain[]> = {
  phap_tu: ['phap_tu'],
  the_tu: ['the_tu'],
  the_tu_an: ['the_tu_an'],
  kiem_tu: ['kiem_tu'],
  hoa_tu: ['hoa_tu'],
}

export interface DomainViolation {
  readonly modifier: StatModifier
  readonly statDomain: StatDomain
  // The domain the modifier declared; 'universal' when absent.
  readonly modifierDomain: StatDomain
}

// Diagnostics channel: every rejected modifier is collected here so
// callers/tests can inspect what the gate filtered. Production also
// reports each rejection via console.error; dev/test throws on the
// first violation (the record is still appended before the throw).
export const domainViolations: DomainViolation[] = []

export function clearDomainViolations(): void {
  domainViolations.length = 0
}

// Dev/test detection follows the codebase's import.meta.env.DEV guard
// pattern (DevMode.ts), extended with MODE === 'test' so Vitest runs
// (where DEV semantics may vary) also fail fast.
function isDevOrTestEnv(): boolean {
  return import.meta.env.DEV === true || import.meta.env.MODE === 'test'
}

function describeViolation(violation: DomainViolation): string {
  const { modifier, statDomain, modifierDomain } = violation
  return (
    `[StatDomain] gate violation: modifier "${modifier.id}" ` +
    `(${modifier.sourceType}/${modifier.sourceId}) targets stat "${modifier.stat}" ` +
    `gated to domain "${statDomain}" but declares domain "${modifierDomain}"`
  )
}

/**
 * The delivery gate (D10). Runs at the TOP of both calculateStats() and
 * calculateEffectiveStats() before any pipeline work; returns only the
 * modifiers allowed to enter the Added/Increased/More pools.
 *
 * `throwOnViolation` selects the rejection policy: dev/test throws on
 * the first violation (fail fast -- the bug surfaces at the first
 * failing call), production filters the modifier out and reports via
 * console.error + domainViolations. The default reads the environment;
 * pipeline call sites never pass it explicitly.
 */
export function applyDomainGate(
  modifiers: StatModifier[],
  throwOnViolation = isDevOrTestEnv(),
): StatModifier[] {
  const accepted: StatModifier[] = []

  for (const modifier of modifiers) {
    const statDomain = STAT_DOMAIN[modifier.stat] ?? 'universal'
    const modifierDomain = modifier.domain ?? 'universal'

    if (statDomain === 'universal' || modifierDomain === statDomain) {
      accepted.push(modifier)
      continue
    }

    const violation: DomainViolation = { modifier, statDomain, modifierDomain }
    domainViolations.push(violation)

    const message = describeViolation(violation)

    if (throwOnViolation) {
      throw new Error(message)
    }

    console.error(message)
  }

  return accepted
}
