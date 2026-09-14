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
  | 'kiem_tu'
  | 'hoa_tu'
  | 'production'
  | 'cultivation'
  | 'equipment_meta'
  | 'artifact'
  | 'realm'

// Stat -> owning domain. Stats absent from this registry are universal:
// they accept modifiers from every domain (INV-9). Starts EMPTY -- later
// migration tasks populate it per-domain so in-flight content never
// breaks. Tests may register temporary entries via direct mutation.
export const STAT_DOMAIN: Partial<Record<StatType, StatDomain>> = {}

// Source-file -> domain authoring whitelist (spec section 2.1). Each
// entry is a predicate: `file` identifies the authoring file path,
// optional `stats` scopes the grant to specific stats inside a mixed
// file. Consumed by the architecture lint test at build time, not at
// runtime -- the runtime gate alone guards system-emitted modifiers.
// Starts EMPTY alongside STAT_DOMAIN; populated per-domain by later
// tasks.
export const DOMAIN_SOURCE_WHITELIST: Record<
  string,
  Array<{ file: string; stats?: StatType[] }>
> = {}

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
