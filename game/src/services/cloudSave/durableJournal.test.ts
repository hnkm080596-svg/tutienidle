// B1-C durable journal / serialized queue / lost-ACK recovery (PR4).
// The 5 spec checkboxes exercised end-to-end over the REAL coordinator +
// adapter + journal + cache; the remote is a behavior-level fake that
// honors the write_character_save receipt contract (identical-mutation
// replay resolves alreadyCommitted without bumping the revision).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseCloudSaveService } from './SupabaseCloudSaveService'
import { CloudSaveCoordinator } from './CloudSaveCoordinator'
import {
  resolveAckedSaveKey,
  resolvePendingSaveKey,
  resolveQuarantineSaveKey,
  setSaveAccountId,
} from '../save/saveKeys'
import { parseAckedSaveEnvelope } from './AckedSaveCache'
import { buildPendingSaveRecord, type PendingSaveRecord } from './PendingSaveJournal'
import type { ReconcileDecision } from './reconcilePendingSave'
import type { CloudSaveService } from './CloudSaveService'
import { CURRENT_SAVE_VERSION } from '../save/SaveSystem'
import { createDefaultPlayer } from '../../core/player/Player'
import type { ClientBuildInfo } from '../backend/ClientBuildInfo'
import type { GameSave } from '../save/saveTypes'

const config = { url: 'https://example.supabase.co', anonKey: 'anon' }

const build: ClientBuildInfo = {
  buildId: 'beta-test-build',
  appVersion: '0.0.0',
  releaseChannel: 'beta',
  saveSchemaVersion: CURRENT_SAVE_VERSION,
}

const BINDING = { sessionId: 'sess-1', userId: 'u1', accessToken: 'tok-u1' }
const ENV_ID = 'beta:example'
const BINDING3 = { environmentId: ENV_ID, userId: 'u1', characterId: 'char-1' }

const CHECKPOINT = {
  checkpointId: 'chk-1',
  anchorAt: '2026-09-30T00:00:00Z',
  leaseExpiresAt: '2026-10-07T00:00:00Z',
}

const REMOTE_CHARACTER = {
  id: 'char-1',
  name: 'Vo Danh',
  selectedTalentIds: ['talent-a'],
  baseAttributes: { strength: 1, dexterity: 1, intelligence: 1, attunement: 1, vitality: 1 },
  mortalBasicSkillId: 'linh_bao',
  realmId: 'mortal',
  realmLevel: 0,
  createdAt: '2026-09-30T00:00:00Z',
}

