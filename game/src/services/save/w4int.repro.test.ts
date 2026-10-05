// W4-INT audit repro harness (temp file - not part of the suite).
// Attacks the wave-3 onResume reject wiring (src/App.vue ~649-678) at the
// seams it composes: the real OnlineSessionController state machine
// (reconnecting -> ready -> recovery), the real saveIssue Pinia store,
// and the real restoreGameSession boundary. Also pins the
// normalized-vs-raw byte divergence of the reported save and the
// create_character charset-mirror divergence (client regex vs SQL
// [[:alnum:]] class). See game/docs/qa/fixpoint-codex-w4-INT.md.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { useSaveIssueStore } from '../../stores/saveIssue'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import {
  commitSpellInitiationForTest,
  lockBetaWaysForTests,
} from '../../core/game/__fixtures__/betaWaysUnlock'
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
import { isValidCharacterName } from '../character/CharacterCreationService'

import { buildGameSave, restoreGameSession } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from './saveAcceptance'
import type { GameSave } from './saveTypes'
import {
  OnlineSessionController,
  type PauseReason,
  type ReconnectOutcome,
} from '../session/OnlineSessionController'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()
lockBetaElementsForTests()

function committedContext(): { gameManager: GameManager; player: PlayerData } {
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
  return { gameManager, player }
}

function committedSave(): { save: GameSave; gameManager: GameManager; player: PlayerData } {
  const { gameManager, player } = committedContext()
  return { save: buildGameSave(player, gameManager), gameManager, player }
}

const playerOf = (save: GameSave) => save.player as unknown as Record<string, unknown>

// Injected-scheduler harness copied from OnlineSessionController.test.ts
// so heartbeat/retry arming is observable without fake timers.
interface Scheduler {
  scheduleInterval: (callback: () => void, timeoutMs: number) => number
  clearHandle: (handle: number) => void
  handles: Map<number, { callback: () => void; timeoutMs: number }>
}

function makeScheduler(): Scheduler {
  let nextHandle = 1
  const handles = new Map<number, { callback: () => void; timeoutMs: number }>()
  return {
    handles,
    scheduleInterval: (callback, timeoutMs) => {
      const handle = nextHandle++
      handles.set(handle, { callback, timeoutMs })
      return handle
    },
    clearHandle: (handle) => {
      handles.delete(handle)
    },
  }
}

