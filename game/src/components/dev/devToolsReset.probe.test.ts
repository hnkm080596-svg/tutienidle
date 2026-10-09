// DevToolsPanel reset-path preflight probe (Minh 2026-10-07).
// The panel's resetPath must produce saves that pass the REAL outgoing
// gate (validateGameSaveShape on the JSON wire form) or autosave arms
// SaveIncompatibleScreen ~20s later. This probe drives the exact seams
// the panel calls - initiation, promotion, reset, re-initiation - on a
// real GameManager + real pinia player store and asserts shape legality
// at every step. Vitest cannot import .vue, so the panel sequences are
// mirrored line-for-line; keep them in sync.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { lockBetaElementsForTests } from '../../core/game/__fixtures__/betaElementsUnlock'
import { CORE_REALM_LEVEL, getRealmIndex, getRequiredCultivation } from '../../core/realm/realmSystem'
import { REALMS } from '../../data/realms/realm'
import { CAST_LEVELING_THRESHOLDS } from '../../core/skill/CastLeveling'
import { TribulationOutcomeService } from '../../core/tribulation/TribulationOutcomeService'
import {
  getUpgradeableTalentIds,
  reconcileTalentEntitlement,
} from '../../core/talent/TalentEntitlement'
import {
  applyCreationProfile,
  bootstrapEarlyGamePlayer,
} from '../../core/game/EarlyGameBootstrap'
import { MORTAL_PRECURSOR_SKILL_IDS } from '../../core/skill/MortalPrecursors'
import { CHARACTER_CREATION_TALENTS } from '../../data/talent/Talents'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { ALL_PROGRESSION_NODES } from '../../data/progression/ProgressionNodeCatalog'

import { buildGameSave } from '../../services/save/SaveSystem'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()
lockBetaElementsForTests()

function context(): { gameManager: GameManager; player: ReturnType<typeof usePlayerStore> } {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerPills(pills)
  gameManager.catalogOps.registerEquipment(equipment)
  gameManager.catalogOps.registerAffixes(affixes)
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.catalogOps.registerSkillTemplates([...SKILLS])
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  gameManager.catalogOps.registerProgressionNodes(ALL_PROGRESSION_NODES)
  const player = usePlayerStore()
  gameManager.setActivePlayer(player.$state)
  return { gameManager, player }
}

// Mirrors DevToolsPanel.applyPath() verbatim.
function panelApplyPath(gameManager: GameManager, player: ReturnType<typeof usePlayerStore>) {
  const state = player.$state
  expect(state.realmId).toBe('mortal')
  expect(state.cultivationPath).toBeUndefined()
  if (state.realmLevel < CORE_REALM_LEVEL) {
    state.realmLevel = CORE_REALM_LEVEL
  }
  const counts = (state.skillCastCounts ??= {})
  const gate = CAST_LEVELING_THRESHOLDS.linh_bao?.lv3 ?? 0
  counts.linh_bao = Math.max(counts.linh_bao ?? 0, gate)
  const result = gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', state)
  expect(result.ok ? 'ok' : result.reason).toBe('ok')
}

// Mirrors DevToolsPanel.applyRealm() promotion branch verbatim.
function panelPromote(gameManager: GameManager, player: ReturnType<typeof usePlayerStore>, target: string) {
  expect(player.cultivationPath).not.toBeUndefined()
  new TribulationOutcomeService().resolveVictory(player, gameManager, {
    targetRealmId: target as never,
    grade: 'human',
    breakthroughType: 'normal',
  })
  if (player.pendingTalentEntitlement !== undefined) {
    const newOffer = player.pendingTalentEntitlement.offeredTalentIds[0]
    const upgrade = getUpgradeableTalentIds(player)[0]
    if (newOffer !== undefined) {
      gameManager.realmAdvanceOps.resolveTalentEntitlement(player, {
        kind: 'new',
        talentId: newOffer,
      })
    } else if (upgrade !== undefined) {
      gameManager.realmAdvanceOps.resolveTalentEntitlement(player, {
        kind: 'upgrade',
        talentId: upgrade,
      })
    } else {
      reconcileTalentEntitlement(player)
    }
  }
}