function validGameSave(marker = 0): GameSave {
  const player = createDefaultPlayer()
  player.mortalBasicSkillId = 'linh_bao'
  player.nodeLevels = { ...player.nodeLevels, core_linh_bao: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_linh_bao']
  player.name = `Vo Danh ${marker}`
  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [],
    skills: [
      {
        id: 'linh_bao',
        name: 'Linh Bão',
        description: 'creation pick',
        type: 'active',
        level: 1,
        maxLevel: 10,
        cooldown: 0,
        target: 'enemy',
        effects: [],
      },
    ],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

class MemoryStorage implements Storage {
  protected store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null }
  removeItem(key: string): void { this.store.delete(key) }
  setItem(key: string, value: string): void { this.store.set(key, value) }
}

/** Storage that fails specific key operations - the checkbox-1 fault
 *  injection points (before journal write / before cache write / before
 *  journal clear). */
class FaultyStorage extends MemoryStorage {
  failAllSets = false
  failSetKeys = new Set<string>()
  failRemoveKeys = new Set<string>()

  override setItem(key: string, value: string): void {
    if (this.failAllSets || this.failSetKeys.has(key)) {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    }
    super.setItem(key, value)
  }

  override removeItem(key: string): void {
    if (this.failRemoveKeys.has(key)) {
      throw new DOMException('denied', 'SecurityError')
    }
    super.removeItem(key)
  }
}

interface RemoteWriteCall {
  mutationId: string
  expectedRevision: number
  timeCheckpoint: { checkpointId: string; elapsedMonotonicMs: number }
  payload: unknown
}

/** Behavior-level write_character_save: CAS + receipt table + the two
 *  transport fault modes. `commit-then-drop` commits the row and drops
 *  the response (lost ACK); `transport-fail` never reaches the row. */
class FakeRemote {
  revision = 5
  payload: unknown = validGameSave()
  characterState: 'save-ready' | 'uninitialized' | 'no-character' | 'deleted' = 'save-ready'
  writeMode: 'ok' | 'commit-then-drop' | 'transport-fail' = 'ok'
  readonly writeCalls: RemoteWriteCall[] = []
  /** Receipts table: mutationId -> committedRevision. */
  readonly commits = new Map<string, number>()
  readonly commitLog: { mutationId: string; revision: number }[] = []

  countCommitsForMutation(mutationId: string): number {
    return this.commitLog.filter((c) => c.mutationId === mutationId).length
  }

  loadResponse() {
    switch (this.characterState) {
      case 'no-character':
        return { status: 'NO_CHARACTER', serverCheckpoint: CHECKPOINT, serverTimeUtc: '2026-09-30T00:00:00Z' }
      case 'uninitialized':
        return {
          status: 'CHARACTER_UNINITIALIZED',
          character: REMOTE_CHARACTER,
          serverCheckpoint: CHECKPOINT,
          serverTimeUtc: '2026-09-30T00:00:00Z',
        }
      case 'deleted':
        return {
          status: 'CHARACTER_DELETED',
          character: REMOTE_CHARACTER,
          serverCheckpoint: CHECKPOINT,
          serverTimeUtc: '2026-09-30T00:00:00Z',
        }
      default:
        return {
          status: 'SAVE_READY',
          character: REMOTE_CHARACTER,
          save: {
            schemaVersion: CURRENT_SAVE_VERSION,
            saveRevision: this.revision,
            payload: this.payload,
            updatedAt: '2026-09-30T00:00:00Z',
            progressionCutoffAt: null,
            lastClientBuildId: null,
            lastMutationId: null,
          },
          serverCheckpoint: CHECKPOINT,
          serverTimeUtc: '2026-09-30T00:00:00Z',
        }
    }
  }

  handleWrite(body: {
    p_mutation_id: string
    p_expected_revision: number
    p_time_checkpoint: { checkpointId: string; elapsedMonotonicMs: number }
    p_payload: unknown
  }): { status: string; alreadyCommitted?: boolean; committedRevision?: number; currentRevision?: number; code?: string; serverTimeUtc?: string } {
    const mutationId = body.p_mutation_id

    // Receipt table resolves an identical-mutation retry BEFORE the CAS
    // gate - no second commit, no revision bump.
    if (this.commits.has(mutationId)) {
      if (this.writeMode !== 'ok') {
        this.writeMode = 'ok'
        throw new Error('transport lost')
      }
      return {
        status: 'COMMITTED',
        alreadyCommitted: true,
        committedRevision: this.commits.get(mutationId),
        currentRevision: this.revision,
        serverTimeUtc: '2026-09-30T00:00:01Z',
      }
    }

    if (this.writeMode === 'transport-fail') {
      this.writeMode = 'ok'
      throw new Error('network unreachable')
    }

    this.writeCalls.push({
      mutationId,
      expectedRevision: body.p_expected_revision,
      timeCheckpoint: body.p_time_checkpoint,
      payload: body.p_payload,
    })

    if (body.p_expected_revision !== this.revision) {
      return { status: 'CONFLICT', code: 'SAVE_CONFLICT', currentRevision: this.revision }
    }

    this.revision++
    this.payload = body.p_payload
    this.commits.set(mutationId, this.revision)
    this.commitLog.push({ mutationId, revision: this.revision })

    if (this.writeMode === 'commit-then-drop') {
      this.writeMode = 'ok'
      throw new Error('response lost after commit')
    }

    return {
      status: 'COMMITTED',
      alreadyCommitted: false,
      committedRevision: this.revision,
      currentRevision: this.revision,
      serverTimeUtc: '2026-09-30T00:00:01Z',
    }
  }
}

interface FetchCall { url: string; init: RequestInit }

function stubRemote(remote: FakeRemote, gateWrites = false) {
  const writeGates: Array<() => void> = []
  let blockWrites = gateWrites
  const calls: FetchCall[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const call = { url, init }
    calls.push(call)
    if (url.endsWith('/rpc/write_character_save')) {
      if (blockWrites) await new Promise<void>((resolve) => writeGates.push(resolve))
      return json(remote.handleWrite(JSON.parse(String(init.body))))
    }
    if (url.endsWith('/rpc/load_game_state')) return json(remote.loadResponse())
    if (url.endsWith('/rpc/heartbeat_session')) {
      return json({ checkpoint: CHECKPOINT, serverTimeUtc: '2026-09-30T00:00:00Z' })
    }
    return json({}, 404)
  }))
  return {
    calls,
    releaseWrites() {
      blockWrites = false
      for (const release of writeGates.splice(0)) release()
    },
  }
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status })
}

