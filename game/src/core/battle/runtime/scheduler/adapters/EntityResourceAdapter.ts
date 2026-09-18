// runtime/scheduler/adapters/EntityResourceAdapter.ts -- M3
// ResourceAuthority over the current engine's entity resource fields.
//
// Scope: 'the' (entity.currentThe) ONLY -- mp/ward are deferred pending
// the M0 census (EntityVitalsSystem owns ward mutation; currentMp has
// its own mana-shield/cost paths). A resourceId with no wired channel is
// a STRUCTURAL failure (contract sec.50 -- broken wiring is not a combat
// outcome), so it throws CombatSettlementFault rather than silently
// no-op'ing.
//
// currentThe writes are direct field mutation -- matching the existing
// TheEconomy practice (grantThe / tryPayProcCost write entity.currentThe
// directly; the The pool has no vitals-event contract). gain routes
// through grantThe anyway so the cap stays single-authority; consume
// writes the clamped result directly like consumeResourceFor.
//
// Consume semantics: numeric consume is all-or-nothing -- an
// unaffordable amount throws CombatOperationSkip('insufficient_resource')
// and mutates NOTHING (mirroring tryPayProcCost's pay-or-fail gate);
// 'all' always resolves and drains the pool to 0. The resource ops are
// not liveness-gated: TheEconomy never checks alive (a dead participant's
// pool may still be drained by settlement hand-off).
//
// valueSource (P5 F-B): 'current' (default) resolves the spend at
// execution; 'cast_snapshot' asserts the numeric amount was frozen at
// cast (the skill spec's empowered-ultimate case -- later gains must not
// inflate the spend). Both share the same insufficient-check mechanic:
// a snapshot amount still cannot exceed what is actually in the pool.
// The pair amount:'all' + valueSource:'cast_snapshot' is contradictory
// ('all' is inherently resolve-at-execution) and faults loudly via
// CombatSettlementFault instead of silently picking one semantic.

import { grantThe } from '../../../../the-tu/TheEconomy'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatEntityId } from '../../../contracts/ids'
import type { ConsumeResourceValueSource } from '../../../contracts/operations'

import type { ResourceAuthority } from '../CombatAuthorityPorts'
import { CombatOperationSkip } from '../CombatOperationExecutor'
import { CombatSettlementFault } from '../CombatSettlementFault'

import { requireEntity, type CombatEntityLookup } from './lookups'

const RESOURCE_THE = 'the'

interface GainResult {
  before: number
  requested: number
  applied: number
  after: number
}

interface ConsumeResult {
  before: number
  requested: number | 'all'
  applied: number
  after: number
}

export class EntityResourceAdapter implements ResourceAuthority {
  constructor(private readonly resolveEntity: CombatEntityLookup) {}

  gain(
    targetId: CombatEntityId,
    resourceId: string,
    amount: number,
    _ctx: CombatAuthorityExecutionContext,
  ): GainResult {
    const entity = requireEntity(this.resolveEntity, targetId)
    this.requireChannel(resourceId)
    this.requireWellFormedAmount(amount, 'gain_resource')

    const before = entity.currentThe ?? 0
    grantThe(entity, amount)
    const after = entity.currentThe ?? 0
    return { before, requested: amount, applied: after - before, after }
  }

  consume(
    targetId: CombatEntityId,
    resourceId: string,
    amount: number | 'all',
    valueSource: ConsumeResourceValueSource | undefined,
    _ctx: CombatAuthorityExecutionContext,
  ): ConsumeResult {
    const entity = requireEntity(this.resolveEntity, targetId)
    this.requireChannel(resourceId)
    if (amount === 'all' && valueSource === 'cast_snapshot') {
      // 'all' resolves at execution; 'cast_snapshot' asserts the amount
      // was frozen at cast -- contradictory, so fault loudly rather than
      // silently pick one semantic (P5 F-B).
      throw new CombatSettlementFault(
        `EntityResourceAdapter: consume_resource amount 'all' cannot pair with valueSource 'cast_snapshot'`,
      )
    }
    if (
      valueSource !== undefined &&
      valueSource !== 'current' &&
      valueSource !== 'cast_snapshot'
    ) {
      throw new CombatSettlementFault(
        `EntityResourceAdapter: malformed consume_resource valueSource '${String(valueSource)}'`,
      )
    }
    if (amount !== 'all') {
      this.requireWellFormedAmount(amount, 'consume_resource')
    }

    const before = entity.currentThe ?? 0
    if (amount === 'all') {
      entity.currentThe = 0
      return { before, requested: 'all', applied: before, after: 0 }
    }
    if (before < amount) {
      throw new CombatOperationSkip(
        'insufficient_resource',
        `entity '${targetId}' has ${before} '${resourceId}', cannot consume ${amount}`,
      )
    }
    entity.currentThe = before - amount
    return { before, requested: amount, applied: amount, after: entity.currentThe }
  }

  private requireChannel(resourceId: string): void {
    if (resourceId !== RESOURCE_THE) {
      throw new CombatSettlementFault(
        `EntityResourceAdapter: no channel wired for resourceId '${resourceId}' (only 'the' is served in M3)`,
      )
    }
  }

  private requireWellFormedAmount(amount: number, opType: string): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new CombatSettlementFault(
        `EntityResourceAdapter: malformed ${opType} amount ${amount}`,
      )
    }
  }
}