describe('W4-INT - onResume reject path composition', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('baseline: a real committed fire save satisfies every mirror predicate', () => {
    const { save } = committedSave()

    expect(validateGameSaveShape(save).ok).toBe(true)
    expect(isSaveAcceptable(save, staticSaveAcceptanceCatalogs())).toBe(true)

    // The exact predicates the 202610050002 server mirror enforces:
    // realm witness >= qi_refining, nonempty techniques, breakthroughGrade
    // >= 1, committed fire element, kit basic present.
    const player = playerOf(save)
    expect(player.realmId).toBe('qi_refining')
    expect(save.techniques.length).toBeGreaterThanOrEqual(1)
    expect(player.breakthroughGrade).toBeGreaterThanOrEqual(1)
    expect((player.spellPath as { element: string }).element).toBe('fire')
    expect(save.skills.some((s) => s.id === 'hoa_cau_thuat')).toBe(true)
    // scopeWriteSeamsBlind committedPlayer carries the same bundle
    // (element + hoa_linh_ngo + core_hoa_cau_thuat + purchased ids) -
    // the fixture mirrors a writer-producible state, VERIFIED.
  })

  it("markFailed('recovery') post-boot: 'reconnecting' -> 'ready' -> 'recovery', sim stays paused", async () => {
    const { gameManager } = committedContext()
    const player = usePlayerStore()

    // A save that passes shape + static acceptance but fails the
    // restore preflight: an unknown material reference (registry drift -
    // the 'rejected' subclass restoreGameSession is for).
    const { save: badSave } = committedSave()
    badSave.materials = [
      { materialId: 'khong_ton_tai_w4', quantity: 1 },
    ] as unknown as GameSave['materials']

    const saveIssue = useSaveIssueStore()
    const pauses: PauseReason[] = []
    let resumeSimulationCalls = 0
    const scheduler = makeScheduler()

    const controller = new OnlineSessionController({
      monotonicNow: () => 1_000_000,
      scheduleInterval: scheduler.scheduleInterval,
      clearHandle: scheduler.clearHandle,
      probe: async () => ({ status: 'ok' }),
      reconnect: async (): Promise<ReconnectOutcome> => ({
        status: 'resumed',
        lineage: 'replaced',
        save: badSave,
        serverAuthority: { serverNowMs: 1_000_000 },
      }),
      onPause: (reason) => pauses.push(reason),
      // Replicates the src/App.vue onResume wiring verbatim: diagnostic
      // first (AUTH_RESUMED), then the live-replacement reject path.
      onResume: (lineage, save, serverAuthority) => {
        void serverAuthority
        if (lineage === 'replaced' && save) {
          const restored = restoreGameSession(player, gameManager, save, {
            kind: 'live-replacement',
            nowMs: Date.now(),
          })
          if (restored.status === 'rejected') {
            controller.markFailed('recovery')
            saveIssue.report('corrupted', JSON.stringify(save))
            return
          }
        }
        resumeSimulationCalls += 1
      },
    })

    // Drive the post-boot sequence: boot admission -> ready (heartbeat
    // armed), then a suspend pause -> 'reconnecting' (retry armed).
    controller.beginChecking()
    controller.markReady()
    expect(controller.authorityState).toBe('ready')
    expect(scheduler.handles.size).toBeGreaterThan(0) // heartbeat armed

    controller.pause('suspend')
    expect(controller.authorityState).toBe('reconnecting')
    await Promise.resolve()
    await Promise.resolve()

    // attemptReconnect ran: markReady() then onResume -> reject ->
    // markFailed('recovery') unwinds the just-armed heartbeat.
    expect(controller.authorityState).toBe('recovery')
    expect(controller.canMutate()).toBe(false)
    expect(resumeSimulationCalls).toBe(0)
    expect(pauses).toContain('terminal')
    expect(scheduler.handles.size).toBe(0) // heartbeat + retry both cleared

    // W4-INT-1: the saveIssue write lands in the store but its only
    // consumer (SaveIncompatibleScreen) mounts only under entryStage
    // 'error' - unreachable post-boot because App.vue never calls
    // boot.fail() on this path. The write is dead state.
    expect(saveIssue.status).toBe('corrupted')
    expect(saveIssue.raw).toBe(JSON.stringify(badSave))
  })

  it("saveIssue state persists after the rejected resume - nothing clears it", async () => {
    const saveIssue = useSaveIssueStore()
    saveIssue.report('corrupted', '{"x":1}')

    // No production caller of saveIssue.clear() exists (grep-verified);
    // the store holds the stale report for the rest of the page session.
    // Any LATER 'error'-stage mount (a subsequent boot failing for an
    // unrelated reason) renders SaveIncompatibleScreen with these stale
    // bytes instead of the real boot-error card.
    expect(saveIssue.status).toBe('corrupted')
    expect(saveIssue.raw).toBe('{"x":1}')
    expect(saveIssue.foundVersion).toBeUndefined()
  })

  it("W4-INT-2: saveIssue.raw from resume = JSON.stringify(normalized), NOT the verbatim remote bytes", () => {
    const { save } = committedSave()
    // Push the derived snapshot over the authored ceiling: F-TC9-4 clamps
    // instead of rejecting, so normalizedSave != raw while shape stays ok.
    save.player.cultivationPerSecond = 999_999
    const raw = JSON.stringify(save)

    const shape = validateGameSaveShape(JSON.parse(raw))
    expect(shape.ok).toBe(true)
    if (!shape.ok) throw new Error('fixture must stay shape-valid')

    const normalized = shape.normalizedSave as GameSave
    expect(normalized.player.cultivationPerSecond).toBeLessThan(999_999)
    expect(JSON.stringify(normalized)).not.toBe(raw)

    // The App.vue resume wiring reports JSON.stringify(save) where `save`
    // is loaded.save - the NORMALIZED object. Boot reports loaded.raw
    // (verbatim cloud bytes, useAppLifecycle.ts:400/456). Exporting from
    // SaveIncompatibleScreen hands back the clamped re-serialization, not
    // the bytes the server stored. Root: ReconnectOutcome drops `raw`.
    const saveIssue = useSaveIssueStore()
    saveIssue.report('corrupted', JSON.stringify(normalized))
    expect(saveIssue.raw).toBe(JSON.stringify(normalized))
    expect(saveIssue.raw).not.toBe(raw)
  })

  it("W4-INT-3: client charset accepts names the SQL [[:alnum:]] mirror rejects", () => {
    // Client gate: /^[\p{L}\p{N} _-]{2,20}$/u - \p{N} covers Nd+Nl+No.
    // PostgreSQL [[:alnum:]] never includes Nl (letter numbers like ROMAN
    // NUMERAL FOUR) or No (SUPERSCRIPT TWO, VULGAR FRACTION) in ANY
    // locale - the divergence is deterministic, not locale-dependent.
    // Both inputs below pass the client gate and the pre-check RPC
    // (is_character_name_available has no charset clause - it checks
    // uniqueness only), then die inside create_character -> the client
    // maps CHARACTER_NAME_UNAVAILABLE to 'name_taken' / 'Dao danh nay
    // da co chu' even though the name is free.
    expect(isValidCharacterName('MinhⅣ')).toBe(true)
    expect(isValidCharacterName('Đạo Hữu²')).toBe(true)
    // Sanity: a plain ASCII+digits name must keep passing both sides.
    expect(isValidCharacterName('Minh2')).toBe(true)
  })
})
