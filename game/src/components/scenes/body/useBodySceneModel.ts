// Scene 08 scaffold (HK mission) - body scene unit model. Collapses the
// three body chapters (Luyen The tiers / Bat Mach openings / Chu Thien
// steps) into one unit-card + chip-selector shape so the detail panel and
// tier rail render identically for every chapter. All reads go through
// the canonical chapter read-models; invest stays on
// realmAdvanceOps.investBodyChapter (the chapter re-validates).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import type { PlayerData } from '@/core/player/Player'
import type { GameManager } from '@/core/game/GameManager'
import {
  getBodyChapterProgress,
  isBodyChapterUnlocked,
} from '@/core/realm/body/BodyProgressionSystem'
import type { BodyChapterId } from '@/core/realm/body/BodyChapter'
import {
  getRefinementCurrentTierProgress,
  getTierCap,
  isTierRequiredRealmLevelMet,
} from '@/core/realm/body/BodyRefinementChapter'
import {
  baseGainKeys,
  BODY_REFINEMENT_TIERS,
  TINH_HOA_PHAM_THE_MATERIAL_ID,
} from '@/data/realm/BodyRefinement'
import {
  isMeridianPageUnlocked,
  listMeridianPages,
} from '@/core/realm/body/MeridianPages'
import { MERIDIANS, THONG_MACH_DAN_MATERIAL_ID } from '@/data/realm/Meridians'
import { REALMS } from '@/data/realms/realm'
import {
  getZhouTianCapacity,
  isDaiChuThienReached,
  isTieuChuThienReached,
} from '@/core/realm/body/ZhouTianChapter'
import {
  ZHOU_TIAN_CURRENCY_MATERIAL_ID,
  ZHOU_TIAN_DAI_STEP,
  ZHOU_TIAN_REALM_ID,
  ZHOU_TIAN_TIEU_STEP,
  zhouTianStepCost,
  zhouTianStepReward,
} from '@/data/realm/ZhouTian'
import { statLabel } from '@/core/stats/StatLabels'
import type {
  BodyChipView,
  BodyUnitView,
} from './bodySceneModel'

export interface BodyChapterModel {
  id: BodyChapterId
  unlocked: boolean
  completed: number
  total: number
  units: BodyUnitView[]
  chips: BodyChipView[]
}

function materialName(manager: GameManager, id: string): string {
  return manager.materialRegistry.has(id)
    ? manager.materialRegistry.get(id).name
    : id
}

function pillName(manager: GameManager, id: string): { name: string; icon?: string } {
  if (!manager.pillRegistry.has(id)) return { name: id }
  const pill = manager.pillRegistry.get(id)
  return { name: pill.name, icon: pill.icon }
}

function buildRefinementUnits(
  player: PlayerData,
  manager: GameManager,
  t: (key: string, params?: Record<string, unknown>) => string,
): BodyUnitView[] {
  const progress = getBodyChapterProgress(player, 'body_refinement')
  const currentTierProgress = getRefinementCurrentTierProgress(player)
  const have = manager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)
  const essenceName = materialName(manager, TINH_HOA_PHAM_THE_MATERIAL_ID)

  return BODY_REFINEMENT_TIERS.map((tier, index) => {
    const cap = getTierCap(index)

    let unitProgress = 0
    let status: BodyUnitView['status'] = 'locked'
    if (index < progress.completed) {
      unitProgress = cap
      status = 'done'
    } else if (index === progress.completed) {
      unitProgress = currentTierProgress
      status = isTierRequiredRealmLevelMet(player, index)
        ? 'active'
        : 'realm_locked'
    }

    const gates: string[] = []
    if (status === 'realm_locked') {
      gates.push(t('panels.realm.bodyRefinement.tierLock', { level: tier.requiredRealmLevel }))
    }

    return {
      id: tier.id,
      chip: {
        id: tier.id,
        label: t('panels.body.chips.tier', { n: index + 1 }),
        hint: tier.name,
        status: status === 'done' ? 'done' : status === 'active' ? 'active' : 'locked',
      },
      title: t('panels.body.unit.tierTitle', { tier: index + 1, name: tier.name }),
      description: tier.description,
      status,
      gains: baseGainKeys(tier.baseGains).map(stat => ({
        stat,
        label: statLabel(stat),
        value: `+${tier.baseGains[stat] ?? 0}`,
      })),
      costs: [{
        id: TINH_HOA_PHAM_THE_MATERIAL_ID,
        name: essenceName,
        have,
        // The active tier's remaining need is the display's "cost" - a
        // filled tier shows as met.
        need: cap - unitProgress,
        met: status === 'done' || have >= cap - unitProgress,
      }],
      gates,
      actionable: status === 'active',
      // Refinement invests through the tick; the button consumes now.
      canInvest: status === 'active' && have > 0,
      progress: { value: unitProgress, max: cap },
    }
  })
}