// Mirrors DevToolsPanel.resetPath() verbatim.
function panelReset(gameManager: GameManager, player: ReturnType<typeof usePlayerStore>) {
  const profile = {
    name: player.name,
    talentIds: player.selectedTalentIds.filter((id) =>
      CHARACTER_CREATION_TALENTS.some((talent) => talent.id === id),
    ),
  }
  const fresh = createDefaultPlayer()
  for (const key of Object.keys(player.$state)) {
    Reflect.deleteProperty(player.$state, key)
  }
  Object.assign(player.$state, fresh)
  applyCreationProfile(player.$state, profile)
  gameManager.techniqueManager.setActive(null)
  for (const skill of gameManager.skillManager.getAll()) {
    gameManager.skillSystem.unlearn(skill.id)
  }
  bootstrapEarlyGamePlayer(gameManager, player.$state)
  gameManager.productionSystem.restoreStates(
    gameManager.productionSystem.getAllStates().map((s) => ({ ...s, workerCycles: [] })),
  )
  // clampRealmCoherence
  const realm = REALMS.find((r) => r.id === player.realmId)
  if (realm !== undefined && player.realmLevel > realm.maxLevel) {
    player.realmLevel = realm.maxLevel
  }
  const required = getRequiredCultivation(player.realmId, player.realmLevel)
  if (player.cultivation > required) player.cultivation = required
}

// The real outgoing gate from CloudSaveCoordinator.driveSave: JSON wire
// round-trip then shape admission.
function expectSaveLegal(gameManager: GameManager, player: ReturnType<typeof usePlayerStore>) {
  const save = buildGameSave(player.$state, gameManager)
  const wire = JSON.parse(JSON.stringify(save))
  const verdict = validateGameSaveShape(wire)
  expect(verdict.ok ? [] : verdict.issues).toEqual([])
}

describe('DevToolsPanel save-boundary preflight', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initiation writes stay save-legal', () => {
    const { gameManager, player } = context()
    panelApplyPath(gameManager, player)
    expect(player.realmId).toBe('qi_refining')
    expect(player.cultivationPath).toBe('spell')
    expectSaveLegal(gameManager, player)
  })

  it('promotion to foundation_establishment stays save-legal', () => {
    const { gameManager, player } = context()
    panelApplyPath(gameManager, player)
    panelPromote(gameManager, player, 'foundation_establishment')
    expect(player.realmId).toBe('foundation_establishment')
    expectSaveLegal(gameManager, player)
  })

  it('reset to fresh mortal after initiation + promotion stays save-legal', () => {
    const { gameManager, player } = context()
    panelApplyPath(gameManager, player)
    panelPromote(gameManager, player, 'foundation_establishment')
    expect(getRealmIndex(player.realmId)).toBeGreaterThan(getRealmIndex('mortal'))

    panelReset(gameManager, player)

    expect(player.realmId).toBe('mortal')
    expect(player.cultivationPath).toBeUndefined()
    expect(gameManager.techniqueManager.getActive?.() ?? null).toBeNull()
    const learned = gameManager.skillManager.getAll().map((s) => s.id).sort()
    expect(learned).toEqual([...MORTAL_PRECURSOR_SKILL_IDS].sort())
    expectSaveLegal(gameManager, player)
  })

  it('re-initiation after reset stays save-legal (the actual purpose)', () => {
    const { gameManager, player } = context()
    panelApplyPath(gameManager, player)
    panelPromote(gameManager, player, 'foundation_establishment')
    panelReset(gameManager, player)
    panelApplyPath(gameManager, player)
    expect(player.realmId).toBe('qi_refining')
    expect(player.cultivationPath).toBe('spell')
    expectSaveLegal(gameManager, player)
  })
})
