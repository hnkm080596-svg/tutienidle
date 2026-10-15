import type {
  ProgressReceipt, ProgressReceiptLedgerState, ReceiptLedgerIdentity, ReceiptRecordResult,
} from './ProgressReceipt'
import {
  cloneLedger, natural, parseLedgerState, parseProgressReceipt, sourceKey, validId,
} from './ProgressReceiptValidation'

export type { ProgressReceipt, ProgressReceiptLedgerState, ReceiptLedgerIdentity, ReceiptRecordResult } from './ProgressReceipt'

/**
 * A ledger belongs to one durable player/run. No eviction: removing an entry
 * permits replay after offline restore. The producer owns event and source IDs.
 * Consumers must check eligibility and commit progress before recording.
 */
export class ProgressReceiptLedger {
  private readonly identity: ReceiptLedgerIdentity
  private state: ProgressReceiptLedgerState
  private readonly events = new Map<string, ProgressReceiptLedgerState['entries'][number]>()
  private readonly sources = new Map<string, ProgressReceiptLedgerState['entries'][number]>()

  constructor(identity: ReceiptLedgerIdentity) {
    if (!validId(identity.playerId) || !validId(identity.runId) || !natural(identity.enabledAtMs)) {
      throw new Error('A durable player/run identity and activation baseline are required')
    }
    this.identity = { ...identity }
    this.state = { version: 1, ...this.identity, revision: 0, entries: [] }
  }

  snapshot(): ProgressReceiptLedgerState {
    return cloneLedger(this.state)
  }

  restore(input: unknown): boolean {
    try {
      const next = parseLedgerState(input, this.identity)
      if (!next || next.revision < this.state.revision) return false
      const nextEvents = new Map(next.entries.map((entry) => [entry.receipt.eventId, entry] as const))
      for (const old of this.state.entries) {
        const match = nextEvents.get(old.receipt.eventId)
        if (!match || JSON.stringify(match.receipt) !== JSON.stringify(old.receipt) ||
          old.allocations.some((allocation) => !match.allocations.some((candidate) =>
            candidate.consumerId === allocation.consumerId && candidate.objectiveId === allocation.objectiveId))) {
          return false
        }
      }
      this.state = next
      this.events.clear()
      this.sources.clear()
      for (const entry of next.entries) {
        this.events.set(entry.receipt.eventId, entry)
        this.sources.set(sourceKey(entry.receipt), entry)
      }
      return true
    } catch {
      return false
    }
  }

  record(input: unknown, consumerId: string, objectiveId: string): ReceiptRecordResult {
    try {
      if (!validId(consumerId) || !validId(objectiveId)) return 'invalid'
      const receipt = parseProgressReceipt(input)
      if (!receipt) return 'invalid'
      if (receipt.playerId !== this.identity.playerId || receipt.runId !== this.identity.runId ||
        receipt.committedAtMs < this.identity.enabledAtMs) return 'stale'

      const byEvent = this.events.get(receipt.eventId)
      const bySource = this.sources.get(sourceKey(receipt))
      if ((byEvent && !sameReceipt(byEvent.receipt, receipt)) ||
        (bySource && !sameReceipt(bySource.receipt, receipt)) ||
        (byEvent && bySource && byEvent !== bySource)) return 'collision'

      const entry = byEvent ?? bySource
      if (entry?.allocations.some((allocation) => allocation.consumerId === consumerId &&
        allocation.objectiveId === objectiveId)) return 'duplicate'

      if (!Number.isSafeInteger(this.state.revision + 1)) return 'invalid'
      if (entry) {
        entry.allocations.push({ consumerId, objectiveId })
      } else {
        const created = { receipt, allocations: [{ consumerId, objectiveId }] }
        this.state.entries.push(created)
        this.events.set(receipt.eventId, created)
        this.sources.set(sourceKey(receipt), created)
      }
      this.state.revision++
      return 'applied'
    } catch {
      return 'invalid'
    }
  }
}

function sameReceipt(a: ProgressReceipt, b: ProgressReceipt): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
