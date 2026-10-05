// @vitest-environment jsdom
// W8-AUT audit repro harness (temp file - not part of the suite).
//
// Attacks the wave-7-adjudicated firstSave/commit arm gates @4f456cfd:
// the arm predicate `unavailable && !retryable && !(code && blacklist)`
// arms EVERYTHING not in NON_DATA_WEDGE_CODES - including uncoded
// results and the whole SERVER_ERROR bucket. On the firstSave path the
// armed scope is 'remote', whose only affirmative remedy on
// SaveIncompatibleScreen is reset_character (delete the server row).
// These tests drive the REAL useAppLifecycle.bootGame with stubbed
// deps and record which scope report() is armed with per detail class.
//
// Armed classes proven here:
//   (a) PENDING_JOURNAL_*   - local journal write fault; remote reset
//                             cannot help and burns the fresh character.
//   (b) COMMITTED_MALFORMED - the write COMMITTED; remote row now HAS a
//                             save - violates the "row is vacuous"
//                             premise the blacklist was justified on.
//   (c) CHECKPOINT_*        - authority refusal that self-heals on the
//                             next load (fresh checkpoint re-anchors).
//   (d) uncoded result      - CloudSaveCoordinator.adapterThrow /
//                             staleGenerationResult carry no `code` -
//                             the `code && blacklist` check passes
//                             trivially and arms 'remote' for pure
//                             local faults.
//   (e) NETWORK_UNAVAILABLE - blacklist control: must NOT arm.
//   (f) commit arm          - same SERVER_ERROR bucket on the post-
//                             accrual commit path arms 'local' - the
//                             intended, non-destructive scope.

import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useAppLifecycle } from './useAppLifecycle'
import type { CloudSaveWriteResult } from '../services/cloudSave/CloudSaveService'
import type { RemoteCharacterMetadata } from '../services/session/BackendStatus'
import type { GameSave } from '../services/save/SaveSystem'
import type { GameManager } from '../core/game/GameManager'

const CHARACTER: RemoteCharacterMetadata = {
  id: 'char-1',
  name: 'Tester',
  selectedTalentIds: [],
  baseAttributes: { strength: 5, dexterity: 5, intelligence: 5, attunement: 5, vitality: 5 },
  mortalBasicSkillId: null,
  realmId: 'mortal',
  realmLevel: 1,
  createdAt: '2026-01-01T00:00:00Z',
}

function unavailable(detail: string, code?: string): CloudSaveWriteResult {
  return {
    status: 'unavailable',
    message: `refused (${detail})`,
    retryable: false,
    code,
    detail,
  } as CloudSaveWriteResult
}

function makeStubs(remote: boolean) {
  const saveIssue = { report: vi.fn() }
  const authority = {
    canMutate: vi.fn(() => true),
    beginChecking: vi.fn(),
    markReady: vi.fn(),
    markFailed: vi.fn(),
    observeSaveResult: vi.fn(),
  }
  const boot = {
    startSaveLoad: vi.fn(),
    startInitializing: vi.fn(),
    enterGame: vi.fn(),
    fail: vi.fn(),
    requireCharacter: vi.fn(),
    showAuth: vi.fn(),
  }
  return {
    saveIssue,
    authority,
    boot,
    coordinator: {
      load: vi.fn(async () => ({
        status: 'uninitialized' as const,
        character: CHARACTER,
        revision: 0 as const,
      })),
      save: vi.fn(),
      reset: vi.fn(),
      capability: (remote ? 'remote-authoritative' : 'local-only') as 'local-only' | 'remote-authoritative',
    },
    player: {
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      restoreFromSave: vi.fn(),
      $state: {},
    },
    gameManager: {
      eventBus: { on: vi.fn(), off: vi.fn() },
      materialRegistry: { has: () => false },
      materialBag: { add: vi.fn() },
      productionSystem: { getSiteDefinitions: () => [] },
      setProductionAutoRestart: vi.fn(),
      setActivePlayer: vi.fn(),
      buildingManager: { add: vi.fn() },
      refreshAutoWorkerCapacity: vi.fn(),
      restoreFromSave: vi.fn(),
      freezeCombat: vi.fn(),
      resumeCombat: vi.fn(),
    } as unknown as GameManager,
    onError: vi.fn(),
    lifecycle: undefined as ReturnType<typeof useAppLifecycle> | undefined,
  }
}