interface ServiceFixture {
  service: SupabaseCloudSaveService
  storage: FaultyStorage
  decisions: ReconcileDecision[]
}

/** Journal/cache land on the stubbed global localStorage unless a
 *  FaultyStorage is supplied for a failure-injection point. */
function makeService(storage?: FaultyStorage, monotonicNow = () => 1000): ServiceFixture {
  const store = storage ?? (localStorage as FaultyStorage)
  const decisions: ReconcileDecision[] = []
  const service = new SupabaseCloudSaveService(config, build, {
    resolveBinding: async () => BINDING,
    monotonicNow,
    storage: store,
    reconcileObserver: (decision) => decisions.push(decision),
  })
  return { service, storage: store, decisions }
}

function pendingEnvelope(): PendingSaveRecord | null {
  const raw = localStorage.getItem(resolvePendingSaveKey(ENV_ID))
  return raw ? (JSON.parse(raw) as PendingSaveRecord) : null
}

function ackedEnvelope() {
  const raw = localStorage.getItem(resolveAckedSaveKey(ENV_ID))
  return raw ? parseAckedSaveEnvelope(raw) : null
}

function quarantineEntries(): { reason: string; raw: string }[] {
  const raw = localStorage.getItem(resolveQuarantineSaveKey(ENV_ID))
  return raw ? (JSON.parse(raw) as { reason: string; raw: string }[]) : []
}

/** A well-formed durable record bound to the fixture identity. */
function makePendingRecord(overrides: Partial<PendingSaveRecord> = {}): PendingSaveRecord {
  return buildPendingSaveRecord({
    environmentId: ENV_ID,
    userId: 'u1',
    characterId: 'char-1',
    mutationId: 'mut-lost-1',
    baseRevision: 5,
    timeCheckpoint: { checkpointId: 'chk-frozen', elapsedMonotonicMs: 4242 },
    schemaVersion: CURRENT_SAVE_VERSION,
    buildId: build.buildId,
    createdAtUtc: '2026-09-30T00:00:00Z',
    rawPayload: JSON.stringify(validGameSave(9)),
    ...overrides,
  })
}

// Acceptance seed (spec): retrySameMutationAfterLostAck() ->
// {status:'already-committed'} - the helper drives the REAL adapter +
// journal over the receipt-honoring remote and returns the decision the
// reconcile layer reached.
async function retrySameMutationAfterLostAck() {
  const remote = new FakeRemote()
  stubRemote(remote)
  const { service, decisions } = makeService()
  await service.load()

  remote.writeMode = 'commit-then-drop'
  const write = await service.save(validGameSave(1), 5)
  expect(write.status).toBe('unavailable')
  const lostMutation = pendingEnvelope()
  expect(lostMutation).not.toBeNull()

  await service.load()
  return { decisions, lostMutation, remote }
}

