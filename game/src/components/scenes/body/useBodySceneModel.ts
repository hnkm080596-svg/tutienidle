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
  collectBodyChapterBaseStatDeltas,
  getBodyChapterProgress,
  isBodyChapterUnlocked,
  statDeltaEntries,
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
import { MERIDIANS, TINH_HOA_BAO_THE_MATERIAL_ID } from '@/data/realm/Meridians'
import { MERIDIAN_FULL_PROGRESS, readMeridianProgress } from '@/core/realm/body/MeridianChapter'
import { REALMS } from '@/data/realms/realm'
import {
  getZhouTianCapacity,
  isDaiChuThienReached,
  isTieuChuThienReached,
} from '@/core/realm/body/ZhouTianChapter'
import {
  ZHOU_TIAN_CURRENCY_MATERIAL_ID,
  ZHOU_TIAN_REALM_ID,
  zhouTianStepCost,
  zhouTianStepReward,
} from '@/data/realm/ZhouTian'
import { statLabel } from '@/core/stats/StatLabels'
import type {
  BodyChipView,
  BodyPourSpec,
  BodyUnitView,
} from './bodySceneModel'
import { getBodyRefinementProgressMultiplier } from '@/core/talent/TalentEffects'

export interface BodyChapterModel {
  id: BodyChapterId
  unlocked: boolean
  completed: number
  total: number
  units: BodyUnitView[]
  chips: BodyChipView[]
  totalRows: readonly { label: string; value: string }[]
  /** Single gate line for a chapter whose every unit is out of reach
   *  (e.g. the meridian page below Luyen Khi) - real unlock condition,
   *  rendered in place of the hidden unit content. */
  lockHint?: string
}

function materialName(manager: GameManager, id: string): string {
  return manager.materialRegistry.has(id)
    ? manager.materialRegistry.get(id).name
    : id
}

