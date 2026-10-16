import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import { DONG_FU_BUILDING_IDS } from '@/presentation/background/DongFuBuildingArt'
import { isBetaBuildingSurface } from '@/core/betaScopeSurface'
import { getCurrentRealm } from '@/core/realm/realmSystem'

// Spec SS12 Thien Co Bang -- "what is worth doing right now", max a few
// actionable entries, never a quest log. Read-only over existing
// read-models (realm advance ops, quest ops, alchemy ops, building
// status); every entry's action is pure navigation into an existing
// surface -- no gameplay writes happen here.
export type ThienCoEntryKind =
  | 'breakthrough'
  | 'quest'
  | 'ready'
  | 'attribute_points'
  | 'active'
  | 'upgradeable'
  | 'auto_farm'

export interface ThienCoEntry {
  id: string
  kind: ThienCoEntryKind
  priority: number
  titleKey: string
  titleParams?: Record<string, string | number>
  detailKey: string
  detailParams?: Record<string, string | number>
  ctaKey: string
  run: () => void
}

const MAX_ENTRIES = 4
const TICKER_MS = 30_000

const PRIORITY: Record<ThienCoEntryKind, number> = {
  breakthrough: 0,
  quest: 1,
  ready: 2,
  attribute_points: 2.5,
  active: 3,
  upgradeable: 4,
  auto_farm: 5,
}

export function useThienCoEntries() {
  const gameManager = useGameManager()
  const player = usePlayerStore()
  const ui = useUiStore()
  const navigation = useBuildingNavigation()
  const { stateVersion } = useStateVersion()

  const nowMs = ref(gameManager.time.now())
  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    timer = setInterval(() => {
      nowMs.value = gameManager.time.now()
    }, TICKER_MS)
  })

  onBeforeUnmount(() => {
    if (timer !== undefined) {
      clearInterval(timer)
    }
  })

  const entries = computed<ThienCoEntry[]>(() => {
    // stateVersion re-evaluates building/quest/job reads on every
    // authoritative bump; nowMs keeps the alchemy countdown fresh.
    void stateVersion.value
    void nowMs.value

    const list: ThienCoEntry[] = []
    const currentRealm = getCurrentRealm(player.realmId)

    if (gameManager.realmAdvanceOps.canTriggerBreakthrough(player.$state)) {
      list.push({
        id: 'breakthrough',
        kind: 'breakthrough',
        priority: PRIORITY.breakthrough,
        titleKey: 'home.thienCo.breakthrough.title',
        detailKey: 'home.thienCo.breakthrough.detail',
        ctaKey: 'home.thienCo.breakthrough.cta',
        run: () => ui.openStandalonePanel('realm'),
      })
    } else if (
      player.realmLevel < currentRealm.maxLevel &&
      player.cultivation >= player.cultivationRequired
    ) {
      list.push({
        id: 'minor_breakthrough',
        kind: 'breakthrough',
        priority: PRIORITY.breakthrough,
        titleKey: 'home.thienCo.minorBreakthrough.title',
        detailKey: 'home.thienCo.minorBreakthrough.detail',
        detailParams: { realm: currentRealm.name, level: player.realmLevel + 1 },
        ctaKey: 'home.thienCo.breakthrough.cta',
        run: () => ui.openStandalonePanel('realm'),
      })
    }

    const claimable = gameManager.questOps
      .getActiveQuests()
      .filter(({ quest }) => gameManager.questOps.canClaimQuest(quest.id)).length

    if (claimable > 0) {
      list.push({
        id: 'quest',
        kind: 'quest',
        priority: PRIORITY.quest,
        titleKey: 'home.thienCo.quest.title',
        detailKey: 'home.thienCo.quest.detail',
        detailParams: { count: claimable },
        ctaKey: 'home.thienCo.quest.cta',
        run: () => ui.openStandalonePanel('quest'),
      })
    }

    if (player.attributePoints > 0) {
      list.push({
        id: 'attribute_points',
        kind: 'attribute_points',
        priority: PRIORITY.attribute_points,
        titleKey: 'home.thienCo.attributePoints.title',
        detailKey: 'home.thienCo.attributePoints.detail',
        detailParams: { count: player.attributePoints },
        ctaKey: 'home.thienCo.attributePoints.cta',
        run: () => ui.openLeftPanel('character'),
      })
    }

    const alchemyJobs = gameManager.alchemyOps.getAlchemyJobs()

    for (const buildingId of DONG_FU_BUILDING_IDS) {
      // BETA SCOPE LOCK v2: a scope-hidden building (chi_hien_quan) earns
      // no opportunity entry - openBuilding fails closed on it, so a CTA
      // here would render dead.
      if (!isBetaBuildingSurface(buildingId)) {
        continue
      }

      const status = navigation.getBuildingStatus(buildingId)
      const { template } = navigation.getBuildingPresentation(buildingId)

      if (status === 'ready') {
        list.push({
          id: `ready:${buildingId}`,
          kind: 'ready',
          priority: PRIORITY.ready,
          titleKey: 'home.thienCo.ready.title',
          titleParams: { name: template?.name ?? buildingId },
          detailKey: 'home.thienCo.ready.detail',
          ctaKey: 'home.thienCo.ready.cta',
          run: () => navigation.openBuilding(buildingId),
        })
      } else if (status === 'active' && buildingId === 'pill_room' && alchemyJobs.length > 0) {
        // QUEUE REWORK - the entry describes jobs[0] coherently: its
        // per-unit progress AND its own countdown. Reading the cross-
        // order minimum would attribute another (faster) order's
        // deadline to the sentence narrating this one.
        const brewing = alchemyJobs[0]!
        const minutes = Math.max(1, Math.ceil((brewing.completesAtMs - nowMs.value) / 60_000))
        const total = Math.max(1, brewing.quantity ?? 1)
        const done = Math.min(total, Math.max(0, brewing.unitsDone ?? 0))
        const waiting = Math.max(0, alchemyJobs.length - 1)

        list.push({
          id: 'active:pill_room',
          kind: 'active',
          priority: PRIORITY.active,
          titleKey: 'home.thienCo.active.title',
          detailKey: 'home.thienCo.active.detail',
          detailParams: { done, total, waiting, minutes },
          ctaKey: 'home.thienCo.active.cta',
          run: () => navigation.openBuilding('pill_room'),
        })
      } else if (status === 'upgradeable') {
        list.push({
          id: `upgradeable:${buildingId}`,
          kind: 'upgradeable',
          priority: PRIORITY.upgradeable,
          titleKey: 'home.thienCo.upgradeable.title',
          titleParams: { name: template?.name ?? buildingId },
          detailKey: 'home.thienCo.upgradeable.detail',
          ctaKey: 'home.thienCo.upgradeable.cta',
          run: () => navigation.openBuilding(buildingId),
        })
      }
    }

    if (player.completedStageIds.length > 0 && !player.autoFarmStage) {
      list.push({
        id: 'auto_farm',
        kind: 'auto_farm',
        priority: PRIORITY.auto_farm,
        titleKey: 'home.thienCo.autoFarm.title',
        detailKey: 'home.thienCo.autoFarm.detail',
        ctaKey: 'home.thienCo.autoFarm.cta',
        run: () => ui.openLeftPanel('stage_select'),
      })
    }

    return list
      .sort((left, right) => left.priority - right.priority)
      .slice(0, MAX_ENTRIES)
  })

  return { entries }
}
