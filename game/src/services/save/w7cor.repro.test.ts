// @vitest-environment jsdom
// W7-COR audit repro harness (temp file - not part of the suite).
//
// Target: the wave-6 firstSave arm gate (useAppLifecycle.ts:627-636)
// covers only the 'uninitialized' branch's first write. The 'ok'-load
// branch's B1-D post-accrual commit (useAppLifecycle.ts:502-532) writes
// through the same player.save() port and can receive the same
// deterministic server payload rejection (unavailable + !retryable +
// SAVE_INVALID / SAVE_TOO_LARGE from mapError's REJECTED class), but its
// failure path has no arm gate: the account wedges into the same
// boot-loop the wave-6 fix was built to break, with the remote reset
// affordance unarmed.
//
// Client-side claims are EXECUTED; the harness mirrors
// w5aut.repro.test.ts's makeStubs with an 'ok' load result.

import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { GameManager } from '../../core/game/GameManager'
import type { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import type { CloudSaveLoadResult } from '../cloudSave/CloudSaveService'
import type { GameSave } from './saveTypes'
import type { BackendErrorCode } from '../session/BackendStatus'

function makeStubs(loadResult: CloudSaveLoadResult, saveCode: BackendErrorCode) {
  const intervals: Array<() => void> = []
  return {
    clock: { start: vi.fn(), stop: vi.fn(), nowSeconds: () => 0 },
    intervals,
    scheduleInterval: (callback: () => void, _timeoutMs: number): number => {
      intervals.push(callback)
      return intervals.length
    },
    clearHandle: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    boot: {
      startSaveLoad: vi.fn(),
      startInitializing: vi.fn(),
      enterGame: vi.fn(),
      fail: vi.fn(),
      requireCharacter: vi.fn(),
      showAuth: vi.fn(),
    },
    coordinator: {
      load: vi.fn(async () => loadResult),
      save: vi.fn(),
      reset: vi.fn(),
      capability: 'remote-authoritative' as const,
    } as unknown as CloudSaveCoordinator,
    player: {
      save: vi.fn(async () => ({
        status: 'unavailable' as const,
        message: 'server refused payload',
        retryable: false,
        code: saveCode,
      })),
      restoreFromSave: vi.fn(),
      $state: {},
    },
    authority: {
      canMutate: vi.fn(() => true),
      beginChecking: vi.fn(),
      markReady: vi.fn(),
      markFailed: vi.fn(),
      observeSaveResult: vi.fn(),
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
    tick: vi.fn(),
    offlineSummary: { show: vi.fn() },
    saveIssue: { report: vi.fn() },
    entryStage: ref('game'),
    restoreGameSession: vi.fn(() => ({
      status: 'ok' as const,
      offline: { elapsedSeconds: 0, cultivation: 0 },
    })),
    persistPlayer: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
    onError: vi.fn(),
    unsupportedSaveNotice: vi.fn(),
    hardReset: vi.fn(),
  }
}

function makeLifecycle(stubs: ReturnType<typeof makeStubs>) {
  return useAppLifecycle({
    clock: stubs.clock,
    scheduleInterval: stubs.scheduleInterval,
    clearHandle: stubs.clearHandle,
    addEventListener: stubs.addEventListener,
    removeEventListener: stubs.removeEventListener,
    boot: stubs.boot,
    coordinator: stubs.coordinator,
    authority: stubs.authority,
    player: stubs.player as never,
    gameManager: stubs.gameManager,
    tick: stubs.tick,
    offlineSummary: stubs.offlineSummary,
    saveIssue: stubs.saveIssue,
    entryStage: stubs.entryStage as never,
    restoreGameSession: stubs.restoreGameSession as never,
    persistPlayer: stubs.persistPlayer,
    onError: stubs.onError,
    unsupportedSaveNotice: stubs.unsupportedSaveNotice,
    hardReset: stubs.hardReset,
  })
}

describe('W7-COR: B1-D commit write reject vs the wave-6 arm gate', () => {
  it('OK-LOAD + permanent SAVE_INVALID on the post-accrual commit -> generic fail, NO remote reset arm (arm gate missed this write)', async () => {
    const save = {
      player: { lastSavedAt: 0, artifact: null },
      alchemyJobs: [],
      decompose: {},
    } as unknown as GameSave
    const stubs = makeStubs(
      {
        status: 'ok',
        save,
        revision: 3,
        discardedEquipmentCount: 0,
        raw: 'raw-bytes',
        serverAuthority: { serverNowMs: 1000 },
      },
      'SAVE_INVALID',
    )
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({
      createNewCharacter: false,
      onNewCharacter: vi.fn(),
    })

    // Same defect class as W5-AUT-1/W6-COR-2: a deterministic 'this data
    // can never commit' verdict from the server, but on the B1-D commit
    // write there is no gate -> every retry boots, loads 'ok', commits,
    // is rejected again, and the recovery surface never arms.
    expect(outcome.status).toBe('failed')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.authority.observeSaveResult).toHaveBeenCalledTimes(1)
    expect(stubs.saveIssue.report).not.toHaveBeenCalled()
    expect(stubs.authority.markFailed).not.toHaveBeenCalledWith('recovery')

    lifecycle.stopAll()
  })

  it('CONTROL: same reject on the uninitialized first save DOES arm the remote reset surface (wave-6 gate fires only there)', async () => {
    const stubs = makeStubs(
      {
        status: 'uninitialized',
        revision: 0,
        character: {
          id: 'char-1',
          name: 'tester',
          selectedTalentIds: [],
          baseAttributes: {
            strength: 1,
            dexterity: 1,
            intelligence: 1,
            attunement: 1,
            vitality: 1,
          },
          mortalBasicSkillId: 'linh_bao',
          realmId: 'mortal',
          realmLevel: 0,
          createdAt: '2026-01-01T00:00:00Z',
        },
      },
      'SAVE_INVALID',
    )
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({
      createNewCharacter: false,
      onNewCharacter: vi.fn(),
    })

    expect(outcome.status).toBe('failed')
    expect(stubs.saveIssue.report).toHaveBeenCalledWith(
      'corrupted',
      '',
      undefined,
      'remote',
    )
    expect(stubs.authority.markFailed).toHaveBeenCalledWith('recovery')

    lifecycle.stopAll()
  })
})
