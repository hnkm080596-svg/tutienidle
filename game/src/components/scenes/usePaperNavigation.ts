// Shared PaperPanelNavigation adapter for the fidelity surfaces: the
// approved nav id list maps to REAL production panel targets, filtered
// through beta admission. Selecting an item issues the same store calls
// the command wheel used - this composable owns no state of its own.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import {
  isBetaBuildingSurface,
  isBetaLeftPanelMode,
  isBetaStandalonePanel,
} from '@/core/betaScopeSurface'
import { symbolUrl } from './dong-fu/fidelity/dongFuUi'
import type { PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import type { LeftPanelMode, StandalonePanel } from '@/presentation/contracts/panelIds'

export type PaperNavTarget =
  | { kind: 'left_panel'; mode: Exclude<LeftPanelMode, null> }
  | { kind: 'standalone'; panel: Exclude<StandalonePanel, null> }
  | { kind: 'building'; buildingId: string }

const NAV_TARGETS: Record<string, PaperNavTarget> = {
  realm: { kind: 'standalone', panel: 'realm' },
  character: { kind: 'left_panel', mode: 'character' },
  inventory: { kind: 'left_panel', mode: 'inventory' },
  skill: { kind: 'standalone', panel: 'skill' },
  technique: { kind: 'standalone', panel: 'technique' },
  body: { kind: 'standalone', panel: 'body' },
  alchemy: { kind: 'building', buildingId: 'pill_room' },
  equipment: { kind: 'building', buildingId: 'equipment_hall' },
  exploration: { kind: 'building', buildingId: 'teleport_array' },
  quest: { kind: 'standalone', panel: 'quest' },
  settings: { kind: 'left_panel', mode: 'settings' },
}

const NAV_LABEL_KEY: Record<string, string> = {
  realm: 'paperNav.realm',
  character: 'paperNav.character',
  inventory: 'paperNav.inventory',
  skill: 'paperNav.skill',
  technique: 'paperNav.technique',
  body: 'paperNav.body',
  alchemy: 'paperNav.alchemy',
  equipment: 'paperNav.equipment',
  exploration: 'paperNav.exploration',
  quest: 'paperNav.quest',
  settings: 'paperNav.settings',
}

function admitted(target: PaperNavTarget): boolean {
  if (target.kind === 'building') return isBetaBuildingSurface(target.buildingId)
  if (target.kind === 'left_panel') return isBetaLeftPanelMode(target.mode)
  return isBetaStandalonePanel(target.panel)
}

export function usePaperNavigation(ids: readonly string[]) {
  const { t } = useI18n()
  const ui = useUiStore()
  const navigation = useBuildingNavigation()

  const items = computed<readonly PaperNavigationItem[]>(() =>
    ids
      .filter((id) => NAV_TARGETS[id] && admitted(NAV_TARGETS[id]))
      .map((id) => ({ id, label: t(NAV_LABEL_KEY[id] ?? id), icon: symbolUrl(id) })),
  )

  function navigate(id: string): void {
    const target = NAV_TARGETS[id]
    if (!target || !admitted(target)) return
    if (target.kind === 'building') {
      navigation.openBuilding(target.buildingId)
      return
    }
    if (target.kind === 'left_panel') {
      ui.openLeftPanel(target.mode)
      return
    }
    ui.openStandalonePanel(target.panel)
  }

  return { items, navigate }
}