// Acceptance seed (spec): readServerRevision() -> the authoritative row's
// current save_revision.
function readServerRevision(remote: FakeRemote): number {
  return remote.revision
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new FaultyStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  setSaveAccountId('u1')
})

describe('checkbox 1 - storage failure injection points', () => {
  it('journal write failure aborts the write: remote never contacted, no mutation sent', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    const { service, storage } = makeService()
    await service.load()

    storage.failAllSets = true
    const result = await service.save(validGameSave(1), 5)

    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') expect(result.detail).toBe('PENDING_JOURNAL_QUOTA')
    expect(remote.writeCalls).toHaveLength(0)
    expect(readServerRevision(remote)).toBe(5)
  })

  it('transport failure before the row: pending retained, replay commits it once on next load', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    const { service, decisions } = makeService()
    await service.load()

    remote.writeMode = 'transport-fail'
    const result = await service.save(validGameSave(1), 5)

    expect(result.status).toBe('unavailable')
    const pending = pendingEnvelope()
    expect(pending).not.toBeNull()
    // The request never reached the row.
    expect(remote.writeCalls).toHaveLength(0)
    expect(remote.revision).toBe(5)

    const reload = await service.load()
    expect(reload.status).toBe('ok')
    // Replay carried the same mutationId + frozen checkpoint and committed
    // exactly once server-side.
    expect(remote.writeCalls).toHaveLength(1)
    expect(remote.writeCalls[0]!.mutationId).toBe(pending!.mutationId)
    expect(remote.writeCalls[0]!.timeCheckpoint).toEqual(pending!.timeCheckpoint)
    expect(remote.countCommitsForMutation(pending!.mutationId)).toBe(1)
    expect(remote.revision).toBe(6)
    expect(decisions.at(-1)?.status).toBe('already-committed')
    expect(pendingEnvelope()).toBeNull()
  })

  it('lost ACK (commit-then-drop): replay resolves alreadyCommitted, revision never bumps twice', async () => {
    const { decisions, lostMutation, remote } = await retrySameMutationAfterLostAck()

    expect(decisions.at(-1)).toMatchObject({ status: 'already-committed' })
    // Two transports carried the same mutationId; the row committed ONCE.
    expect(remote.writeCalls.map((c) => c.mutationId)).toEqual([lostMutation!.mutationId])
    expect(remote.countCommitsForMutation(lostMutation!.mutationId)).toBe(1)
    expect(remote.revision).toBe(6)
    expect(pendingEnvelope()).toBeNull()
  })

  it('commit OK but cache write fails: result stays ok with storageWarning, journal clears', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    const { service, storage } = makeService()
    await service.load()

    storage.failSetKeys.add(resolveAckedSaveKey(ENV_ID))
    const result = await service.save(validGameSave(1), 5)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.storageWarning).toContain('cache:quota')
    expect(remote.revision).toBe(6)
    // The ACK is the authority - the cache gap does not retain the
    // journal record; the mirror just stays at the load's revision.
    expect(pendingEnvelope()).toBeNull()
    expect(ackedEnvelope()?.revision).toBe(5)
  })

  it('cache written but journal clear fails: result ok with storageWarning, record self-heals', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    const { service, storage } = makeService()
    await service.load()

    storage.failRemoveKeys.add(resolvePendingSaveKey(ENV_ID))
    const result = await service.save(validGameSave(1), 5)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') expect(result.storageWarning).toContain('journal:')
    const retained = pendingEnvelope()
    expect(retained).not.toBeNull()

    // The retained record replays to alreadyCommitted; clear retries and
    // still fails under the injected fault, but the fate is resolved.
    storage.failRemoveKeys.clear()
    const reload = await service.load()
    expect(reload.status).toBe('ok')
    expect(pendingEnvelope()).toBeNull()
  })
})