function buildMeridianUnits(
  player: PlayerData,
  manager: GameManager,
  t: (key: string, params?: Record<string, unknown>) => string,
): BodyUnitView[] {
  const progress = getBodyChapterProgress(player, 'meridian')
  const completed = progress.completed
  const seqUnlocked = isBodyChapterUnlocked(player, 'meridian')
  const ownedPills = manager.pillBag.getAmount(THONG_MACH_DAN_MATERIAL_ID)
  const pill = pillName(manager, THONG_MACH_DAN_MATERIAL_ID)

  // Paged model (M-E D2): a page whose realm the player has not reached
  // renders its rows locked with a page-level gate line.
  const pageGateByRealm = new Map<string, string>()
  for (const page of listMeridianPages()) {
    if (!isMeridianPageUnlocked(player, page.pageRealmId)) {
      const realmName =
        REALMS.find(realm => realm.id === page.pageRealmId)?.name ?? page.pageRealmId
      pageGateByRealm.set(page.pageRealmId, t('panels.realm.meridian.pageLocked', { realm: realmName }))
    }
  }

  return MERIDIANS.map((meridian, flatIndex) => {
    const pageGate = pageGateByRealm.get(meridian.pageRealmId) ?? null
    const pageUnlocked = pageGate === null
    const inPageRealm = player.realmId === meridian.pageRealmId
    const realmName =
      REALMS.find(realm => realm.id === meridian.pageRealmId)?.name ?? meridian.pageRealmId

    const status: BodyUnitView['status'] = !pageUnlocked
      ? 'locked'
      : flatIndex < completed
        ? 'done'
        : flatIndex === completed
          ? 'next'
          : 'locked'

    const gates: string[] = []
    if (pageGate !== null) {
      gates.push(pageGate)
    }
    if (status === 'next') {
      if (inPageRealm && player.realmLevel < meridian.requiredRealmLevel) {
        gates.push(t('panels.realm.meridian.realmGate', { realm: realmName, level: meridian.requiredRealmLevel }))
      }
      if (!seqUnlocked) {
        gates.push(t('panels.realm.meridian.seqGate'))
      }
    }

    const paced =
      player.realmId !== meridian.pageRealmId ||
      player.realmLevel >= meridian.requiredRealmLevel

    return {
      id: meridian.id,
      chip: {
        id: meridian.id,
        label: t('panels.body.chips.meridian', { n: flatIndex + 1 }),
        hint: meridian.name,
        status: status === 'done' ? 'done' : status === 'next' ? 'active' : 'locked',
      },
      title: meridian.name,
      description: meridian.description,
      status,
      gains: meridian.stats.map(stat => ({
        stat,
        label: statLabel(stat),
        value: `+${(meridian.percentAtFullTier * 100).toFixed(0)}%`,
      })),
      costs: [{
        id: THONG_MACH_DAN_MATERIAL_ID,
        name: pill.name,
        icon: pill.icon,
        have: ownedPills,
        need: meridian.thongMachDanCost,
        met: ownedPills >= meridian.thongMachDanCost,
      }],
      gates,
      actionable: status === 'next',
      canInvest: pageUnlocked && seqUnlocked && status === 'next'
        && ownedPills >= meridian.thongMachDanCost && paced,
    }
  })
}

function buildZhouTianUnits(
  player: PlayerData,
  manager: GameManager,
  t: (key: string, params?: Record<string, unknown>) => string,
): BodyUnitView[] {
  const progress = getBodyChapterProgress(player, 'zhou_tian')
  const completed = progress.completed
  const capacity = getZhouTianCapacity(player)
  const unlocked = isBodyChapterUnlocked(player, 'zhou_tian')
  const complete = isDaiChuThienReached(player)
  const owned = manager.materialBag.getAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
  const essenceName = materialName(manager, ZHOU_TIAN_CURRENCY_MATERIAL_ID)

  const realmName =
    REALMS.find(realm => realm.id === ZHOU_TIAN_REALM_ID)?.name ?? ZHOU_TIAN_REALM_ID

  const status: BodyUnitView['status'] = complete
    ? 'complete'
    : !unlocked
      ? 'locked'
      : capacity <= 0
        ? 'realm_locked'
        : 'active'

  const gates: string[] = []
  if (status === 'locked') {
    gates.push(t('panels.realm.zhouTian.locked'))
  }
  if (status === 'realm_locked') {
    gates.push(t('panels.realm.zhouTian.realmLocked', { realm: realmName }))
  }

  const atCap = completed >= capacity
  const need = atCap ? 0 : zhouTianStepCost(completed)
  const reward = zhouTianStepReward(Math.min(completed, capacity - 1))

  return [{
    id: 'zhou_tian_next',
    chip: {
      id: 'zhou_tian_next',
      label: t('panels.body.chips.step', { n: Math.min(completed + 1, capacity) }),
      hint: t('panels.realm.zhouTian.title'),
      status: status === 'complete' ? 'done' : status === 'active' ? 'active' : 'locked',
    },
    title: status === 'complete'
      ? t('panels.realm.zhouTian.stateComplete')
      : t('panels.body.unit.stepTitle', { n: completed + 1, total: capacity }),
    description: t('panels.body.zhouTian.description'),
    status,
    gains: status === 'active'
      ? (Object.keys(reward) as (keyof typeof reward)[])
          .filter(stat => (reward[stat] ?? 0) > 0)
          .map(stat => ({
            stat,
            label: statLabel(stat),
            value: `+${reward[stat] ?? 0}`,
          }))
      : [],
    costs: status === 'active'
      ? [{
          id: ZHOU_TIAN_CURRENCY_MATERIAL_ID,
          name: essenceName,
          have: owned,
          need,
          met: owned >= need,
        }]
      : [],
    gates,
    actionable: status === 'active',
    canInvest: status === 'active' && owned >= need && need > 0,
    progress: { value: completed, max: capacity },
  }]
}

