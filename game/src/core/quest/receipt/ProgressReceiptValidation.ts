import type { ProgressReceipt, ProgressReceiptLedgerState, ReceiptEntry, ReceiptLedgerIdentity, ReceiptAllocation } from './ProgressReceipt'

type Shape = {
  producer: ProgressReceipt['producer']
  ids: readonly string[]
  numbers?: readonly string[]
  naturals?: readonly string[]
  flags?: readonly string[]
  optionalIds?: readonly string[]
}

const shapes: Record<ProgressReceipt['payload']['kind'], Shape> = {
  material_delivered: { producer: 'inventory', ids: ['materialId'], numbers: ['delivered'] },
  production_batch_claimed: { producer: 'production', ids: ['batchId', 'siteKind'] },
  enemy_defeated: { producer: 'battle', ids: ['battleId', 'enemyId'], optionalIds: ['zoneId'] },
  battle_victory: { producer: 'battle', ids: ['battleId'], flags: ['formationAtBattleStart'] },
  stage_clear: { producer: 'battle', ids: ['stageId', 'battleId'], flags: ['formationAtBattleStart'] },
  realm_reached: { producer: 'realm', ids: ['realmId'] },
  element_attained: { producer: 'realm', ids: ['elementId'] },
  technique_rank_reached: { producer: 'technique', ids: ['techniqueId'], numbers: ['rank'] },
  skill_node_progress_committed: { producer: 'skill', ids: ['nodeId'], numbers: ['level'] },
  body_refinement_committed: { producer: 'body', ids: ['realmAtCommit'] },
  cultivation_session_committed: { producer: 'cultivation', ids: ['sessionId'] },
  equipment_equipped: { producer: 'equipment', ids: ['instanceId'] },
  equipment_enhanced: { producer: 'equipment', ids: ['instanceId', 'enhancementId'] },
  alchemy_crafted: { producer: 'alchemy', ids: ['craftId', 'recipeId'] },
  pill_used: { producer: 'pill', ids: ['pillId'] },
  companion_entitled: { producer: 'companion', ids: ['companionId'] },
  formation_companion_assigned: { producer: 'formation', ids: ['companionId'] },
  daily_quest_claimed: { producer: 'quest', ids: ['claimId'], naturals: ['utcDayBucket'] },
  weekly_quest_claimed: { producer: 'quest', ids: ['claimId'], naturals: ['utcWeekBucket'] },
  quest_claimed: { producer: 'quest', ids: ['questId', 'claimId'] },
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  return required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
}

export function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value)
}

export function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function positive(value: unknown): value is number {
  return natural(value) && value > 0
}

// Validates untrusted JSON at runtime. The cast is restricted to this checked boundary.
export function parseProgressReceipt(value: unknown): ProgressReceipt | null {
  if (!isObject(value) || !exactKeys(value, [
    'version', 'eventId', 'playerId', 'runId', 'sourceId', 'committedAtMs', 'units', 'producer', 'payload',
  ]) || value.version !== 1 || !validId(value.eventId) || !validId(value.playerId) ||
    !validId(value.runId) || !validId(value.sourceId) || !natural(value.committedAtMs) ||
    !positive(value.units) || !isObject(value.payload) || typeof value.payload.kind !== 'string' ||
    !Object.hasOwn(shapes, value.payload.kind)) return null

  const shape = shapes[value.payload.kind as keyof typeof shapes]
  if (value.producer !== shape.producer) return null
  const payload = value.payload
  const required = ['kind', ...shape.ids, ...(shape.numbers ?? []), ...(shape.naturals ?? []), ...(shape.flags ?? [])]
  if (!exactKeys(payload, required, shape.optionalIds) ||
    !shape.ids.every((name) => validId(payload[name])) ||
    !(shape.optionalIds ?? []).every((name) => payload[name] === undefined || validId(payload[name])) ||
    !(shape.numbers ?? []).every((name) => positive(payload[name])) ||
    !(shape.naturals ?? []).every((name) => natural(payload[name])) ||
    !(shape.flags ?? []).every((name) => typeof payload[name] === 'boolean')) return null

  if (payload.kind === 'material_delivered' ? payload.delivered !== value.units : value.units !== 1) return null
  const cleanPayload: Record<string, unknown> = { kind: payload.kind }
  for (const name of [...shape.ids, ...(shape.numbers ?? []), ...(shape.naturals ?? []),
    ...(shape.flags ?? []), ...(shape.optionalIds ?? [])]) {
    if (payload[name] !== undefined) cleanPayload[name] = payload[name]
  }
  return {
    version: 1, eventId: value.eventId, playerId: value.playerId, runId: value.runId,
    producer: shape.producer, sourceId: value.sourceId, committedAtMs: value.committedAtMs,
    units: value.units, payload: cleanPayload,
  } as unknown as ProgressReceipt
}

export function cloneLedger(state: ProgressReceiptLedgerState): ProgressReceiptLedgerState {
  return { ...state, entries: state.entries.map(({ receipt, allocations }) => ({
    receipt: structuredClone(receipt),
    allocations: allocations.map((allocation) => ({ ...allocation })),
  })) }
}

export function sourceKey(receipt: ProgressReceipt): string {
  return receipt.producer + '|' + receipt.payload.kind + '|' + receipt.sourceId
}

export function parseLedgerState(input: unknown, identity: ReceiptLedgerIdentity): ProgressReceiptLedgerState | null {
  if (!isObject(input) || !exactKeys(input, ['version', 'playerId', 'runId', 'enabledAtMs', 'revision', 'entries']) ||
    input.version !== 1 || input.playerId !== identity.playerId || input.runId !== identity.runId ||
    input.enabledAtMs !== identity.enabledAtMs || !natural(input.revision) || !Array.isArray(input.entries)) return null

  const events = new Set<string>()
  const sources = new Set<string>()
  const entries: ReceiptEntry[] = []
  let count = 0
  for (const entry of input.entries) {
    if (!isObject(entry) || !exactKeys(entry, ['receipt', 'allocations'])) return null
    const receipt = parseProgressReceipt(entry.receipt)
    if (!receipt || receipt.playerId !== identity.playerId || receipt.runId !== identity.runId ||
      receipt.committedAtMs < identity.enabledAtMs || events.has(receipt.eventId) ||
      sources.has(sourceKey(receipt)) || !Array.isArray(entry.allocations) || entry.allocations.length === 0) return null
    events.add(receipt.eventId)
    sources.add(sourceKey(receipt))
    const allocations: ReceiptAllocation[] = []
    const used = new Set<string>()
    for (const item of entry.allocations) {
      if (!isObject(item) || !exactKeys(item, ['consumerId', 'objectiveId']) ||
        !validId(item.consumerId) || !validId(item.objectiveId)) return null
      const key = JSON.stringify([item.consumerId, item.objectiveId])
      if (used.has(key)) return null
      used.add(key)
      allocations.push({ consumerId: item.consumerId, objectiveId: item.objectiveId })
      count++
      if (!Number.isSafeInteger(count)) return null
    }
    entries.push({ receipt, allocations })
  }
  if (count !== input.revision) return null
  return { version: 1, playerId: identity.playerId, runId: identity.runId,
    enabledAtMs: identity.enabledAtMs, revision: count, entries }
}