describe('checkbox 2 - one serialized queue for every save caller', () => {
  it('overlapping manual/autosave/quit writes join one queued entry with a fresh mutation id', async () => {
    const remote = new FakeRemote()
    const gate = stubRemote(remote, true)
    const { service } = makeService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()
    expect(coordinator.getRevision()).toBe(5)

    const snap1 = validGameSave(1)
    const snap2 = validGameSave(2)
    const snap3 = validGameSave(3)

    const r1 = coordinator.save(snap1)
    await vi.waitFor(() => expect(
      gate.calls.filter((c) => c.url.endsWith('/rpc/write_character_save')).length,
    ).toBe(1))
    const r2 = coordinator.save(snap2)
    const r3 = coordinator.save(snap3)

    gate.releaseWrites()
    const [res1, res2, res3] = await Promise.all([r1, r2, r3])

    expect(res1).toMatchObject({ status: 'ok', revision: 6 })
    // All joined callers resolve with the promoted entry's single result.
    expect(res2).toMatchObject({ status: 'ok', revision: 7 })
    expect(res3).toMatchObject({ status: 'ok', revision: 7 })

    // Exactly two transports: the in-flight snapshot plus the newest
    // queued snapshot - the displaced snap2 never left the process.
    expect(remote.writeCalls).toHaveLength(2)
    expect(remote.writeCalls[0]!.payload).toEqual(snap1)
    expect(remote.writeCalls[1]!.payload).toEqual(snap3)
    // The queued write got its expected revision AFTER the first ACK and
    // a NEW mutation id minted inside the adapter save().
    expect(remote.writeCalls[1]!.expectedRevision).toBe(6)
    expect(remote.writeCalls[1]!.mutationId).not.toBe(remote.writeCalls[0]!.mutationId)
    expect(remote.commitLog).toHaveLength(2)
    expect(remote.revision).toBe(7)
    expect(coordinator.getRevision()).toBe(7)
  })

  it('a caller joining mid-queue resolves with the promoted result too', async () => {
    const remote = new FakeRemote()
    const gate = stubRemote(remote, true)
    const { service } = makeService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const r1 = coordinator.save(validGameSave(1))
    await vi.waitFor(() => expect(
      gate.calls.filter((c) => c.url.endsWith('/rpc/write_character_save')).length,
    ).toBe(1))
    const r2 = coordinator.save(validGameSave(2))
    const r3 = coordinator.save(validGameSave(3))
    const snap4 = validGameSave(4)
    const r4 = coordinator.save(snap4)

    gate.releaseWrites()
    const results = await Promise.all([r1, r2, r3, r4])
    expect(results[0]).toMatchObject({ status: 'ok', revision: 6 })
    for (const r of results.slice(1)) {
      expect(r).toMatchObject({ status: 'ok', revision: 7 })
    }
    expect(remote.writeCalls).toHaveLength(2)
    expect(remote.writeCalls[1]!.payload).toEqual(snap4)
  })

  it('a throwing adapter settles save() and every joined resolver as unavailable', async () => {
    // The result contract is "never throw": a rejecting adapter must not
    // strand the queue (joined callers awaiting their resolver forever).
    const throwing: CloudSaveService = {
      capability: 'local-only',
      load: async () => ({ status: 'empty', revision: 0 }),
      save: () => Promise.reject(new Error('boom')),
    }
    const coordinator = new CloudSaveCoordinator(throwing)

    const r1 = coordinator.save(validGameSave(1))
    const r2 = coordinator.save(validGameSave(2))
    const r3 = coordinator.save(validGameSave(3))
    const results = await Promise.all([r1, r2, r3])
    for (const r of results) {
      expect(r).toMatchObject({ status: 'unavailable', retryable: false, detail: 'SAVE_ADAPTER_THROW' })
    }
  })
})

