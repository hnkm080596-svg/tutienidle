/** Inventory-owned delivery identity. History is a frontier, not an event archive. */
export interface MaterialReceipt {
  readonly version: 2
  readonly producer: 'inventory'
  readonly sequence: number
  readonly eventId: string
  readonly playerId: string
  readonly runId: string
  readonly sourceId: string
  readonly committedAtMs: number
  readonly units: number
  readonly payload: { readonly kind: 'material_delivered'; readonly materialId: string; readonly delivered: number }
}
export interface MaterialGrant {
  sequence: number
  playerId: string
  runId: string
  sourceId: string
  materialId: string
  requested: number
  overflow: number
  receipt: MaterialReceipt | null
}
export interface MaterialReceiptState {
  version: 2
  playerId: string
  runId: string
  sequence: number
  acknowledgedThrough: number
  pending: MaterialGrant[]
}
export interface MaterialConsumerCheckpoint {
  version: 2
  playerId: string
  runId: string
  acknowledgedThrough: number
}
export const MAX_PENDING_MATERIAL_DELIVERIES = 64
export const receiptId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 160 && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(v)
export const receiptNatural = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export function sameMaterialReceipt(left: MaterialReceipt, right: MaterialReceipt): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
const keys = (value: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(value).length === allowed.length && allowed.every((key) => Object.hasOwn(value, key))
export function validMaterialReceipt(value: unknown): value is MaterialReceipt {
  if (!object(value) || !keys(value, ['version', 'producer', 'sequence', 'eventId', 'playerId', 'runId', 'sourceId', 'committedAtMs', 'units', 'payload']) ||
    value.version !== 2 || value.producer !== 'inventory' || !receiptNatural(value.sequence) || value.sequence < 1 ||
    !receiptId(value.playerId) || !receiptId(value.runId) || !receiptId(value.sourceId) ||
    value.eventId !== `inventory:${value.runId}:${value.sequence}` || !receiptNatural(value.committedAtMs) ||
    !receiptNatural(value.units) || value.units < 1 || !object(value.payload) ||
    !keys(value.payload, ['kind', 'materialId', 'delivered'])) return false
  return value.payload.kind === 'material_delivered' && receiptId(value.payload.materialId) && value.payload.delivered === value.units
}
export function parseMaterialReceiptState(value: unknown): MaterialReceiptState | null {
  if (!object(value) || !keys(value, ['version', 'playerId', 'runId', 'sequence', 'acknowledgedThrough', 'pending']) || value.version !== 2 || !receiptId(value.playerId) || !receiptId(value.runId) ||
    !receiptNatural(value.sequence) || !receiptNatural(value.acknowledgedThrough) || value.acknowledgedThrough > value.sequence ||
    !Array.isArray(value.pending) || value.pending.length > MAX_PENDING_MATERIAL_DELIVERIES ||
    value.pending.length !== value.sequence - value.acknowledgedThrough) return null
  for (const [index, grant] of value.pending.entries()) {
    const sequence = value.acknowledgedThrough + index + 1
    if (!object(grant) || !keys(grant, ['sequence', 'playerId', 'runId', 'sourceId', 'materialId', 'requested', 'overflow', 'receipt']) || grant.sequence !== sequence || grant.playerId !== value.playerId || grant.runId !== value.runId ||
      !receiptId(grant.sourceId) || !receiptId(grant.materialId) || !receiptNatural(grant.requested) || grant.requested < 1 ||
      !receiptNatural(grant.overflow) || grant.overflow > grant.requested) return null
    const delivered = grant.requested - grant.overflow
    if (delivered === 0) { if (grant.receipt !== null) return null; continue }
    const r = grant.receipt
    if (!object(r) || !keys(r, ['version', 'producer', 'sequence', 'eventId', 'playerId', 'runId', 'sourceId', 'committedAtMs', 'units', 'payload']) || r.version !== 2 || r.producer !== 'inventory' || r.sequence !== sequence ||
      r.eventId !== `inventory:${value.runId}:${sequence}` || r.playerId !== value.playerId || r.runId !== value.runId ||
      r.sourceId !== grant.sourceId || !receiptNatural(r.committedAtMs) || r.units !== delivered || !object(r.payload) ||
      !keys(r.payload, ['kind', 'materialId', 'delivered']) || r.payload.kind !== 'material_delivered' || r.payload.materialId !== grant.materialId || r.payload.delivered !== delivered) return null
  }
  return structuredClone(value) as unknown as MaterialReceiptState
}
export function parseMaterialConsumerCheckpoint(value: unknown): MaterialConsumerCheckpoint | null {
  if (!object(value) || value.version !== 2 || !receiptId(value.playerId) || !receiptId(value.runId) ||
    !receiptNatural(value.acknowledgedThrough) || Object.keys(value).some((key) => !['version', 'playerId', 'runId', 'acknowledgedThrough'].includes(key))) return null
  return { version: 2, playerId: value.playerId, runId: value.runId, acknowledgedThrough: value.acknowledgedThrough }
}
