// B1-D - the reconnect pipeline is ordered by spec: refresh auth (single
// flight, transient errors retain) -> heartbeat the ACTIVE game session
// (session revoke is a separate axis from Auth identity) -> load with
// journal reconcile -> lineage by revision. These tests pin the order and
// the terminal/unavailable classification of every failure point.
import { describe, expect, it, vi } from 'vitest'
import type { CloudSaveLoadResult, HeartbeatOutcome } from '../cloudSave/CloudSaveService'
import type { GameSave } from '../save/SaveSystem'
import { runReconnectPipeline, type ReconnectPipelineDeps } from './reconnectPipeline'

const fakeSave = { marker: true } as unknown as GameSave

function makeDeps(overrides: Partial<ReconnectPipelineDeps> = {}) {
  const order: string[] = []
  const deps: ReconnectPipelineDeps = {
    refreshAuth: vi.fn(async () => {
      order.push('refresh')
      return 'ok' as const
    }),
    heartbeat: vi.fn(async () => {
      order.push('heartbeat')
      return { status: 'ok' } as HeartbeatOutcome
    }),
    load: vi.fn(async () => {
      order.push('load')
      return { status: 'ok', save: fakeSave, revision: 4 } as CloudSaveLoadResult
    }),
    expectedRevision: () => 4,
    ...overrides,
  }
  return { deps, order }
}

describe('runReconnectPipeline — order and short-circuit', () => {
  it('happy path runs refresh -> heartbeat -> load in that order', async () => {
    const { deps, order } = makeDeps()
    const outcome = await runReconnectPipeline(deps)

    expect(order).toEqual(['refresh', 'heartbeat', 'load'])
    expect(outcome).toMatchObject({ status: 'resumed', lineage: 'same' })
  })

  it('refresh expired = terminal revoked; heartbeat/load never run', async () => {
    const { deps, order } = makeDeps({
      refreshAuth: vi.fn(async () => {
        order.push('refresh')
        return 'expired' as const
      }),
    })
    const outcome = await runReconnectPipeline(deps)

    expect(order).toEqual(['refresh'])
    expect(outcome).toEqual({ status: 'terminal', state: 'revoked' })
  })

  it('refresh unavailable = transient; downstream never runs', async () => {
    const { deps, order } = makeDeps({
      refreshAuth: vi.fn(async () => {
        order.push('refresh')
        return 'unavailable' as const
      }),
    })
    expect(await runReconnectPipeline(deps)).toEqual({ status: 'unavailable' })
    expect(order).toEqual(['refresh'])
  })

  it('heartbeat SESSION_REVOKED is terminal revoked; load never runs', async () => {
    const { deps, order } = makeDeps({
      heartbeat: vi.fn(async () => {
        order.push('heartbeat')
        return { status: 'unavailable', code: 'SESSION_REVOKED' } as HeartbeatOutcome
      }),
    })
    const outcome = await runReconnectPipeline(deps)

    expect(order).toEqual(['refresh', 'heartbeat'])
    expect(outcome).toEqual({ status: 'terminal', state: 'revoked' })
  })

  it('heartbeat transient codes map through the B1.7 taxonomy to unavailable', async () => {
    for (const code of ['NETWORK_UNAVAILABLE', 'SERVER_ERROR'] as const) {
      const { deps } = makeDeps({
        heartbeat: vi.fn(async () => ({ status: 'unavailable', code }) as HeartbeatOutcome),
      })
      expect(await runReconnectPipeline(deps)).toEqual({ status: 'unavailable' })
    }
  })

  it('heartbeat MAINTENANCE / PROTOCOL_OUTDATED / SAVE_CONFLICT map to their terminal states', async () => {
    const cases = [
      ['MAINTENANCE', 'maintenance'],
      ['PROTOCOL_OUTDATED', 'update-required'],
      ['SAVE_CONFLICT', 'conflict'],
    ] as const
    for (const [code, state] of cases) {
      const { deps } = makeDeps({
        heartbeat: vi.fn(async () => ({ status: 'unavailable', code }) as HeartbeatOutcome),
      })
      expect(await runReconnectPipeline(deps)).toEqual({ status: 'terminal', state })
    }
  })

  it('same revision resumes in-memory and hands back NO save (lineage same)', async () => {
    const { deps } = makeDeps({ expectedRevision: () => 4 })
    const outcome = await runReconnectPipeline(deps)

    expect(outcome).toMatchObject({ status: 'resumed', lineage: 'same', save: undefined })
  })

  it('a moved revision is replaced lineage: the authoritative save + server clock come back', async () => {
    const { deps } = makeDeps({
      load: vi.fn(async () => ({
        status: 'ok',
        save: fakeSave,
        revision: 9,
        serverAuthority: { cutoffMs: 111, serverNowMs: 222 },
      }) as CloudSaveLoadResult),
      expectedRevision: () => 4,
    })
    const outcome = await runReconnectPipeline(deps)

    expect(outcome).toMatchObject({
      status: 'resumed',
      lineage: 'replaced',
      save: fakeSave,
      serverAuthority: { cutoffMs: 111, serverNowMs: 222 },
    })
  })

  it('load unavailable classifies through the taxonomy; non-ok non-unavailable parks on recovery', async () => {
    const unavailable = makeDeps({
      load: vi.fn(async () => ({
        status: 'unavailable',
        code: 'SAVE_CONFLICT',
      }) as CloudSaveLoadResult),
    })
    expect(await runReconnectPipeline(unavailable.deps)).toEqual({
      status: 'terminal',
      state: 'conflict',
    })

    for (const status of ['deleted', 'corrupted', 'incompatible', 'pending-conflict'] as const) {
      const { deps } = makeDeps({
        load: vi.fn(async () => ({ status }) as CloudSaveLoadResult),
      })
      expect(await runReconnectPipeline(deps)).toEqual({ status: 'terminal', state: 'recovery' })
    }
  })
})