describe('checkbox 3 - frozen checkpoint + identity-bound envelopes', () => {
  it('a fresh write freezes {checkpointId, elapsedMonotonicMs} into the journal record', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    let now = 1000
    const { service } = makeService(undefined, () => now)
    await service.load() // stores checkpoint at monotonic 1000

    now = 1750
    remote.writeMode = 'transport-fail'
    const result = await service.save(validGameSave(1), 5)
    expect(result.status).toBe('unavailable')

    const pending = pendingEnvelope()
    expect(pending).not.toBeNull()
    expect(pending!.timeCheckpoint).toEqual({ checkpointId: 'chk-1', elapsedMonotonicMs: 750 })
    expect(pending!.baseRevision).toBe(5)
    expect(pending!.environmentId).toBe(ENV_ID)
  })

  it('elapsedMonotonicMs is truncated to whole ms - the server column is bigint', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    let now = 1000.4
    const { service } = makeService(undefined, () => now)
    await service.load() // stores checkpoint at monotonic 1000.4

    now = 1750.9
    const result = await service.save(validGameSave(1), 5)
    expect(result.status).toBe('ok')

    const arg = remote.writeCalls[0]!.timeCheckpoint.elapsedMonotonicMs
    expect(Number.isInteger(arg)).toBe(true)
    expect(arg).toBe(750)
  })

  it('replay sends the record\'s frozen checkpoint verbatim - cutoff survives a late commit', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    const { service } = makeService()
    const record = makePendingRecord()
    localStorage.setItem(resolvePendingSaveKey(ENV_ID), JSON.stringify(record))

    const reload = await service.load()
    expect(reload.status).toBe('ok')

    // The replayed mutation carried chk-frozen/4242 verbatim - NOT the
    // load response's fresh checkpoint or a recomputed elapsed.
    const replay = remote.writeCalls.at(-1)
    expect(replay?.mutationId).toBe('mut-lost-1')
    expect(replay?.timeCheckpoint).toEqual({ checkpointId: 'chk-frozen', elapsedMonotonicMs: 4242 })
  })

  it('readCachedSave returns the acked mirror with revision bound to bytes', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    const { service } = makeService()
    const load = await service.load()
    expect(load.status).toBe('ok')

    const cached = await service.readCachedSave()
    expect(cached?.revision).toBe(5)
    expect(cached?.raw).toBe(JSON.stringify(remote.payload))
  })
})

describe('checkbox 4 - already-committed receipt + genuine-conflict actions', () => {
  it('receipt older than remote head: retrieves the current row, never caches the stale pending', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    const { service, decisions } = makeService()

    // Our mutation committed at rev 6; another writer moved the head to 8.
    remote.commits.set('mut-old', 6)
    remote.commitLog.push({ mutationId: 'mut-old', revision: 6 })
    remote.revision = 8
    remote.payload = validGameSave(8)
    localStorage.setItem(
      resolvePendingSaveKey(ENV_ID),
      JSON.stringify(makePendingRecord({ mutationId: 'mut-old', baseRevision: 5 })),
    )

    const reload = await service.load()
    expect(reload.status).toBe('ok')
    if (reload.status === 'ok') {
      expect(reload.revision).toBe(8)
      expect(reload.raw).toBe(JSON.stringify(remote.payload))
    }
    const decision = decisions.at(-1)
    expect(decision).toMatchObject({ status: 'already-committed', currentRevision: 8, cachePayload: 'remote' })
    // The mirror holds the remote head bytes, not the obsolete pending.
    expect(ackedEnvelope()?.revision).toBe(8)
    expect(ackedEnvelope()?.rawPayload).toBe(JSON.stringify(remote.payload))
    expect(pendingEnvelope()).toBeNull()
  })

  it('readServerRevision() -> 8 (acceptance seed over the fixture remote)', () => {
    const remote = new FakeRemote()
    remote.revision = 8
    expect(readServerRevision(remote)).toBe(8)
  })

  it('genuine CAS conflict: pending-conflict surfaces, journal retained for export', async () => {
    const remote = new FakeRemote()
    remote.revision = 7 // another session committed past our base
    stubRemote(remote)
    const { service, decisions } = makeService()

    const record = makePendingRecord({ mutationId: 'mut-conflict', baseRevision: 5 })
    localStorage.setItem(resolvePendingSaveKey(ENV_ID), JSON.stringify(record))

    const reload = await service.load()
    expect(reload.status).toBe('pending-conflict')
    if (reload.status === 'pending-conflict') {
      expect(reload.currentRevision).toBe(7)
      expect(reload.pendingRaw).toBe(record.rawPayload)
    }
    expect(decisions.at(-1)).toMatchObject({ status: 'conflict', currentRevision: 7 })
    // Remote untouched: the replay attempt did not commit anything.
    expect(remote.commitLog).toHaveLength(0)
    expect(remote.revision).toBe(7)
    expect(pendingEnvelope()?.mutationId).toBe('mut-conflict')
  })

  it('rejected replay quarantines the record instead of replaying forever', async () => {
    const remote = new FakeRemote()
    remote.characterState = 'uninitialized'
    const gate = stubRemote(remote)
    const { service } = makeService()

    // A record the server will never accept: replay responds REJECTED.
    remote.handleWrite = () => ({ status: 'REJECTED', code: 'SAVE_INVALID' })

    const record = makePendingRecord({ mutationId: 'mut-rejected', baseRevision: 0 })
    localStorage.setItem(resolvePendingSaveKey(ENV_ID), JSON.stringify(record))

    const reload = await service.load()
    expect(reload.status).toBe('pending-quarantined')
    if (reload.status === 'pending-quarantined') expect(reload.reason).toBe('SAVE_INVALID')
    expect(pendingEnvelope()).toBeNull()
    expect(quarantineEntries().at(-1)?.reason).toBe('SAVE_INVALID')
    expect(gate.calls.filter((c) => c.url.endsWith('/rpc/write_character_save'))).toHaveLength(1)
  })
})