type Stubs = ReturnType<typeof makeStubs>

function makeLifecycle(stubs: Stubs) {
  return useAppLifecycle({
    clock: { start: vi.fn(), stop: vi.fn(), nowSeconds: () => 0 },
    scheduleInterval: () => 0,
    clearHandle: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    boot: stubs.boot,
    coordinator: stubs.coordinator as never,
    authority: stubs.authority,
    player: stubs.player,
    gameManager: stubs.gameManager,
    tick: vi.fn(),
    offlineSummary: { show: vi.fn() },
    saveIssue: stubs.saveIssue as never,
    entryStage: ref('game'),
    restoreGameSession: vi.fn(() => ({ status: 'ok' as const, offline: { elapsedSeconds: 0, cultivation: 0 } })),
    persistPlayer: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
    onError: stubs.onError,
    unsupportedSaveNotice: vi.fn(),
    hardReset: vi.fn(),
  })
}

describe('W8-AUT - firstSave arm: SERVER_ERROR-bucket and uncoded refuses arm scope remote', () => {
  it.each([
    ['PENDING_JOURNAL_QUOTA', 'SERVER_ERROR'],
    ['COMMITTED_MALFORMED', 'SERVER_ERROR'],
    ['CHECKPOINT_EXPIRED', 'SERVER_ERROR'],
    ['CUTOFF_REGRESSION', 'SERVER_ERROR'],
    ['MUTATION_ID_REUSED', 'SERVER_ERROR'],
    ['SAVE_ADAPTER_THROW', undefined],
  ] as const)('detail=%s code=%s -> saveIssue.report arms remote', async (detail, code) => {
    const stubs = makeStubs(true)
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue(unavailable(detail, code))
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({
      createNewCharacter: true,
      onNewCharacter: vi.fn(),
    })

    expect(outcome.status).toBe('failed')
    expect(stubs.saveIssue.report).toHaveBeenCalledWith('corrupted', '', undefined, 'remote')
    expect(stubs.authority.markFailed).toHaveBeenCalledWith('recovery')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.onError).not.toHaveBeenCalled()

    lifecycle.stopAll()
  })

  it('control: NETWORK_UNAVAILABLE is blacklisted -> generic path, no remote arm', async () => {
    const stubs = makeStubs(true)
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue(
      unavailable('transport-refused', 'NETWORK_UNAVAILABLE'),
    )
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({
      createNewCharacter: true,
      onNewCharacter: vi.fn(),
    })

    expect(outcome.status).toBe('failed')
    expect(stubs.saveIssue.report).not.toHaveBeenCalled()
    expect(stubs.onError).toHaveBeenCalledTimes(1)
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  it('control: SAVE_INVALID still arms remote and skips markFailed (observeSaveResult owns the terminal)', async () => {
    const stubs = makeStubs(true)
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue(
      unavailable('SAVE_INVALID', 'SAVE_INVALID'),
    )
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({
      createNewCharacter: true,
      onNewCharacter: vi.fn(),
    })

    expect(outcome.status).toBe('failed')
    expect(stubs.saveIssue.report).toHaveBeenCalledWith('corrupted', '', undefined, 'remote')
    // markFailed-skip: SAVE_INVALID maps 'recovery' via observeSaveResult,
    // so the arm does not re-enter the terminal.
    expect(stubs.authority.markFailed).not.toHaveBeenCalled()

    lifecycle.stopAll()
  })
})

describe('W8-AUT - commit arm: same bucket arms scope local on the post-accrual commit', () => {
  it('SERVER_ERROR detail PENDING_JOURNAL_* on a committed-head boot arms local', async () => {
    const stubs = makeStubs(true)
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: { player: { lastSavedAt: 0 } } as unknown as GameSave,
      revision: 4,
      discardedEquipmentCount: 0,
      raw: '{}',
      serverAuthority: { serverNowMs: 1_700_000_000_000, cutoffMs: 1_700_000_000_000 },
    }))
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue(
      unavailable('PENDING_JOURNAL_QUOTA', 'SERVER_ERROR'),
    )
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    expect(stubs.saveIssue.report).toHaveBeenCalledWith('corrupted', '', undefined, 'local')
    expect(stubs.authority.markFailed).toHaveBeenCalledWith('recovery')

    lifecycle.stopAll()
  })
})
