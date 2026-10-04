// Shared PaperPanelNavigation adapter for the fidelity surfaces AND
// the imperial scroll rail: the canonical nav id list maps to REAL
// production panel targets, filtered through beta admission. Selecting
// an item issues the same store calls the command wheel used - this
// composable owns no state of its own.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import {
  isBetaBuildingSurface,
  isBetaLeftPanelMode,
  isBetaStandalonePanel,
} from '@/core/betaScopeSurface'
import { isBetaTechniqueSurfaceUnlocked } from '@/core/betaScopeTechniqueDomain'
import { symbolUrl } from '@/components/scenes/dong-fu/fidelity/dongFuUi'
import type { PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import type { LeftPanelMode, StandalonePanel } from '@/presentation/contracts/panelIds'

export type PaperNavTarget =
  | { kind: 'left_panel'; mode: Exclude<LeftPanelMode, null> }
  | { kind: 'standalone'; panel: Exclude<StandalonePanel, null> }
  | { kind: 'building'; buildingId: string }

// Canonical cross-scene nav order (layout spec scene ids, character
// first): the one id list every rail renders - paper surfaces and the
// scroll share it so navigation looks and behaves identically.
export const PAPER_NAV_IDS = [
  'character',
  'realm',
  'technique',
  'skill',
  'body',
  'inventory',
  'exploration',
  'alchemy',
  'equipment',
  'quest',
  'settings',
] as const

const NAV_TARGETS: Record<string, PaperNavTarget> = {
  realm: { kind: 'standalone', panel: 'realm' },
  character: { kind: 'left_panel', mode: 'character' },
  inventory: { kind: 'left_panel', mode: 'inventory' },
  skill: { kind: 'standalone', panel: 'skill' },
  technique: { kind: 'standalone', panel: 'technique' },
  body: { kind: 'standalone', panel: 'body' },
  alchemy: { kind: 'building', buildingId: 'pill_room' },
  // The Trang Bi surface is a left-panel surface, not a building-gated
  // surface: routing it through openBuilding() sent players without a lo
  // ren to the build popover and the tab could never open. Building
  // hotspots / command wheel keep openBuilding('equipment_hall').
  equipment: { kind: 'left_panel', mode: 'equipment_hall' },
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

// left_panel modes that carry a nav id different from the mode name
// (building function types map back onto their scene's nav item so the
// rail reflects plaque-opened panels: the forge lands on 'equipment').
const LEFT_PANEL_NAV_ID: Record<string, string> = {
  stage_select: 'exploration',
  pill_room: 'alchemy',
  equipment_hall: 'equipment',
  exploration: 'exploration',
  settings: 'settings',
}

function admitted(target: PaperNavTarget): boolean {
  if (target.kind === 'building') return isBetaBuildingSurface(target.buildingId)
  if (target.kind === 'left_panel') return isBetaLeftPanelMode(target.mode)
  return isBetaStandalonePanel(target.panel)
}

export function usePaperNavigation(ids: readonly string[] = PAPER_NAV_IDS) {
  const { t } = useI18n()
  const ui = useUiStore()
  const player = usePlayerStore()
  const navigation = useBuildingNavigation()

  // Progression locks beyond the beta-scope admission gate: the Tam Phap
  // surface stays sealed until Luyen Khi + a committed pathway
  // (isBetaTechniqueSurfaceUnlocked). Locked items stay on the rail dimmed
  // and navigate() refuses them; the mount seam defends direct writes.
  function progressionLocked(id: string): boolean {
    return id === 'technique' && !isBetaTechniqueSurfaceUnlocked(player.$state)
  }

  const items = computed<readonly PaperNavigationItem[]>(() =>
    ids
      .filter((id) => NAV_TARGETS[id] && admitted(NAV_TARGETS[id]))
      .map((id) => ({
        id,
        label: t(NAV_LABEL_KEY[id] ?? id),
        icon: symbolUrl(id),
        locked: progressionLocked(id) || undefined,
      })),
  )

  // The rail item matching the currently open surface; '' when nothing
  // nav-reachable is open (e.g. the legacy micro-panels).
  const activeId = computed(() => {
    if (ui.characterOverlayOpen) return ui.characterSceneTab
    const mode = ui.leftPanelMode
    if (mode && LEFT_PANEL_NAV_ID[mode]) return LEFT_PANEL_NAV_ID[mode]
    const panel = ui.standalonePanel
    if (panel && NAV_TARGETS[panel]?.kind === 'standalone') return panel
    return ''
  })

  function navigate(id: string): void {
    const target = NAV_TARGETS[id]
    if (!target || !admitted(target) || progressionLocked(id)) return
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

  return { items, navigate, activeId }
}
