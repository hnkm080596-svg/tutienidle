// DEV ONLY Phap Tu test lab - same window-hook pattern as
// enemySpawnDebug.ts: self-gates on import.meta.env.DEV and is registered
// from App.vue only inside the mock backend, so a remote-committed save
// can never receive the writes below.
//
// Purpose: exercise the Phap Tu (spell_pathway) kit - hoa_cau_thuat /
// tam_muoi_chan_hoa / linh_bao plus the The -> Phap The empowerment and
// the element constellation tree - without grinding a character from
// Pham Nhan to Truc Co.
//
// window.__tutienPhapTuLab.setup(options?) - provision the current
//   character through the REAL ops seams only:
//     mortal+uncommitted  -> commitFiveElementInitiation(element)
//     qi_refining         -> TribulationOutcomeService.resolveVictory
//                            ('foundation_establishment', grade 'human')
//     kit leg             -> purchaseNode('linh_ngo_<special>') learns the
//                            Phap Trang special + linhLucHoTheCap
//     attribute leg       -> attributePoints grant + allocateAttributePoint
//   Auto-resolves the breakthrough talent entitlement (first NEW offer)
//   so the modal never blocks the lab battle; pass keepTalent: true to
//   leave the real modal pending instead.
// window.__tutienPhapTuLab.battle(stageId?) - unlock the stage chain
//   (completedStageIds fill + requiredRealmLevel bump) then enter through
//   the same admitted startStage transition the stage panel uses, with
//   manual input enabled so skills are picked deliberately.
// window.__tutienPhapTuLab.openConstellation() - open the skill panel
//   hosting the element constellation tree.
// window.__tutienPhapTuLab.status() - one-line provisioning summary.
//
// Deps are injected by the caller (App.vue) - no reaching into
// GameManager privates, the Phaser registry, or Vue inject().

import type { GameManager } from '../game/GameManager'
import type { PlayerData } from '../player/Player'
import type { Stage } from '../stage/Stage'
import type { MainStatKey } from '../stats/StatTypes'
import type { ElementType } from '../element/ElementType'
import { isBattleInProgress } from '../battle/BattleTypes'
import { isBetaElement } from '../betaScope'
import { CAST_LEVELING_THRESHOLDS } from '../skill/CastLeveling'
import { CORE_REALM_LEVEL, getRealmIndex } from '../realm/realmSystem'
import { SPELL_KIT_IDS } from '../../data/skill/Skills'
import {
  TribulationOutcomeService,
  type TribulationPlayerWriter,
} from '../tribulation/TribulationOutcomeService'
import {
  getUpgradeableTalentIds,
  reconcileTalentEntitlement,
} from '../talent/TalentEntitlement'

export interface PhapTuLabDeps {
  gameManager: GameManager
  // The Pinia player store INSTANCE (never $state) - resolveVictory and the
  // talent entitlement seams write optional keys that only materialize
  // through the store proxy.
  player: TribulationPlayerWriter
  // store.$state - the JSON-cloneable surface every other production call
  // site passes to progression/realm ops (commitFiveElementInitiation
  // JSON-clones its player arg, so the store proxy cannot ride this leg).
  playerState: PlayerData
  // UI glue bound in the dev bridge component: useBattleActions seams.
  enterStage: (stage: Stage) => Promise<boolean>
  // battleActions.exitCombatToHome semantics - the standalone panels
  // only render on the home route, so openConstellation leaves combat
  // first (no-op for the caller to care about: the teardown self-guards
  // on battles that already ended).
  exitCombat: () => void
  openSkillPanel: () => void
  // Mirrors the skill-bar mode toggle: ui.setCombatInputMode + manual flag.
  setManualInput: (enabled: boolean) => void
  refreshUi: () => void
}

export interface PhapTuLabSetupOptions {
  element?: ElementType
  attributePoints?: number
  skillInsight?: number
  keepTalent?: boolean
}

interface TutienPhapTuLab {
  setup: (options?: PhapTuLabSetupOptions) => string
  battle: (stageId?: string, manual?: boolean) => Promise<string>
  openConstellation: () => string
  status: () => string
}

declare global {
  interface Window {
    __tutienPhapTuLab?: TutienPhapTuLab
  }
}

// Truc Co stat budget granted then spent through the real allocator
// (cap-respecting), so the lab character fields like a leveled one.
const ATTRIBUTE_PLAN: ReadonlyArray<readonly [MainStatKey, number]> = [
  ['attunement', 40],
  ['vitality', 30],
  ['dexterity', 20],
]