export const BODY_CHAPTER_ORDER: readonly BodyChapterId[] = [
  'body_refinement',
  'meridian',
  'zhou_tian',
]

export const BODY_CHAPTER_LABEL_KEYS: Record<BodyChapterId, string> = {
  body_refinement: 'panels.realm.bodyRefinement.title',
  meridian: 'panels.realm.meridian.title',
  zhou_tian: 'panels.realm.zhouTian.title',
}

const BODY_CHAPTER_SUBTITLE_KEYS: Record<BodyChapterId, string> = {
  body_refinement: 'panels.body.chapters.bodyRefinement.subtitle',
  meridian: 'panels.body.chapters.meridian.subtitle',
  zhou_tian: 'panels.body.chapters.zhouTian.subtitle',
}

const BODY_CHAPTER_CTA_KEYS: Record<BodyChapterId, string> = {
  body_refinement: 'panels.body.actions.investRefinement',
  meridian: 'panels.realm.meridian.invest',
  zhou_tian: 'panels.realm.zhouTian.invest',
}

export function bodyChapterSubtitleKey(id: BodyChapterId): string {
  return BODY_CHAPTER_SUBTITLE_KEYS[id]
}

export function bodyChapterCtaKey(id: BodyChapterId): string {
  return BODY_CHAPTER_CTA_KEYS[id]
}

/**
 * Assembles the per-chapter unit lists + chips + selection state the body
 * scene renders. `stateVersion` gates every read so tick-invested gains
 * and chapter unlocks refresh in place.
 */
export function useBodySceneModel() {
  const player = usePlayerStore()
  const gameManager = useGameManager()
  const { stateVersion, bumpState } = useStateVersion()
  const { t } = useI18n()

  const unitBuilders: Record<BodyChapterId, () => BodyUnitView[]> = {
    body_refinement: () => buildRefinementUnits(player.$state, gameManager, t),
    meridian: () => buildMeridianUnits(player.$state, gameManager, t),
    zhou_tian: () => buildZhouTianUnits(player.$state, gameManager, t),
  }

  const chapters = computed<BodyChapterModel[]>(() => {
    stateVersion.value

    return BODY_CHAPTER_ORDER.map((id) => {
      const progress = getBodyChapterProgress(player.$state, id)
      const units = unitBuilders[id]()
      const chips: BodyChipView[] = units.map(unit => unit.chip)

      if (id === 'zhou_tian') {
        // Chu Thien renders lore-milestone chips (Tieu 18 / Dai 36)
        // rather than 36 step chips; the card always carries the next
        // actionable step.
        chips.push(
          {
            id: 'milestone_tieu',
            label: t('panels.realm.zhouTian.tieuLabel'),
            hint: t('panels.body.chips.milestone'),
            status: isTieuChuThienReached(player.$state) ? 'done' : 'locked',
          },
          {
            id: 'milestone_dai',
            label: t('panels.realm.zhouTian.daiLabel'),
            hint: t('panels.body.chips.milestone'),
            status: isDaiChuThienReached(player.$state) ? 'done' : 'locked',
          },
        )
      }

      return {
        id,
        unlocked: isBodyChapterUnlocked(player.$state, id),
        completed: progress.completed,
        total: progress.total,
        units,
        chips,
      }
    })
  })

  // Selection: remembered per chapter; defaults to the actionable unit
  // (the "next" row), falling back to the first unit.
  const selectedUnitId = ref<Record<BodyChapterId, string | null>>({
    body_refinement: null,
    meridian: null,
    zhou_tian: null,
  })

  function chapter(id: BodyChapterId): BodyChapterModel {
    return chapters.value.find(entry => entry.id === id) ?? chapters.value[0]!
  }

  function viewedUnit(id: BodyChapterId): BodyUnitView | null {
    const model = chapter(id)
    const picked = model.units.find(unit => unit.id === selectedUnitId.value[id])
    return picked ?? model.units.find(unit => unit.actionable) ?? model.units[0] ?? null
  }

  function selectUnit(chapterId: BodyChapterId, unitId: string): void {
    selectedUnitId.value[chapterId] = unitId
  }

  function investActive(chapterId: BodyChapterId): number {
    const consumed = gameManager.realmAdvanceOps.investBodyChapter(
      player.$state,
      chapterId,
    )
    if (consumed > 0) {
      bumpState()
    }
    return consumed
  }

  return { chapters, chapter, viewedUnit, selectUnit, investActive }
}
