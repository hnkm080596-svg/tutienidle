import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import {
  isBetaLeftPanelMode,
  isBetaStandalonePanel,
} from '@/core/betaScopeSurface'
import type { StandalonePanel } from '@/presentation/contracts/panelIds'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'

/**
 * Cross-scene navigation contract for ImperialScrollScene's nav rail.
 *
 * The rail lists the canonical Huyen Kim functional scenes (layout spec
 * nav-rail: "only real panel ids; hidden panels render nothing"). Each
 * entry resolves to the existing presentation authority - left-panel
 * modes, the character/inventory home overlay, or a standalone panel -
 * never to a new store field.
 */

export type ImperialSceneId =
  | 'character'
  | 'realm'
  | 'technique'
  | 'skill'
  | 'body'
  | 'inventory'
  | 'exploration'
  | 'alchemy'
  | 'equipment'
  | 'quest'
  | 'settings'

interface ImperialSceneDef {
  id: ImperialSceneId
  symbol: StableSymbolId
  labelKey: string
  open: (ui: ReturnType<typeof useUiStore>) => void
  isOpen: (ui: ReturnType<typeof useUiStore>) => boolean
}

const STANDALONE = (panel: Exclude<StandalonePanel, null>) => ({
  open: (ui: ReturnType<typeof useUiStore>) => ui.openStandalonePanel(panel),
  isOpen: (ui: ReturnType<typeof useUiStore>) => ui.standalonePanel === panel,
})

const LEFT_PANEL = (mode: 'exploration' | 'settings' | 'equipment_hall' | 'pill_room' | 'stage_select') => ({
  open: (ui: ReturnType<typeof useUiStore>) => ui.openLeftPanel(mode),
  isOpen: (ui: ReturnType<typeof useUiStore>) => ui.leftPanelMode === mode,
})

const HOME_OVERLAY = (tab: 'character' | 'inventory') => ({
  open: (ui: ReturnType<typeof useUiStore>) => ui.openLeftPanel(tab),
  isOpen: (ui: ReturnType<typeof useUiStore>) =>
    ui.characterOverlayOpen && ui.characterSceneTab === tab,
})

// Scene order follows the layout spec scene ids (04..18).
const IMPERIAL_SCENES: readonly ImperialSceneDef[] = [
  { id: 'character', symbol: 'character', labelKey: 'panels.wheel.slots.character', ...HOME_OVERLAY('character') },
  { id: 'realm', symbol: 'realm', labelKey: 'panels.realm.title', ...STANDALONE('realm') },
  { id: 'technique', symbol: 'technique', labelKey: 'panels.skillPath.technique.title', ...STANDALONE('technique') },
  { id: 'skill', symbol: 'skill', labelKey: 'panels.wheel.slots.skill', ...STANDALONE('skill') },
  { id: 'body', symbol: 'body', labelKey: 'panels.hkNav.body', ...STANDALONE('body') },
  { id: 'inventory', symbol: 'inventory', labelKey: 'panels.bag.title', ...HOME_OVERLAY('inventory') },
  { id: 'exploration', symbol: 'exploration', labelKey: 'layout.functionOverlay.titles.stage_select', ...LEFT_PANEL('stage_select') },
  { id: 'alchemy', symbol: 'alchemy', labelKey: 'layout.functionOverlay.titles.pill_room', ...LEFT_PANEL('pill_room') },
  { id: 'equipment', symbol: 'equipment', labelKey: 'layout.functionOverlay.titles.equipment_hall', ...LEFT_PANEL('equipment_hall') },
  { id: 'quest', symbol: 'quest', labelKey: 'panels.quest.title', ...STANDALONE('quest') },
  { id: 'settings', symbol: 'settings', labelKey: 'panels.wheel.slots.settings', ...LEFT_PANEL('settings') },
]

const PANEL_OF: Record<ImperialSceneId, string> = {
  character: 'character',
  realm: 'realm',
  technique: 'technique',
  skill: 'skill',
  body: 'body',
  inventory: 'inventory',
  exploration: 'stage_select',
  alchemy: 'pill_room',
  equipment: 'equipment_hall',
  quest: 'quest',
  settings: 'settings',
}

function sceneAdmitted(id: ImperialSceneId): boolean {
  const panel = PANEL_OF[id]
  if (id === 'character' || id === 'inventory' ||
      id === 'exploration' || id === 'alchemy' ||
      id === 'equipment' || id === 'settings') {
    return isBetaLeftPanelMode(panel)
  }
  return isBetaStandalonePanel(panel)
}

export function useImperialNav() {
  const ui = useUiStore()

  const items = computed(() =>
    IMPERIAL_SCENES.filter((scene) => sceneAdmitted(scene.id)).map((scene) => ({
      id: scene.id,
      symbol: scene.symbol,
      labelKey: scene.labelKey,
      active: scene.isOpen(ui),
    })),
  )

  /** Active scene re-click closes; otherwise swap to the target scene. */
  function navigate(id: ImperialSceneId): void {
    const scene = IMPERIAL_SCENES.find((s) => s.id === id)
    if (!scene || !sceneAdmitted(id)) return
    if (scene.isOpen(ui)) {
      ui.closeHomeOverlays()
      return
    }
    scene.open(ui)
  }

  return { items, navigate }
}