const DEFAULT_STAGE_ID = 'foundation_floor_1'
const FOUNDATION_REALM_ID = 'foundation_establishment'

export function registerPhapTuLab(deps: PhapTuLabDeps): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return
  }

  const inCombat = (): boolean => {
    const battle = deps.gameManager.getTurnBattle()
    return battle !== null && isBattleInProgress(battle.state)
  }

  const setup = (options: PhapTuLabSetupOptions = {}): string => {
    if (inCombat()) {
      return 'refused: in_combat'
    }

    const { gameManager, player, playerState } = deps
    const steps: string[] = []

    // Path + element leg - the atomic initiation ritual. A character
    // already committed to spell_pathway skips it; anything else (sword,
    // body, hidden ways) is refused so the lab never forges a cross-path
    // state the real game cannot produce.
    if (playerState.cultivationPath === undefined && playerState.cultivationWay === undefined) {
      if (playerState.realmId !== 'mortal') {
        return `refused: uncommitted save is not mortal (realm=${playerState.realmId})`
      }

      const element = options.element ?? 'fire'

      if (!isBetaElement(element)) {
        return `refused: unknown element '${element}'`
      }

      // Quan Khi gate: the ritual requires realmLevel >= CORE_REALM_LEVEL.
      // A fresh save sits at 1 - bump through the same field the real
      // leveling loop writes (no op seam exists for raw level jumps).
      if (playerState.realmLevel < CORE_REALM_LEVEL) {
        playerState.realmLevel = CORE_REALM_LEVEL
      }

      // linh_bao cast-level mirrors the __fixtures__ prerequisite seed so
      // the starter basic arrives pre-leveled like a played character.
      const counts = (playerState.skillCastCounts ??= {})
      const linhBaoGate = CAST_LEVELING_THRESHOLDS.linh_bao?.lv3 ?? 0
      counts.linh_bao = Math.max(counts.linh_bao ?? 0, linhBaoGate)

      const result = gameManager.realmAdvanceOps.commitFiveElementInitiation(element, playerState)

      if (!result.ok) {
        return `initiation_failed: ${result.reason}`
      }

      steps.push(`initiation:${element}`)
    } else if (playerState.cultivationPath !== 'spell' || playerState.cultivationWay !== 'spell_pathway') {
      return `refused: save already committed to ${playerState.cultivationPath}/${playerState.cultivationWay} - lab needs a fresh or spell_pathway character`
    }

    const element = playerState.spellPath.element

    if (element === null) {
      return 'refused: spell_pathway without an element commit (legacy/broken state)'
    }

    // Realm leg to Truc Co - the real victory consequence pipeline (realm
    // write, unequip, passives, way realm reward, talent entitlement).
    if (playerState.realmId === 'mortal') {
      return 'refused: committed save is still mortal'
    }

    if (getRealmIndex(playerState.realmId) < getRealmIndex(FOUNDATION_REALM_ID)) {
      new TribulationOutcomeService().resolveVictory(player, gameManager, {
        targetRealmId: FOUNDATION_REALM_ID,
        grade: 'human',
        breakthroughType: 'normal',
      })
      steps.push('truc_co')
    }

    // The entitlement modal soft-blocks input until decided - auto-pick
    // the first legal offer so the lab battle is reachable immediately.
    // keepTalent leaves the real modal pending for talent-flow testing.
    if (!options.keepTalent && player.pendingTalentEntitlement !== undefined) {
      const newOffer = player.pendingTalentEntitlement.offeredTalentIds[0]
      const upgrade = getUpgradeableTalentIds(player)[0]
      if (newOffer !== undefined) {
        gameManager.realmAdvanceOps.resolveTalentEntitlement(player, { kind: 'new', talentId: newOffer })
      } else if (upgrade !== undefined) {
        gameManager.realmAdvanceOps.resolveTalentEntitlement(player, { kind: 'upgrade', talentId: upgrade })
      } else {
        reconcileTalentEntitlement(player)
      }
    }

    // Kit leg - the Truc Co keystone grants the element special
    // (tam_muoi_chan_hoa for fire) + the Linh Luc Ho The cap. Insight
    // tops up to a floor (not +=) so re-running setup on a provisioned
    // save stays idempotent instead of stacking grants on every boot.
    playerState.skillInsight = Math.max(playerState.skillInsight, options.skillInsight ?? 20)

    const specialId = SPELL_KIT_IDS[element]?.[1]

    if (specialId === undefined) {
      return `refused: no kit for element '${element}'`
    }

    if (!gameManager.skillManager.has(specialId)) {
      const keystoneId = `linh_ngo_${specialId}`
      if (!gameManager.progressionOps.purchaseNode(keystoneId, playerState)) {
        return `keystone_failed: purchaseNode('${keystoneId}') returned false (insight=${playerState.skillInsight})`
      }
      steps.push(`special:${specialId}`)
    }

    // Attribute leg - fill toward plan targets through the real seam so
    // caps and per-point rules apply exactly like earned points. Only
    // the deficit is granted: re-running setup leaves a provisioned save
    // unchanged instead of stacking 90 points per boot.
    const statTarget = (stat: MainStatKey, target: number): number =>
      target + 1 - (playerState.baseStats[stat] ?? 0)
    const deficit = ATTRIBUTE_PLAN.reduce(
      (sum, [stat, target]) => sum + Math.max(0, statTarget(stat, target)),
      0,
    )
    playerState.attributePoints += options.attributePoints ?? deficit
    for (const [stat, target] of ATTRIBUTE_PLAN) {
      while (statTarget(stat, target) > 0) {
        if (!gameManager.progressionOps.allocateAttributePoint(playerState, stat)) {
          break
        }
      }
    }
    steps.push('attributes')

    deps.refreshUi()

    return steps.length > 0 ? `ok: ${steps.join(' | ')}` : 'ok: already provisioned'
  }

  const unlockStage = (stageId: string): string | null => {
    const { gameManager, playerState } = deps
    const stage = gameManager.catalogOps.getStage(stageId)

    if (!stage) {
      return `unknown_stage: ${stageId}`
    }

    // Realm-level gate some later floors carry - a lab character can jump
    // the level write directly (still a legal save value for its realm).
    if (
      stage.requiredRealmId === playerState.realmId &&
      stage.requiredRealmLevel !== undefined &&
      playerState.realmLevel < stage.requiredRealmLevel
    ) {
      playerState.realmLevel = stage.requiredRealmLevel
    }

    // Progress chain: floor N opens once floor N-1 is recorded cleared.
    const zone = gameManager.zoneRegistry.getZoneForStage(stageId)

    if (zone) {
      const index = zone.stageIds.indexOf(stageId)
      for (let i = 0; i < index; i++) {
        const predecessor = zone.stageIds[i]!
        if (!playerState.completedStageIds.includes(predecessor)) {
          playerState.completedStageIds.push(predecessor)
        }
      }
    }

    if (!gameManager.catalogOps.isStageUnlocked(stageId, playerState)) {
      return `still_locked: ${stageId} (realm=${playerState.realmId} lv=${playerState.realmLevel})`
    }

    return null
  }

  window.__tutienPhapTuLab = {
    setup,

    async battle(stageId: string = DEFAULT_STAGE_ID, manual = true): Promise<string> {
      if (inCombat()) {
        return 'refused: in_combat'
      }

      const failure = unlockStage(stageId)
      if (failure !== null) {
        return failure
      }

      deps.setManualInput(manual)

      const stage = deps.gameManager.catalogOps.getStage(stageId)!
      const entered = await deps.enterStage(stage)

      return entered ? `entered: ${stageId}` : `rejected: ${stageId}`
    },

    openConstellation(): string {
      if (inCombat()) {
        deps.exitCombat()
      }
      deps.openSkillPanel()
      return 'skill panel opened'
    },

    status(): string {
      const { gameManager, playerState } = deps
      const element = playerState.spellPath.element ?? '-'
      const kit = (SPELL_KIT_IDS[element as ElementType] ?? [])
        .map((skillId) => `${skillId}:${gameManager.skillManager.has(skillId) ? 'learned' : 'missing'}`)
        .join(', ')
      return [
        `realm=${playerState.realmId} lv=${playerState.realmLevel}`,
        `path=${playerState.cultivationPath ?? '-'}/${playerState.cultivationWay ?? '-'}`,
        `element=${element}`,
        `skills=[${kit}]`,
        `insight=${playerState.skillInsight} points=${playerState.attributePoints}`,
      ].join(' | ')
    },
  }
}
