/**
 * M-F-ARTIFACT-DEFER - open-window boundary suite.
 *
 * The artifact domain is deferred to Kim Dan+ (ARTIFACT_UNLOCK_REALM_ID =
 * 'golden_core'), which sits OUTSIDE the real Beta release window
 * (progressionCeilingRealmId = 'foundation_establishment') - so under the
 * real policy every positive KD behavior is unreachable. This file mocks
 * ReleasePolicy with the window open through golden_core (consistent
 * semantics across the whole predicate family) and pins the deferred
 * domain's open-window contract:
 *
 * - the domain predicate flips true exactly at the unlock realm;
 * - normalize awakens at KD; the KD realm-entry grant delivers the artifact;
 * - combat EXP accrues; path select + grade upgrade ops run;
 * - the retained Truc Co drop-table row delivers doan_bao_thach to a KD
 *   player but still nothing to a below-KD player on the SAME row;
 * - the wheel ladder reads 'Can dat Kim Dan' below the realm and the
 *   definition-pending terminal arm stays terminal;
 * - the breakthrough tier advance runs exactly as before once open.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Window opens through golden_core: realms <= golden_core are available.
// The ceiling const lives INSIDE the factory - vi.mock factories run on
// first import of the mocked module, before this test module's body
// evaluates, so an outer const would hit TDZ.
vi.mock('./ReleasePolicy', async (importOriginal) => {
  const OPEN_WINDOW_CEILING = 'golden_core'
  const actual = await importOriginal<typeof import('./ReleasePolicy')>()
  const { getRealmIndex } = await import('./realmSystem')
  const { REALMS } = await import('../../data/realms/realm')
  const ceilingIndex = getRealmIndex(OPEN_WINDOW_CEILING)

  const available = (realmId: string | undefined): boolean =>
    realmId !== undefined &&
    getRealmIndex(realmId) !== -1 &&
    getRealmIndex(realmId) <= ceilingIndex

  const transitionEnabled = (fromRealmId: string, toRealmId: string): boolean =>
    getRealmIndex(fromRealmId) !== -1 &&
    getRealmIndex(toRealmId) === getRealmIndex(fromRealmId) + 1 &&
    available(toRealmId)

  return {
    ...actual,
    isRealmAvailable: (realmId: string) => available(realmId),
    isBeyondReleaseCeiling: (realmId: string) =>
      getRealmIndex(realmId) !== -1 && getRealmIndex(realmId) > ceilingIndex,
    isRealmTransitionEnabled: transitionEnabled,
    isBreakthroughAcquisitionEnabled: (targetRealmId?: string) => {
      if (targetRealmId === undefined) return true
      const index = getRealmIndex(targetRealmId)
      const predecessorId = index === -1 ? undefined : REALMS[index - 1]?.id
      return predecessorId === undefined
        ? available(targetRealmId)
        : transitionEnabled(predecessorId, targetRealmId)
    },
    isDomainScopedAcquisitionEnabled: (
      domainUnlockRealmId?: string,
      playerRealmId?: string,
    ): boolean =>
      domainUnlockRealmId === undefined ||
      (available(domainUnlockRealmId) &&
        available(playerRealmId) &&
        getRealmIndex(playerRealmId!) >= getRealmIndex(domainUnlockRealmId)),
  }
})

import {
  isArtifactDomainUnlocked,
  normalizeArtifactProgress,
  createDefaultArtifactProgress,
  getArtifactExpRequired,
  ARTIFACT_UNLOCK_REALM_ID,
} from '../artifact/ArtifactProgression'
import {
  isDomainScopedAcquisitionEnabled,
  isRealmAvailable,
  isRealmTransitionEnabled,
} from './ReleasePolicy'
import { grantCultivationPathRealmReward } from '../player/CultivationPathSystem'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy, type EnemyDefinition } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import { GameManager } from '../game/GameManager'
import { createLootTestSetup } from '../game/battleLootTestSetup'
import { usePlayerStore } from '../../stores/player'
import { BreakthroughOutcomeService } from '../tribulation/BreakthroughOutcomeService'
import { addCultivation } from '../cultivation/CultivationSystem'
import {
  COMMAND_WHEEL_SLOTS,
  RELEASE_UNAVAILABLE_REASON,
  type CommandWheelDisabledContext,
} from '../../data/ui/commandWheelCatalog'

const DOMAIN_TAGGED_STONE = {
  id: 'doan_bao_thach',
  domainUnlockRealmId: ARTIFACT_UNLOCK_REALM_ID,
}

const FOUNDATION_STAGE = {
  stageId: 'fe_5',
  requiredRealmId: 'foundation_establishment',
  floor: 5,
}

function spellPlayerAt(realmId: string, realmLevel = 1) {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  player.realmId = realmId
  player.realmLevel = realmLevel
  return player
}

function wheelContext(overrides: Partial<CommandWheelDisabledContext>): CommandWheelDisabledContext {
  return {
    artifactDomainUnlocked: false,
    artifactUnlockRealmAvailable: isRealmAvailable(ARTIFACT_UNLOCK_REALM_ID),
    hasArtifactDefinition: true,
    companionDomainUnlocked: false,
    formationUnlocked: false,
    realmReleaseUnavailable: false,
    ...overrides,
  }
}

describe('artifact domain under an open Kim Dan window (mocked release policy)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mock sanity: the window really is open through golden_core', () => {
    expect(isRealmAvailable('foundation_establishment')).toBe(true)
    expect(isRealmAvailable('golden_core')).toBe(true)
    expect(isRealmAvailable('nascent_soul')).toBe(false)
    expect(isRealmTransitionEnabled('foundation_establishment', 'golden_core')).toBe(true)
  })

  it('isArtifactDomainUnlocked flips true exactly at the unlock realm', () => {
    expect(isArtifactDomainUnlocked('foundation_establishment')).toBe(false)
    expect(isArtifactDomainUnlocked(ARTIFACT_UNLOCK_REALM_ID)).toBe(true)
    // Player realm above the open window still fails (availability leg).
    expect(isArtifactDomainUnlocked('nascent_soul')).toBe(false)
  })

  it('isDomainScopedAcquisitionEnabled pins the reach leg under the open window', () => {
    // Below-unlock player gets NOTHING even though the window is open -
    // delivery requires reaching the unlock realm, not just its release.
    expect(isDomainScopedAcquisitionEnabled('golden_core', 'foundation_establishment')).toBe(false)
    expect(isDomainScopedAcquisitionEnabled('golden_core', 'qi_refining')).toBe(false)
    expect(isDomainScopedAcquisitionEnabled('golden_core', 'golden_core')).toBe(true)
    expect(isDomainScopedAcquisitionEnabled('golden_core', 'nascent_soul')).toBe(false)
    expect(isDomainScopedAcquisitionEnabled(undefined, 'mortal')).toBe(true)
  })

  it('normalizeArtifactProgress awakens a spell player at Kim Dan', () => {
    const player = spellPlayerAt('golden_core', 3)

    normalizeArtifactProgress(player)

    expect(player.artifact?.artifactId).toBe('ngu_hanh_chau')
    expect(player.artifact?.grade).toBe('pham')
  })

  it('normalizeArtifactProgress still suppresses awakening below Kim Dan', () => {
    const player = spellPlayerAt('foundation_establishment')

    normalizeArtifactProgress(player)

    expect(player.artifact).toBeUndefined()
  })

  it('normalizeArtifactProgress clears a mismatch then re-awakens at Kim Dan', () => {
    const player = spellPlayerAt('golden_core')
    player.artifact = { ...createDefaultArtifactProgress('ngu_hanh_chau'), artifactId: 'other' as never }

    normalizeArtifactProgress(player)

    expect(player.artifact?.artifactId).toBe('ngu_hanh_chau')
  })

  it('grantCultivationPathRealmReward delivers ngu_hanh_chau on Kim Dan entry', () => {
    const player = spellPlayerAt('golden_core')

    expect(grantCultivationPathRealmReward(player, 'golden_core')).toBe(true)
    expect(player.artifact?.artifactId).toBe('ngu_hanh_chau')
  })

  it('grantCultivationPathRealmReward at Truc Co stays passive-only (no artifact)', () => {
    const player = spellPlayerAt('foundation_establishment')

    expect(grantCultivationPathRealmReward(player, 'foundation_establishment')).toBe(true)
    expect(player.artifact).toBeUndefined()
  })

  it('grantCultivationPathRealmReward never awakens the domain on a below-unlock player (non-entry call)', () => {
    // Devin Review round-77 contract-hardening: under the OPEN window a
    // non-entry caller passing 'golden_core' on a Truc Co player must NOT
    // deliver the artifact - the leg requires player reach, not only the
    // record's realm being released.
    const player = spellPlayerAt('foundation_establishment')

    expect(grantCultivationPathRealmReward(player, 'golden_core')).toBe(true)
    expect(player.artifact).toBeUndefined()
  })

  it('combat EXP accrues once the domain is open', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999) // isolate EXP from the material roll

    const { killEnemy, loot, player } = createLootTestSetup({
      realmId: 'golden_core',
      rewards: { techniqueMastery: 10, spiritStone: 0 },
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    player.realmId = 'golden_core'

    killEnemy()

    expect(player.artifact.experience).toBe(2)
    expect(loot.getSummary().artifactInsight).toBe(2)
  })

  it('the RETAINED Truc Co table row delivers the stone to a Kim Dan player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // every roll hits the first pool entry (stone)

    const { killEnemy, materialBag, player } = createLootTestSetup({
      realmId: 'golden_core',
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })
    // `realmId` on the fixture is the ENEMY's realm; the delivery rule
    // keys on the PLAYER's realm, set explicitly here.
    player.realmId = 'golden_core'

    killEnemy()

    expect(materialBag.getAmount('doan_bao_thach')).toBe(1)
  })

  it('the same retained row still delivers NOTHING to a below-Kim-Dan player under the open window', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { killEnemy, materialBag, player } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })
    player.realmId = 'foundation_establishment'

    killEnemy()

    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('setArtifactPath + tryUpgradeArtifactGrade succeed at Kim Dan', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerMaterials([
      {
        id: 'doan_bao_thach',
        name: 'Doan Bao Thach',
        category: 'other',
        sourceType: 'monster',
        description: 'test fixture',
        domainUnlockRealmId: ARTIFACT_UNLOCK_REALM_ID,
      },
    ])

    const player = spellPlayerAt('golden_core')
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    gameManager.materialBag.add(gameManager.materialRegistry.get('doan_bao_thach'), 10)

    expect(gameManager.realmAdvanceOps.setArtifactPath(player, 'defense')).toBe(true)
    expect(player.artifact.selectedPath).toBe('defense')

    expect(gameManager.realmAdvanceOps.tryUpgradeArtifactGrade(player)).toBe(true)
    expect(player.artifact.grade).toBe('linh')
    expect(gameManager.materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('the ops combat guard still fires at Kim Dan (domain open does not weaken it)', () => {
    const gameManager = new GameManager()
    const player = spellPlayerAt('golden_core')
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

    const stats = createBaseStats({ might: 0 })
    const playerEntity: CombatEntity = {
      id: 'player',
      name: 'Player',
      type: 'player',
      baseStats: stats,
      stats,
      currentHp: stats.maxHp,
      maxHp: stats.maxHp,
      currentMp: stats.maxMp,
      currentWard: 0,
      turnsSinceLastHitLanded: Infinity,
      realmIndex: 0,
      x: 0,
      row: 2,
      alive: true,
    }
    const enemyDefinition: EnemyDefinition = {
      id: 'target_dummy',
      name: 'Bia Tap',
      level: 1,
      realmId: 'golden_core',
      lane: 'ground',
      statsInput: {
        maxHp: 100,
        might: 0,
        attackSpeed: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    }
    gameManager.catalogOps.registerEnemyTemplates([defineEnemy(enemyDefinition)])
    gameManager.startBattle(playerEntity, defineEnemy(enemyDefinition))
    expect(gameManager.getTurnBattle()?.state).toBe('intro')

    expect(gameManager.realmAdvanceOps.setArtifactPath(player, 'attack')).toBe(false)
    expect(player.artifact.selectedPath).toBeUndefined()
    expect(gameManager.realmAdvanceOps.tryUpgradeArtifactGrade(player)).toBe(false)
  })

  it('phap_bao wheel ladder under the open window', () => {
    const slot = COMMAND_WHEEL_SLOTS.find((entry) => entry.id === 'phap_bao')

    // Below the unlock realm (window open): the progression lock names
    // Kim Dan, distinct from the release-hidden reason.
    expect(slot?.disabledReason?.(wheelContext({}))).toBe('Cần đạt Kim Đan')

    // A save whose own realm is beyond the window stays release-hidden.
    expect(
      slot?.disabledReason?.(wheelContext({ realmReleaseUnavailable: true })),
    ).toBe(RELEASE_UNAVAILABLE_REASON)

    // Open domain + authored definition: enabled.
    expect(
      slot?.disabledReason?.(
        wheelContext({ artifactDomainUnlocked: true }),
      ),
    ).toBeNull()

    // C2C-66 arm: open domain but NO authored definition (e.g. a future
    // Kiem Tu artifact) reads the definition-pending terminal reason -
    // the deferred-window logic must not shadow it.
    expect(
      slot?.disabledReason?.(
        wheelContext({ artifactDomainUnlocked: true, hasArtifactDefinition: false }),
      ),
    ).toBe('Bản mệnh pháp bảo của nghề này đang chờ thiết kế')
  })

  describe('BreakthroughOutcomeService tier advance under the open window', () => {
    beforeEach(() => {
      setActivePinia(createPinia())
    })

    it('a Kim Dan player releases banked artifact tiers exactly as before', () => {
      const gameManager = new GameManager()
      const player = usePlayerStore()
      player.realmId = 'golden_core'
      player.realmLevel = 1
      player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
      // Bank the exact requirement so the breakthrough releases one tier.
      player.artifact.experience = getArtifactExpRequired(1)
      addCultivation(player.$state, player.cultivationRequired)

      const service = new BreakthroughOutcomeService()
      const result = service.breakthrough(player, gameManager.realmAdvanceOps)

      expect(result.kind).toBe('success')
      if (result.kind !== 'success') throw new Error('unreachable')
      expect(player.realmLevel).toBe(2)
      expect(player.artifact.realmLevel).toBe(2)
      expect(player.artifact.experience).toBe(0)
      expect(result.artifactTouched).toBe(true)
    })
  })
})
