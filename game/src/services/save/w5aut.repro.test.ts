// @vitest-environment jsdom
// W5-AUT audit repro harness (temp file - not part of the suite).
//
// Targets the wave-4 authority/boundary additions @66746ede:
//   (1) reset_character client path - service/coordinator/screen mapping
//   (4) the status mapping contract (deleted/absent/unavailable)
//   (5) wedge classes reset_character could not reach before the fix:
//       the 'uninitialized' first-save permanent rejection now arms the
//       remote-scoped recovery surface (saveIssue.report + markFailed)
//       instead of the dead generic error surface (W5-AUT-1 fix; the
//       retryable sibling still lands on the generic surface)
//   (3) nodeLevels boundary - shapes the W4 guard (202610060001:219-222)
//       accepts but the client still rejects (residual class, now
//       recoverable via reset; these pins keep the class visible)
//
// SQL-side acceptance is SOURCE_PROOF: cited migration lines do the
// work; no live Supabase on this box. Client-side claims are EXECUTED.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

import { SupabaseCloudSaveService } from '../cloudSave/SupabaseCloudSaveService'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import type {
  CloudSaveLoadResult,
  CloudSaveService,
} from '../cloudSave/CloudSaveService'
import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import type { ClientBuildInfo } from '../backend/ClientBuildInfo'
import { isValidCharacterName } from '../character/CharacterCreationService'
import { useAppLifecycle } from '../../composables/useAppLifecycle'

import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { commitSpellInitiationForTest, lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { lockBetaElementsForTests } from '../../core/game/__fixtures__/betaElementsUnlock'
import { BETA_MORTAL_STARTER_SKILL_ID } from '../../core/betaScope'
import { CORE_REALM_LEVEL } from '../../core/realm/realmSystem'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import type { GameSave } from './saveTypes'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()
lockBetaElementsForTests()

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CONFIG: SupabaseConfig = { url: 'https://test.supabase.co', anonKey: 'anon' }
const BUILD: ClientBuildInfo = {
  buildId: 'w5-aut',
  appVersion: '0.0.0',
  releaseChannel: 'beta',
  saveSchemaVersion: 1,
}
const BINDING = { sessionId: 'sess-1', userId: 'user-1', accessToken: 'tok' }

function mockFetchResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response
}

function committedSave(): GameSave {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()
  player.mortalBasicSkillId = BETA_MORTAL_STARTER_SKILL_ID
  player.nodeLevels = { ...player.nodeLevels, core_linh_bao: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_linh_bao']
  player.realmLevel = CORE_REALM_LEVEL
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerPills(pills)
  gameManager.catalogOps.registerEquipment(equipment)
  gameManager.catalogOps.registerAffixes(affixes)
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.catalogOps.registerSkillTemplates([...SKILLS])
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  gameManager.setActivePlayer(player)
  gameManager.progressionOps.learnSkill('linh_bao', player)
  commitSpellInitiationForTest(gameManager, player, 'fire')
  return buildGameSave(player, gameManager)
}

// ---------------------------------------------------------------------------
// (1)+(4) reset_character client mapping - service layer
// ---------------------------------------------------------------------------

describe('W5-AUT: SupabaseCloudSaveService.resetCharacter mapping', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function makeService(fetchImpl: typeof fetch) {
    vi.stubGlobal('fetch', fetchImpl)
    return new SupabaseCloudSaveService(CONFIG, BUILD, {
      resolveBinding: async () => BINDING,
      storage: window.localStorage,
    })
  }

  it('DELETED -> deleted', async () => {
    const service = makeService(async () => mockFetchResponse({ status: 'DELETED' }))
    expect(await service.resetCharacter()).toEqual({ status: 'deleted' })
  })

  it('NO_CHARACTER -> absent (idempotent second reset)', async () => {
    const service = makeService(async () => mockFetchResponse({ status: 'NO_CHARACTER' }))
    expect(await service.resetCharacter()).toEqual({ status: 'absent' })
  })

  it('PIN: an unexpected status string maps to unavailable SERVER_ERROR (strict mapping)', async () => {
    // Post-fix strict mapping (W5-COR-6): only DELETED -> deleted and
    // NO_CHARACTER -> absent are success classes. An unexpected RPC
    // contract is an unavailable retryable failure - the caller aborts
    // the destructive reset path instead of wiping local state on an
    // unknown server response.
    const service = makeService(async () => mockFetchResponse({ status: 'FROBNICATED' }))
    expect(await service.resetCharacter()).toEqual({
      status: 'unavailable',
      code: 'SERVER_ERROR',
      message: 'reset_character: FROBNICATED',
      retryable: true,
    })
  })

  it('400 session revoked -> unavailable SESSION_REVOKED non-retryable', async () => {
    // PostgREST wraps `raise exception 'session revoked' errcode 28000`
    // as 400 {code:'28000', message:'session revoked'}; mapError:225-227.
    const service = makeService(async () =>
      mockFetchResponse({ code: '28000', message: 'session revoked' }, 400),
    )
    const result = await service.resetCharacter()
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.code).toBe('SESSION_REVOKED')
      expect(result.retryable).toBe(false)
    }
  })

  it('missing binding -> unavailable AUTH_EXPIRED (non-retryable)', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const service = new SupabaseCloudSaveService(CONFIG, BUILD, {
      resolveBinding: async () => null,
    })
    const result = await service.resetCharacter()
    expect(result).toEqual({
      status: 'unavailable',
      code: 'AUTH_EXPIRED',
      message: 'Phiên đăng nhập đã hết hạn.',
      retryable: false,
    })
  })
})

