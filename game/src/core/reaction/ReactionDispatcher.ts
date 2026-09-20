// ReactionDispatcher.ts -- megaplan M5. The scheduler's immediate
// handler for 'elemental_application_committed': gate -> evaluate ->
// return the batch the scheduler's CombatOperationBatchRunner
// preflights + runs inside its batch frame (contract settlement.ts).
//
// REGISTRATION IS LIVE (seal/Ngo Dao mission): production wiring sits in
// GameManagerTurnBattleOps -- a production ReactionRegistry over
// CANONICAL_REACTIONS -> ReactionSystem -> this dispatcher ->
// scheduler.registerImmediateHandler('elemental_application_committed')
// -> elemental_reaction_enabled granted via the BuffSystem capability
// query.
//
// EVENT ORDERING: the dispatcher emits `reaction_resolved` at dispatch
// time -- the scheduler drains handler-emitted events AFTER the
// returned settlement, so consumers observe post-commit ordering
// identical to the headless runner's post-commit emission. A stale
// preflight abort inside the synchronous frame is impossible (nothing
// mutates between evaluate and the batch's own ops), so the emitted
// resolved event can never precede a skip the dispatcher could not
// foresee. `reaction_skipped` stays a batch-lane emission (the
// headless runner emits it post-preflight; the production frame
// records the skip in the combat trace -- the wiring mission decides
// whether the gameplay event also surfaces).

import type { ElementalApplicationCommitted } from '../battle/contracts/events'
import type { CombatEventSink } from '../battle/contracts/sink'
import type {
  CombatOperationBatch,
  ImmediateSettlement,
} from '../battle/contracts/settlement'
import type { ElementalStateRegistry } from './ElementalStateRegistry'
import { reactionResolvedPayload } from './ReactionEvents'
import {
  isConsumedParticipantRole,
  participantBuffIdLookup,
  type ReactionResolution,
} from './ReactionResolution'
import type { ReactionSystem } from './ReactionSystem'
import type { ReactionGateCheck } from './ReactionTriggerGate'

export class ReactionDispatcher {
  constructor(
    private readonly gate: ReactionGateCheck,
    private readonly system: ReactionSystem,
    private readonly elements: ElementalStateRegistry,
    /** Builds the CombatOperationBatch (preconditions + ordered ops)
        the scheduler's batch frame preflights + runs. Default wiring
        is `resolutionToBatch` -- injectable so tests can spy. */
    private readonly batchFactory: (
      resolution: ReactionResolution,
    ) => CombatOperationBatch,
  ) {}

  /** Scheduler's immediate handler for
      'elemental_application_committed'. `sink` is EVENT-SCOPED -- the
      scheduler supplies it per invocation and mints eventId +
      causationEventId itself, so the dispatcher emits envelope-free
      payloads. Returns {kind:'batch'} on resolution, or void when the
      gate/selection produces no reaction -- the scheduler drains it
      like any other immediate consequence. */
  onElementalApplicationCommitted(
    event: ElementalApplicationCommitted,
    sink: CombatEventSink,
  ): ImmediateSettlement | void {
    // Fast-path reject via the gate -- a non-'evaluate' verdict skips
    // the board read entirely. ReactionSystem re-checks internally as
    // the authoritative verdict path (pure idempotent check).
    if (this.gate.check(event) !== 'evaluate') return

    const result = this.system.evaluateAfterElementalApplication(event)
    if (result.kind !== 'resolved') return

    const resolution = result.resolution
    const consumed = resolution.context.participants.filter((p) =>
      isConsumedParticipantRole(p.role, resolution.context.relation),
    )
    sink.emit(
      reactionResolvedPayload(
        resolution.context,
        consumed,
        participantBuffIdLookup(this.elements),
      ),
    )
    return {
      kind: 'batch',
      batch: this.batchFactory(resolution),
    }
  }
}
