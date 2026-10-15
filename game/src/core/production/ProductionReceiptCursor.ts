import type { ProductionCycle, ProductionReceiptCursor, ProductionSiteState } from './ProductionTypes'
import { MAX_PERSISTED_PRODUCTION_CYCLES_PER_SITE } from './ProductionTypes'
import { receiptNatural } from '../material/MaterialReceipt'
export function cursorFor(state: ProductionSiteState): ProductionReceiptCursor {
  return state.receiptCursor ??= { issuedThrough: 0, settledThrough: 0, settledAhead: [], legacyOrigins: [] }
}
export function issueProductionIdentity(state: ProductionSiteState): { cycleId: string; receiptOrdinal: number } {
  const cursor = cursorFor(state)
  if (!Number.isSafeInteger(cursor.issuedThrough + 1)) throw new Error('Production receipt sequence exhausted')
  const receiptOrdinal = ++cursor.issuedThrough
  return { cycleId: `production:${state.siteId}:${receiptOrdinal}`, receiptOrdinal }
}
export function cycleSettled(state: ProductionSiteState, cycle: ProductionCycle): boolean {
  const ordinal = cycle.receiptOrdinal
  const cursor = cursorFor(state)
  if (!ordinal || !Number.isSafeInteger(ordinal) || ordinal > cursor.issuedThrough) throw new Error('Unissued production cycle identity')
  return ordinal <= cursor.settledThrough || cursor.settledAhead.includes(ordinal)
}
export function markCycleSettled(state: ProductionSiteState, cycle: ProductionCycle): void {
  const cursor = cursorFor(state)
  if (cycleSettled(state, cycle)) return
  cursor.settledAhead.push(cycle.receiptOrdinal!)
  while (cursor.settledAhead.includes(cursor.settledThrough + 1)) {
    cursor.settledAhead.splice(cursor.settledAhead.indexOf(++cursor.settledThrough), 1)
  }
}
export function validateProductionCursor(input: unknown): input is ProductionReceiptCursor {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const value = input as Record<string, unknown>
  if (Object.keys(value).length !== 4 || !['issuedThrough', 'settledThrough', 'settledAhead', 'legacyOrigins'].every((key) => Object.hasOwn(value, key))) return false
  return receiptNatural(value.issuedThrough) && receiptNatural(value.settledThrough) && value.settledThrough <= value.issuedThrough &&
    Array.isArray(value.settledAhead) && value.settledAhead.length <= MAX_PERSISTED_PRODUCTION_CYCLES_PER_SITE &&
    value.settledAhead.every((ordinal) => receiptNatural(ordinal) && ordinal > (value.settledThrough as number) && ordinal <= (value.issuedThrough as number)) &&
    new Set(value.settledAhead).size === value.settledAhead.length && Array.isArray(value.legacyOrigins) &&
    value.legacyOrigins.length <= MAX_PERSISTED_PRODUCTION_CYCLES_PER_SITE && value.legacyOrigins.every((origin) =>
      origin && typeof origin === 'object' && typeof origin.cycleId === 'string' && origin.cycleId.length > 0 && origin.cycleId.length <= 160 && Object.keys(origin).length === 2 &&
      receiptNatural(origin.ordinal) && origin.ordinal > 0 && origin.ordinal <= (value.issuedThrough as number)) &&
    new Set(value.legacyOrigins.map((origin) => origin.cycleId)).size === value.legacyOrigins.length
}
export function admitCycleIdentity(state: ProductionSiteState, cycle: ProductionCycle): ProductionCycle {
  const cursor = cursorFor(state)
  if (cycle.receiptOrdinal !== undefined) {
    if (!Number.isSafeInteger(cycle.receiptOrdinal) || cycle.receiptOrdinal < 1 || cycle.receiptOrdinal > cursor.issuedThrough) throw new Error('Invalid production receipt ordinal')
    return { ...cycle }
  }
  const prior = cursor.legacyOrigins.find((origin) => origin.cycleId === cycle.cycleId)
  if (prior) return { ...cycle, receiptOrdinal: prior.ordinal }
  if (cursor.legacyOrigins.length >= MAX_PERSISTED_PRODUCTION_CYCLES_PER_SITE ||
    cursor.settledThrough > 0 || cursor.settledAhead.length > 0) throw new Error('Retired or unknown production origin')
  const identity = issueProductionIdentity(state)
  cursor.legacyOrigins.push({ cycleId: cycle.cycleId, ordinal: identity.receiptOrdinal })
  return { ...cycle, receiptOrdinal: identity.receiptOrdinal }
}
export function rollbackUnpublishedIssuance(state: ProductionSiteState, beforeIssued: number): void {
  const cursor = cursorFor(state)
  cursor.issuedThrough = Math.max(beforeIssued, cursor.settledThrough, ...cursor.settledAhead,
    ...(state.productionCycles ?? []).map((cycle) => cycle.receiptOrdinal ?? 0))
}

export function validateProductionReceiptSite(site: { siteId: string; receiptCursor?: ProductionReceiptCursor; productionCycles?: ProductionCycle[]; workerCycles?: ProductionCycle[] }): boolean {
  const cycles = site.productionCycles ?? site.workerCycles ?? []
  if (!Array.isArray(cycles) || cycles.some((cycle) => !cycle || typeof cycle !== 'object')) return false
  if (!site.receiptCursor) return cycles.every((cycle) => cycle.receiptOrdinal === undefined)
  if (!validateProductionCursor(site.receiptCursor)) return false
  const cursor = site.receiptCursor
  const represented = new Set(cursor.settledAhead)
  for (const cycle of cycles) {
    if (!receiptNatural(cycle.receiptOrdinal) || cycle.receiptOrdinal < 1 || cycle.receiptOrdinal > cursor.issuedThrough ||
      (cycle.cycleId !== `production:${site.siteId}:${cycle.receiptOrdinal}` &&
        !cursor.legacyOrigins.some((origin) => origin.cycleId === cycle.cycleId && origin.ordinal === cycle.receiptOrdinal))) return false
    if (cycle.receiptOrdinal > cursor.settledThrough) represented.add(cycle.receiptOrdinal)
  }
  if (cursor.issuedThrough - cursor.settledThrough > MAX_PERSISTED_PRODUCTION_CYCLES_PER_SITE) return false
  for (let ordinal = cursor.settledThrough + 1; ordinal <= cursor.issuedThrough; ordinal++) if (!represented.has(ordinal)) return false
  return true
}
