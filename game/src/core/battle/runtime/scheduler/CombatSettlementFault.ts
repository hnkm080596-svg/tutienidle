// runtime/scheduler/CombatSettlementFault.ts -- fatal settlement errors.
//
// A CombatSettlementFault means the battle's command graph or the
// settlement machinery itself is broken -- never a combat outcome
// (contract sec.50). Guard violations (nesting depth / per-root work
// budget), duplicate operation ids, malformed batches, missing authority
// ports and duplicate handler registration all land here.
//
// Guard violations additionally produce a CombatSettlementFaultEvent on
// the OUT-OF-BAND diagnostic lane (review r3 HIGH 6 + r4 MEDIUM 2): the
// event is stamped for trace completeness but is NEVER pushed to any
// event queue -- a halted scheduler cannot drain its own fault.

import type { CombatSettlementFaultEvent } from '../../contracts/events'

/** Out-of-band diagnostic lane -- receives the stamped fault event. */
export interface CombatDiagnosticSink {
  emit(event: CombatSettlementFaultEvent): void
}

/** Guard reasons -- the only reasons the diagnostic event can carry. */
export type CombatSettlementGuardReason = CombatSettlementFaultEvent['reason']

export class CombatSettlementFault extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CombatSettlementFault'
  }
}
