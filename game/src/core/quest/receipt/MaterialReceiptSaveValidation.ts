import { validateProductionCursor } from '../../production/ProductionReceiptCursor'
import { parseMaterialReceiptState, parseMaterialConsumerCheckpoint, type MaterialReceiptState } from '../../material/MaterialReceipt'
export function validateMaterialReceiptSave(input: unknown, consumerInput: unknown, productionSites?: unknown): MaterialReceiptState | null {
  const producer = parseMaterialReceiptState(input)
  const consumer = parseMaterialConsumerCheckpoint(consumerInput)
  if (!producer || !consumer || consumer.playerId !== producer.playerId || consumer.runId !== producer.runId ||
    consumer.acknowledgedThrough !== producer.acknowledgedThrough) return null
  for (const grant of producer.pending) {
    if (grant.sourceId === `inventory:${producer.runId}:${grant.sequence}`) continue
    const origin = /^production:([^:]+):(\d+):(\d+)$/.exec(grant.sourceId)
    if (!origin || !Array.isArray(productionSites)) return null
    const site = productionSites.find((candidate: unknown) => typeof candidate === 'object' && candidate !== null &&
      'siteId' in candidate && candidate.siteId === origin[1])
    if (!site || !validateProductionCursor(site.receiptCursor)) return null
    const ordinal = Number(origin[2])
    if (!Number.isSafeInteger(ordinal) || ordinal < 1 ||
      (ordinal > site.receiptCursor.settledThrough && !site.receiptCursor.settledAhead.includes(ordinal))) return null
  }
  return producer
}