// ---------------------------------------------------------------------------
// (4) coordinator passthrough - the stale-identity landmine
// ---------------------------------------------------------------------------

describe('W5-AUT: CloudSaveCoordinator.resetCharacter containment', () => {
  it('resetCharacter now resets revision/identity on success - a follow-up save CASes expected 0', async () => {
    const advanceGeneration = vi.fn()
    const service: CloudSaveService = {
      capability: 'remote-authoritative',
      load: async (): Promise<CloudSaveLoadResult> =>
        ({ status: 'empty', revision: 0 }) as CloudSaveLoadResult,
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 5 })),
      resetCharacter: async () => ({ status: 'deleted' }),
      advanceGeneration,
    }
    const coordinator = new CloudSaveCoordinator(service)

    // Seed a live session's revision via a committed save.
    await coordinator.save({} as GameSave)
    expect(coordinator.getRevision()).toBe(5)

    const reset = await coordinator.resetCharacter()
    expect(reset).toEqual({ status: 'deleted' })

    // POST-FIX (W5-AUT-3): resetCharacter() calls this.reset() on a
    // non-'unavailable' result - generation bumps, revision zeroes, the
    // queued resolvers drain. The stale-identity CAS is closed.
    expect(coordinator.getRevision()).toBe(0)
    expect(advanceGeneration).toHaveBeenCalledTimes(1)
    ;(service.save as ReturnType<typeof vi.fn>).mockClear()
    await coordinator.save({} as GameSave)
    // The post-reset write carries the fresh expected revision.
    expect((service.save as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// (5) the wedge reset cannot reach: 'uninitialized' + deterministic reject
// ---------------------------------------------------------------------------

describe('W5-AUT: first-save rejection arms the recovery surface only on permanent reject', () => {
  function makeStubs() {
    const intervals: Array<() => void> = []
    const intervalCalls: Array<{ timeoutMs: number }> = []
    return {
      clock: { start: vi.fn(), stop: vi.fn(), nowSeconds: () => 0 },
      intervals,
      intervalCalls,
      scheduleInterval: (callback: () => void, timeoutMs: number): number => {
        intervals.push(callback)
        intervalCalls.push({ timeoutMs })
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
        load: vi.fn(async () => ({ status: 'uninitialized' as const, revision: 0 as const, character: {
          id: 'char-1', name: 'tester', selectedTalentIds: [], baseAttributes: {},
          mortalBasicSkillId: 'linh_bao', realmId: 'mortal', realmLevel: 0,
          createdAt: '2026-01-01T00:00:00Z',
        } })),
        save: vi.fn(),
        reset: vi.fn(),
        capability: 'remote-authoritative' as const,
      } as unknown as import('../cloudSave/CloudSaveCoordinator').CloudSaveCoordinator,
      player: {
        save: vi.fn(async () => ({
          status: 'unavailable' as const,
          message: 'Save bị máy chủ từ chối — dữ liệu không hợp lệ.',
          retryable: false,
          code: 'SAVE_INVALID' as const,
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
      restoreGameSession: vi.fn(() => ({ status: 'ok' as const, offline: { elapsedSeconds: 0, cultivation: 0 } })),
      persistPlayer: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      onError: vi.fn(),
      unsupportedSaveNotice: vi.fn(),
      hardReset: vi.fn(),
    }
  }

  it('CHARACTER_UNINITIALIZED + permanent write reject -> recovery + remote saveIssue armed (W5-AUT-1 fix)', async () => {
    const stubs = makeStubs()
    const lifecycle = useAppLifecycle({
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

    const outcome = await lifecycle.bootGame({ createNewCharacter: false, onNewCharacter: vi.fn() })

    // useAppLifecycle.ts ~610-624 - a PERMANENT first-write rejection
    // wedges the account (every boot re-lands CHARACTER_UNINITIALIZED ->
    // same reject, generic error surface has no reset). The fix arms the
    // recovery surface: remote-scoped report (the authoritative side
    // refuses the starter snapshot) + markFailed('recovery') + boot.fail
    // -> SaveIncompatibleScreen's remote reset deletes the wedge.
    expect(outcome.status).toBe('failed')
    expect(stubs.authority.markFailed).toHaveBeenCalledWith('recovery')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.saveIssue.report).toHaveBeenCalledWith('corrupted', '', undefined, 'remote')

    lifecycle.stopAll()
  })

  it('CHARACTER_UNINITIALIZED + RETRYABLE write reject -> generic fail only (saveIssue stays unarmed)', async () => {
    const stubs = makeStubs()
    stubs.player.save = vi.fn(async () => ({
      status: 'unavailable' as const,
      message: 'mang giat, thu lai',
      retryable: true,
      code: 'SAVE_INVALID' as const,
    }))
    const lifecycle = useAppLifecycle({
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

    const outcome = await lifecycle.bootGame({ createNewCharacter: false, onNewCharacter: vi.fn() })

    // A retryable reject is a transient backend failure, not a wedge:
    // the generic error surface + retry is the right UX. The remote
    // reset affordance must stay unarmed - the server never refused the
    // data permanently.
    expect(outcome.status).toBe('failed')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.saveIssue.report).not.toHaveBeenCalled()

    lifecycle.stopAll()
  })

  it.each([
    ['SERVER_ERROR', 'unrecognized/authority REJECTED classes'],
    ['NETWORK_UNAVAILABLE', 'a lost-ACK transport'],
    ['SESSION_REVOKED', 'a revoked session'],
    ['PROTOCOL_OUTDATED', 'a stale protocol'],
  ] as const)(
    'CHARACTER_UNINITIALIZED + permanent %s -> generic fail only, NO remote reset arm (W6-COR-2 fix)',
    async (code) => {
      const stubs = makeStubs()
      stubs.player.save = vi.fn(async () => ({
        status: 'unavailable' as const,
        message: 'fail',
        retryable: false,
        code: code as import('../session/BackendStatus').BackendErrorCode,
      }))
      const lifecycle = useAppLifecycle({
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

      const outcome = await lifecycle.bootGame({ createNewCharacter: false, onNewCharacter: vi.fn() })

      // %s never proved the remote row bad - a lost-ACK may even have
      // COMMITTED on a healthy row. Arming remote destruction there was
      // W6-COR-2/W6-AUT-1: only payload-reject codes (SAVE_INVALID /
      // SAVE_TOO_LARGE) may arm the reset surface. Authority classification
      // stays with observeSaveResult (W6-COR-3: 'revoked'/'update-required'
      // must NOT be clobbered to 'recovery').
      expect(outcome.status).toBe('failed')
      expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
      expect(stubs.saveIssue.report).not.toHaveBeenCalled()
      expect(stubs.authority.markFailed).not.toHaveBeenCalledWith('recovery')

      lifecycle.stopAll()
    },
  )
})

// ---------------------------------------------------------------------------
// (3) nodeLevels boundary - accepted by the W4 guard, rejected by the client
// ---------------------------------------------------------------------------

describe('W5-AUT: nodeLevels guard boundary (post-W4 residual)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('baseline: committed fire save passes shape', () => {
    const save = committedSave()
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('nodeLevels = {nested object} - SQL skips non-number values; client rejects', () => {
    // SQL SOURCE_PROOF: 202610060001:243-251 - jsonb_each legs fire only
    // when jsonb_typeof(n.v)='number'; a nested object value passes the
    // guard AND every element-root leg. Client: saveShapeValidation.ts
    // :1840-1844 requires every value to be a non-negative finite number.
    const save = committedSave()
    const player = save.player as unknown as Record<string, unknown>
    ;(player.nodeLevels as Record<string, unknown>).zz_nested = { depth: 1 }
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })

  it('nodeLevels = {thuy_linh_ngo: 0.5} - fractional non-beta root sneaks under the >=1 leg', () => {
    // SQL SOURCE_PROOF: 202610060001:247 - the non-beta-root leg only
    // fires on `>= 1`; 0.5 is a number that skips it entirely -> ACCEPT.
    // Client: thuy_linh_ngo is a registered progression node
    // (PhapTuNodes.builders.ts:23) - the non-core leg requires an integer
    // level (saveShapeValidation.ts:1890+) -> REJECT. Server-accept /
    // client-reject residual: now recoverable via reset_character, which
    // is exactly why W4-AUT-2 was excepted - this pin keeps the class
    // visible for the adjudicator.
    const save = committedSave()
    const player = save.player as unknown as Record<string, unknown>
    ;(player.nodeLevels as Record<string, unknown>).thuy_linh_ngo = 0.5
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })

  it('nodeLevels = {core_fake: 1} - unregistered core id: SQL has no core leg; client rejects', () => {
    // SQL: only the five element-root keys are examined (202610060001:248);
    // core_* ids are never checked -> ACCEPT. Client: core_ prefix leg
    // requires a SKILL_CORE_BY_ID hit (saveShapeValidation.ts:1851-1858).
    const save = committedSave()
    const player = save.player as unknown as Record<string, unknown>
    ;(player.nodeLevels as Record<string, unknown>).core_fake = 1
    ;(player.purchasedNodeIds as string[]).push('core_fake')
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// (2) name charset divergence - client-valid names the server may reject
// ---------------------------------------------------------------------------

describe('W5-AUT: name charset boundary', () => {
  it('client charset accepts Unicode letters/numbers the POSIX leg may reject', () => {
    // Client: /^[\p{L}\p{N} _-]{2,20}$/u - Unicode letters AND number
    // classes (No like superscript-2, full-width letters, diacritics).
    // Server: trim(p_name) ~ '^[[:alnum:] _-]+$' (202610060001:316-319) -
    // POSIX [[:alnum:]] under a C.UTF-8 collation matches ASCII only, so
    // these client-valid names can land CHARACTER_NAME_INVALID. The
    // wave-4 fix corrected the client message to state the charset
    // (SupabaseCharacterCreationService.ts:40), so the residual is only
    // the collation divergence itself.
    // Collation-dependent -> reported Low/Nit, not asserted against server.
    expect(isValidCharacterName('Đạo Hữu²')).toBe(true) // superscript-2 is \p{No}
    expect(isValidCharacterName('Ｋｉｅｍ')).toBe(true) // full-width letters are \p{L}
    expect(isValidCharacterName('Hoa-Cau 1')).toBe(true)
    expect(isValidCharacterName('a')).toBe(false) // still rejects < 2 chars
    expect(isValidCharacterName('name<script>')).toBe(false) // still rejects symbols
  })
})