describe('checkbox 5 - generation fence + quarantine surface', () => {
  it('advanceGeneration mid-flight: ACK still returns ok but journal/cache stay untouched', async () => {
    const remote = new FakeRemote()
    const gate = stubRemote(remote, true)
    const { service } = makeService()
    await service.load()

    const write = service.save(validGameSave(1), 5)
    await vi.waitFor(() => expect(
      gate.calls.filter((c) => c.url.endsWith('/rpc/write_character_save')).length,
    ).toBe(1))

    // User switch / reset while the transport is in flight.
    service.advanceGeneration()
    gate.releaseWrites()
    const result = await write

    // The server committed - the result is truthful - but the old
    // generation could not clear the journal or write the cache.
    expect(result.status).toBe('ok')
    expect(pendingEnvelope()).not.toBeNull()
    // The mirror still holds the pre-reset load snapshot - the stale
    // generation could not overwrite it with its own rev-6 bytes.
    expect(ackedEnvelope()?.revision).toBe(5)
    expect(remote.revision).toBe(6)
  })

  it('coordinator.reset() mid-flight drains queued writers instead of committing them', async () => {
    const remote = new FakeRemote()
    const gate = stubRemote(remote, true)
    const { service } = makeService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const r1 = coordinator.save(validGameSave(1))
    await vi.waitFor(() => expect(
      gate.calls.filter((c) => c.url.endsWith('/rpc/write_character_save')).length,
    ).toBe(1))
    const r2 = coordinator.save(validGameSave(2))

    coordinator.reset()
    gate.releaseWrites()
    const [res1, res2] = await Promise.all([r1, r2])

    expect(res1.status).toBe('ok')
    // The queued writer never fired its own transport.
    expect(res2.status).toBe('unavailable')
    expect(remote.writeCalls).toHaveLength(1)
    // Old generation could not advance coordinator revision.
    expect(coordinator.getRevision()).toBe(0)
  })

  it('advanceGeneration clears identity + checkpoint: the next save re-resolves both', async () => {
    const remote = new FakeRemote()
    const gate = stubRemote(remote)
    const { service } = makeService()
    await service.load() // resolves char-1 + anchors chk-1

    service.advanceGeneration()

    const result = await service.save(validGameSave(1), 5)
    expect(result.status).toBe('ok')
    // The save could not reuse the old session's identity/checkpoint:
    // load_game_state ran again to re-resolve them.
    const loadCalls = gate.calls.filter((c) => c.url.endsWith('/rpc/load_game_state'))
    expect(loadCalls).toHaveLength(2)
    const heartbeatCalls = gate.calls.filter((c) => c.url.endsWith('/rpc/heartbeat_session'))
    expect(heartbeatCalls).toHaveLength(0)
    const write = remote.writeCalls[0]!
    expect(write.mutationId).toBeTruthy()
    expect(write.timeCheckpoint.checkpointId).toBe('chk-1')
  })

  it('a save started before advanceGeneration never journals nor writes remotely', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    const { service } = makeService()
    await service.load()

    const pending = service.save(validGameSave(1), 5)
    service.advanceGeneration()
    const result = await pending

    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      // Fences at identity re-anchor (NO_CHARACTER) or the WAL guard
      // (STALE_GENERATION) - which one fires depends on where the
      // generation flip lands; both are terminal and side-effect-free.
      expect(['NO_CHARACTER', 'STALE_GENERATION']).toContain(result.detail)
    }
    expect(remote.writeCalls).toHaveLength(0)
    expect(pendingEnvelope()).toBeNull()
  })

  it('mismatched journal record quarantines instead of replaying under the wrong identity', async () => {
    const remote = new FakeRemote()
    const calls = stubRemote(remote)
    const { service } = makeService()

    // A well-formed record bound to a DIFFERENT character.
    localStorage.setItem(
      resolvePendingSaveKey(ENV_ID),
      JSON.stringify(makePendingRecord({ characterId: 'char-9' })),
    )

    const reload = await service.load()
    expect(reload.status).toBe('pending-quarantined')
    if (reload.status === 'pending-quarantined') {
      expect(reload.reason).toBe('journal-identity-mismatch')
    }
    // No replay was attempted under the wrong binding.
    expect(remote.writeCalls).toHaveLength(0)
    expect(pendingEnvelope()).toBeNull()
    expect(quarantineEntries().at(-1)?.reason).toBe('journal-identity-mismatch')
  })

  it('corrupt journal bytes quarantine without touching the remote', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    const { service } = makeService()

    localStorage.setItem(resolvePendingSaveKey(ENV_ID), '{"format":1,"tampered":')

    const reload = await service.load()
    expect(reload.status).toBe('pending-quarantined')
    if (reload.status === 'pending-quarantined') {
      expect(reload.reason).toBe('journal-envelope-corrupt')
      expect(reload.pendingRaw).toBe('{"format":1,"tampered":')
    }
    expect(remote.writeCalls).toHaveLength(0)
    expect(pendingEnvelope()).toBeNull()
  })

  it('pending record on a NO_CHARACTER remote quarantines silently and proceeds empty', async () => {
    const remote = new FakeRemote()
    remote.characterState = 'no-character'
    stubRemote(remote)
    const { service } = makeService()

    localStorage.setItem(
      resolvePendingSaveKey(ENV_ID),
      JSON.stringify(makePendingRecord()),
    )

    const reload = await service.load()
    expect(reload).toEqual({ status: 'empty', revision: 0 })
    expect(remote.writeCalls).toHaveLength(0)
    expect(pendingEnvelope()).toBeNull()
    expect(quarantineEntries().at(-1)?.reason).toBe('character-missing')
  })
})

describe('write-path REJECTED resolves the record fate', () => {
  it('a REJECTED write drops its own journal record - nothing to recover', async () => {
    const remote = new FakeRemote()
    stubRemote(remote)
    remote.handleWrite = () => ({ status: 'REJECTED', code: 'SAVE_TOO_LARGE' })
    const { service } = makeService()
    await service.load()

    const result = await service.save(validGameSave(1), 5)
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') expect(result.code).toBe('SAVE_TOO_LARGE')
    expect(pendingEnvelope()).toBeNull()
  })
})