function materialIcon(manager: GameManager, id: string): string | undefined {
  return manager.materialRegistry.has(id)
    ? manager.materialRegistry.get(id).icon
    : undefined
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
  // Owner ruling 2026-10-10: M-QI-09 substitution removed - the gate
  // counts only the base physique-essence stack again.

  return BODY_REFINEMENT_TIERS.map((tier, index): BodyUnitView => {
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
        // Canonical tier naming restored (docs/systems/body-refinement.md):
        // the chips carry Luyen Bi/Nhuc/Cot/... directly, the positional
        // 'Tang N' survives only as the ordinal hint.
        label: tier.name,
        hint: t('panels.body.chips.tier', { n: index + 1 }),
        status: status === 'done' ? 'done' : status === 'active' ? 'active' : 'locked',
      },
      title: tier.name,
      description: tier.description,
      status,
      gains: baseGainKeys(tier.baseGains).map(stat => ({
        stat,
        label: statLabel(stat),
        value: `+${tier.baseGains[stat] ?? 0}`,
        numericValue: tier.baseGains[stat] ?? 0,
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
      // Manual pour (owner ruling 2026-10-09): any held essence is
      // clickable - the invest consumes only what the tier still needs.
      canInvest: status === 'active' && have > 0,
      progress: { value: unitProgress, max: cap },
    }
  }).filter((unit) => unit.status !== 'locked')
}

function buildMeridianUnits(
  player: PlayerData,
  manager: GameManager,
  t: (key: string, params?: Record<string, unknown>) => string,
): BodyUnitView[] {
  // Progressive-percent model: the investable unit is the first
  // meridian below 100% in canonical order; done = 100, everything
  // past the next stays locked.
  const meridianProgress = readMeridianProgress(player)
  const nextIndex = MERIDIANS.findIndex(
    (meridian) => (meridianProgress[meridian.id] ?? 0) < 100,
  )
  const seqUnlocked = isBodyChapterUnlocked(player, 'meridian')
  const ownedEssence = manager.materialBag.getAmount(TINH_HOA_BAO_THE_MATERIAL_ID)
  const essenceName = materialName(manager, TINH_HOA_BAO_THE_MATERIAL_ID)
  const essenceIcon = materialIcon(manager, TINH_HOA_BAO_THE_MATERIAL_ID)

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

  return MERIDIANS.map((meridian, flatIndex): BodyUnitView => {
    const pageGate = pageGateByRealm.get(meridian.pageRealmId) ?? null
    const pageUnlocked = pageGate === null
    const inPageRealm = player.realmId === meridian.pageRealmId
    const realmName =
      REALMS.find(realm => realm.id === meridian.pageRealmId)?.name ?? meridian.pageRealmId

    const progressPercent = meridianProgress[meridian.id] ?? 0
    const status: BodyUnitView['status'] = !pageUnlocked
      ? 'locked'
      : progressPercent >= 100
        ? 'done'
        : flatIndex === nextIndex
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
        // Canonical meridian naming restored (Ky Kinh Bat Mach catalog):
        // the chips carry Nham/Doi/Am Kieu/... directly, the positional
        // 'Mach N' survives only as the ordinal hint.
        label: meridian.name,
        hint: t('panels.body.chips.meridian', { n: flatIndex + 1 }),
        status: status === 'done' ? 'done' : status === 'next' ? 'active' : 'locked',
      },
      title: meridian.name,
      description: meridian.description,
      status,
      gains: meridian.stats.map(stat => ({
        stat,
        label: statLabel(stat),
        value: `+${(meridian.percentAtFullTier * 100).toFixed(0)}%`,
        numericValue: meridian.percentAtFullTier * 100,
        percent: true,
      })),
      costs: [{
        id: TINH_HOA_BAO_THE_MATERIAL_ID,
        name: essenceName,
        icon: essenceIcon,
        have: ownedEssence,
        need: meridian.thongMachDanCost,
        met: ownedEssence >= meridian.thongMachDanCost,
      }],
      gates,
      actionable: status === 'next',
      canInvest: pageUnlocked && seqUnlocked && status === 'next'
        && ownedEssence >= meridian.thongMachDanCost && paced,
      progress: { value: progressPercent, max: 100 },
      progressPercent,
    }
  })
  // Locked meridians still flow through so the figure column renders all
  // eight dots dimmed (owner ruling 2026-10-09).
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

  // The sequential gate (incomplete Bat Mach) leaves nothing viewable -
  // hidden like every other out-of-reach unit; the chapter seal stays
  // locked and the page cannot be opened anyway.
  if (status === 'locked') {
    return []
  }

  return [{
    id: 'zhou_tian_next',
    chip: {
      id: 'zhou_tian_next',
      label: status === 'active' || status === 'complete'
        ? t('panels.body.chips.step', { n: Math.min(completed + 1, capacity) })
        : t(`panels.realm.zhouTian.${status === 'realm_locked' ? 'stateRealmLocked' : 'stateLocked'}`),
      hint: t('panels.realm.zhouTian.title'),
      status: status === 'complete' ? 'done' : status === 'active' ? 'active' : 'locked',
    },
    title: status === 'complete'
      ? t('panels.realm.zhouTian.stateComplete')
      : status === 'active'
        // Step counter only means something while a next step exists -
        // locked units carry the state label instead of 'Buoc 1 / 0'.
        ? t('panels.body.unit.stepTitle', { n: Math.min(completed + 1, capacity), total: capacity })
        : t(`panels.realm.zhouTian.${status === 'realm_locked' ? 'stateRealmLocked' : 'stateLocked'}`),
    description: t('panels.body.zhouTian.description'),
    status,
    gains: status === 'active'
      ? (Object.keys(reward) as (keyof typeof reward)[])
          .filter(stat => (reward[stat] ?? 0) > 0)
          .map(stat => ({
            stat,
            label: statLabel(stat),
            value: `+${reward[stat] ?? 0}`,
            numericValue: reward[stat] ?? 0,
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

function buildChapterTotalRows(
  player: PlayerData,
  id: BodyChapterId,
  units: readonly BodyUnitView[],
): { label: string; value: string }[] {
  // Big-tier total stats (owner ruling 2026-10-10): Ren The is ONE big
  // tier - the card lists the chapter's accumulated grants, which the
  // domain computes as done tiers at full baseGains + the in-progress
  // tier scaled by progress/cap. Other chapters keep the done-unit sum.
  if (id === 'body_refinement') {
    const deltas = collectBodyChapterBaseStatDeltas(player, 'body_refinement')
    return statDeltaEntries(deltas).map(([stat, value]) => ({
      label: statLabel(stat),
      value: `+${Number.parseFloat((value ?? 0).toFixed(2))}`,
    }))
  }

  const sums = new Map<string, { value: number; percent: boolean }>()
  for (const unit of units) {
    if (unit.status !== 'done' && unit.status !== 'complete') continue
    for (const gain of unit.gains) {
      const entry = sums.get(gain.label) ?? { value: 0, percent: false }
      entry.value += gain.numericValue
      if (gain.percent === true) entry.percent = true
      sums.set(gain.label, entry)
    }
  }
  return [...sums.entries()].map(([label, entry]) => ({
    label,
    value: `+${Number.parseFloat(entry.value.toFixed(2))}${entry.percent ? '%' : ''}`,
  }))
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
        totalRows: buildChapterTotalRows(player.$state, id, units),
        lockHint: units.length === 0 ? chapterLockHint(id) : undefined,
      }
    })
  })

  // A chapter whose whole catalog sits out of reach renders just its
  // unlock condition instead of empty rows (the meridian page below
  // Luyen Khi, the sealed Chu Thien before Bat Mach completes).
  function chapterLockHint(id: BodyChapterId): string {
    if (id === 'meridian') {
      const lockedPage = listMeridianPages().find(
        (page) => !isMeridianPageUnlocked(player.$state, page.pageRealmId),
      )
      if (lockedPage) {
        const realmName = REALMS.find(
          (realm) => realm.id === lockedPage.pageRealmId,
        )?.name ?? lockedPage.pageRealmId
        return t('panels.realm.meridian.pageLocked', { realm: realmName })
      }
    }
    if (id === 'zhou_tian') {
      return t('panels.realm.zhouTian.locked')
    }
    return t('body.empty')
  }

  // Selection: remembered per chapter; defaults to the actionable unit
  // (the "next" row). With nothing left to invest the card shows the
  // highest achieved tier (owner ruling 2026-10-10: "dung canh gioi da
  // dat duoc") - falling back to the first unit covers a fresh save.
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
    let lastDone: BodyUnitView | undefined
    for (const unit of model.units) {
      if (unit.status === 'done') lastDone = unit
    }
    return picked
      ?? model.units.find(unit => unit.actionable)
      ?? lastDone
      ?? model.units[0]
      ?? null
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

  /**
   * investActive + the pour replay spec: captures the displayed
   * currency count and the bar fill around the real debit so the
   * details card can animate slot->bar. One spec shape for every
   * chapter - the branches differ only in WHERE the count and the
   * fill live (essence bag + tier / phap bag + step count / pill bag
   * + meridian percent).
   */
  function pourActive(chapterId: BodyChapterId): { consumed: number; pour: BodyPourSpec | null } {
    if (chapterId === 'body_refinement') {
      const before = player.$state.bodyProgression.body_refinement
      const haveBefore = gameManager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)
      const tierBefore = { completed: before.completedTiers, progress: before.currentTierProgress }
      const consumed = investActive(chapterId)
      if (consumed <= 0) {
        return { consumed, pour: null }
      }
      return {
        consumed,
        pour: {
          consumed,
          haveFrom: haveBefore,
          haveTo: gameManager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID),
          progressPerMaterial: getBodyRefinementProgressMultiplier(
            player.$state.selectedTalentIds,
            player.$state.talentLevels,
          ),
          tierProgress: tierBefore.progress,
          tierStartIndex: tierBefore.completed,
          caps: BODY_REFINEMENT_TIERS.slice(tierBefore.completed).map(tier => tier.cap),
        },
      }
    }

    if (chapterId === 'zhou_tian') {
      const haveBefore = gameManager.materialBag.getAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
      const completedBefore = player.$state.bodyProgression.zhou_tian.completed
      const capacity = getZhouTianCapacity(player.$state)
      const consumed = investActive(chapterId)
      if (consumed <= 0) {
        return { consumed, pour: null }
      }
      return {
        consumed,
        pour: {
          consumed,
          haveFrom: haveBefore,
          haveTo: gameManager.materialBag.getAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID),
          // The fill counts STEPS - invest commits exactly one step,
          // so each consumed essence buys 1/consumed of that step.
          progressPerMaterial: 1 / consumed,
          tierProgress: completedBefore,
          tierStartIndex: 0,
          caps: [capacity],
        },
      }
    }

    // meridian: one pill pours into the next unopened meridian's
    // percent bar - the motes land on the same tube the viewed unit
    // shows (the investable meridian IS the viewed one when the
    // button is enabled). tierStartIndex must be the TARGET's unit
    // index so the figure's sequential reveal rides that meridian -
    // index 0 would flicker Nham Mach 'current' mid-pour.
    const progressBefore = readMeridianProgress(player.$state)
    const targetIndex = MERIDIANS.findIndex(
      meridian => (progressBefore[meridian.id] ?? 0) < MERIDIAN_FULL_PROGRESS,
    )
    const targetId = targetIndex >= 0 ? MERIDIANS[targetIndex]!.id : undefined
    const haveBefore = gameManager.materialBag.getAmount(TINH_HOA_BAO_THE_MATERIAL_ID)
    const consumed = investActive(chapterId)
    if (consumed <= 0) {
      return { consumed, pour: null }
    }
    const progressAfter = readMeridianProgress(player.$state)
    const targetBefore = targetId !== undefined ? (progressBefore[targetId] ?? 0) : 0
    const progressDelta = targetId !== undefined
      ? (progressAfter[targetId] ?? 0) - targetBefore
      : 0
    return {
      consumed,
      pour: targetId === undefined || progressDelta <= 0
        ? null
        : {
          consumed,
          haveFrom: haveBefore,
          haveTo: gameManager.materialBag.getAmount(TINH_HOA_BAO_THE_MATERIAL_ID),
          progressPerMaterial: progressDelta / consumed,
          tierProgress: targetBefore,
          tierStartIndex: targetIndex,
          caps: [MERIDIAN_FULL_PROGRESS],
        },
    }
  }

  return { chapters, chapter, viewedUnit, selectUnit, investActive, pourActive }
}
