import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  loadPersistedUiAutomationFlags,
  savePersistedUiAutomationFlags,
} from './uiFlagsPersistence'
import {
  isBetaLeftPanelMode,
  isBetaStandalonePanel,
} from '@/core/betaScopeSurface'

// "Trang chuc nang" chiem 100% panel trai, chi 1 trang hien tai 1
// thoi diem - 'inventory' con co them khoi Equipment co dinh 30%
// phia tren. Panel phai KHONG con giu noi dung
// chuc nang nao nen khong con RightPanelMode nua. 'building' - trang
// rieng 100%, khong co khoi Equipment (khong lien quan trang bi).
//
// Home Hub (beta plan) - 5 mode MOI thay noi dung 'crafting' cu (da
// xoa han cung CraftingPanel.vue/CraftTabs.vue o Phase 8, tach theo
// khu vuc: equipment_hall=Khi Duong, formation_altar=Tran Dai,
// talisman_institute=Phu Vien, pill_room=Dan Phong,
// scripture_pavilion=Tang Kinh Cac, hoan toan moi). 'character' giu
// nguyen (Dong Phu, chi enhance noi dung).
// Tham Hiem rework (2026-08-14) - 'building' (Kien Truc, panel liet ke
// phang moi Building) va 'asset_reference' (dev-only, khong thuoc nav
// nguoi choi) bi GO KHOI union nay - Kien Truc bi thay hoan toan boi
// icon Building dat trong Home Scene (xem scenes/dong-fu/DongFuStage.vue).
// 'exploration' GIU NGUYEN key (label gio "San Xuat") - day la he Thu
// Thap nguyen lieu tu dong cu, KHONG phai Tham Hiem moi.
// 'stage_select' MOI - man hinh chon Dia Gioi -> Man -> che do truoc khi
// vao tran (core/stage/Zone.ts), thay cho nut "Chien Dau" cu.
// 'loadout' da GO (2026-08-20) - Ky Nang/Tam Phap tach khoi LeftPanel
// thanh 2 overlay rieng, xem `standalonePanel` ben duoi thay vi day.
// (2026-08-25, resource-professions-rework plan sec9/sec10.1) - bo
// 'formation_altar'/'talisman_institute' (Phu/Tran khai tu). 'exploration'
// giu key, doi label "San Xuat" - render ProductionPanel (Lam/Quang/
// Dong Thien).
// Command-wheel plan (2026-08-26) - NavMenuOverlay/TopBar/
// BottomBar da xoa: moi entry chuc nang di qua command wheel
// (slot wheel trong scenes/dong-fu/DongFuStage.vue) hoac plaque building.
// Declared in `presentation/contracts/panelIds.ts` and re-exported here, so
// that `src/game/` can name a panel without importing a Pinia store (V2/sec3.2).
// Every existing `from '@/stores/ui'` import keeps working.
export type {
  HomeSurfaceId,
  LeftPanelMode,
  StandalonePanel,
} from '@/presentation/contracts/panelIds'
import type {
  HomeSurfaceId,
  LeftPanelMode,
  StandalonePanel,
} from '@/presentation/contracts/panelIds'

// Phu/Tran legacy khai tu - bag chi con 3 tab. Owner ruling 2026-10-08:
// 'decompose' joins Kho Vat (Phan Giai ore-decompose moved out of the
// Khi Duong rail).
export type BagTab = 'equipment' | 'material' | 'pill' | 'decompose'
// 'passive' da go (2026-08-20) - 9 o Passive Canh Gioi doi sang
// RealmPanel.vue (useRealmStatPassives.ts).

// Ky Nang overlay dung DOC LAP voi LeftPanel (2026-08-20) -
// SkillPathPanel.vue, cung pattern BreakthroughRequirementPanel.vue
// (overlay toan man hinh, mount thang trong GameRoot.vue, KHONG qua
// leftPanelMode). Union rieng (khong gop vao LeftPanelMode) vi panel
// nay khong thuoc nhom "trang chuc nang chiem 100% panel trai" o dau
// file. Huyen Kim P6 - 'technique' lai mo thanh standalone
// (TechniquePanel.vue) cung 'body' (BodyPanel.vue); canonical
// technique surface da roi SkillPathPanel sang scene rieng.
//
// Realm Passive & Pressure System (2026-08-20) - 'realm'
// (RealmPanel.vue, ke thua RealmPassivePanel.vue da go - tach khoi
// CharacterPanel.vue's "Passive Canh Gioi" cu + noi dung Nhap Dao/Kien
// Co MOI) - cung pattern panel tren. 'quan_khi' (QuanKhiPanel.vue,
// follow-up cung ngay) - tach
// path-choices ("Buoc Vao Phap Tu/Kiem Tu") khoi CharacterPanel.vue,
// mo qua nut "Quan Khi" ben canh Dot Pha thay vi liet ke thang.
// 'quest' (QuestPanel.vue, Quest System v1) - panel Nhiem Vu doc lap,
// mo qua command wheel giong cac panel standalone khac o tren.
// 'artifact' (ArtifactPanel.vue, Ban Menh Phap Bao, 2026-08-27) - cung
// pattern cac panel standalone tren, mo qua command wheel khi player
// dat Truc Co (xem game/support/commandWheelCatalog.ts's slot phap_bao).
// 'tran_phap' (TranPhapPanel.vue, Tran Phap - Combat Art Roster spec,
// 2026-09-05) - panel keo-tha gan companion/player vao luoi 6x6 cuc bo
// cua tran phap dang chon, mo qua command wheel slot formation_slot.

export type BattleRunMode = 'manual' | 'repeat' | 'progress' | 'perfect_farm'

/**
 * Slice 7 (2026-09-04) - che do input giua tran: 'auto' = engine khong
 * bao gio pause (auto-priority nhu thuong); 'manual' = pause khi toi
 * luot player cho chon skill qua 3 nut. Truc RIENG khoi `BattleRunMode`
 * (flag do governs hanh vi ranh gioi stage: auto-refight/auto-progress -
 * KHONG tai su dung y nghia chuoi 'manual' giua 2 flag).
 */
export type CombatInputMode = 'manual' | 'auto'

// ================= Sort Hanh Trang (plan Workstream E) =================
export type SortDirection = 'asc' | 'desc'

export interface BagSortState<TMode extends string = string> {
  mode: TMode

  direction: SortDirection
}

// Tieu chi sort RIENG tung tab kho.
export type EquipmentSortMode =
  'default' | 'quality' | 'rarity' | 'realm' | 'slot' | 'name' | 'forge'

export type MaterialSortMode =
  'default' | 'category' | 'years' | 'amount' | 'name' | 'source'

export type PillSortMode =
  'default' | 'grade' | 'effect' | 'amount' | 'name'

export interface BagSortStateMap {
  equipment: BagSortState<EquipmentSortMode>

  material: BagSortState<MaterialSortMode>

  pill: BagSortState<PillSortMode>

  // The embedded dissolve equipment grid owns its independent sort.
  dissolve: BagSortState<EquipmentSortMode>

  // Phan Giai lists ore/material stacks - material modes apply (no
  // sort UI calls this today; the key exists because BagTab includes it).
  decompose: BagSortState<MaterialSortMode>
}

const STANDALONE_PANELS: ReadonlySet<string> = new Set<Exclude<StandalonePanel, null>>([
  'skill',
  'realm',
  'quan_khi',
  'quest',
  'artifact',
  'tran_phap',
  'companion',
  'technique',
  'body',
])

function isFunctionLeftPanelSurface(surface: HomeSurfaceId | null): surface is Exclude<LeftPanelMode, 'character' | 'inventory' | null> {
  return (
    surface !== null &&
    !STANDALONE_PANELS.has(surface) &&
    surface !== 'character' &&
    surface !== 'inventory' &&
    surface !== 'feedback'
  )
}

export const useUiStore = defineStore('ui', () => {
  // Automation flags (battleRunMode) duoc HYDRATE tu localStorage qua
  // uiFlagsPersistence.ts - nguoi choi yeu cau "luu lai flag cua cac
  // trang thai tu dong" nen chung song qua reload (2026-08-26). Cac
  // flag con lai van transient theo phien.
  const automation = loadPersistedUiAutomationFlags()

  // Slice 3.2 (V1): single authoritative state owner for which overlay
  // surface is open above Dong Phu (`null` when the home vista is uncovered).
  const activeHomeSurface = ref<HomeSurfaceId | null>(null)

  // Remembers which of the two character/inventory scroll tabs was last
  // selected when a caller toggles `characterOverlayOpen = true` directly.
  const lastCharacterSceneTab = ref<'character' | 'inventory'>('character')

  const architectureFocusBuildingId = ref<string | null>(null)

  // Command wheel (dong-fu-command-wheel plan) - mo/dong bang click
  // nhan vat tu luyen giua Dong Phu; Escape/click vung trong dong.
  // Transient theo phien, KHONG luu save.
  const isCommandWheelOpen = ref(false)

  const activeBagTab = ref<BagTab>('material')

  // Sort theo tung tab (plan Workstream E) - chi song trong phien choi,
  // KHONG ghi vao game save. Doi mode tu reset direction ve 'asc'.
  const bagSorts = ref<BagSortStateMap>({
    equipment: { mode: 'default', direction: 'asc' },
    material: { mode: 'default', direction: 'asc' },
    pill: { mode: 'default', direction: 'asc' },
    dissolve: { mode: 'default', direction: 'asc' },
    decompose: { mode: 'default', direction: 'asc' },
  })

  const battleRunMode = ref<BattleRunMode>(automation.battleRunMode ?? 'manual')

  // Slice 7 - combat input mode, persist cung nhom automation flags.
  const combatInputMode = ref<CombatInputMode>(automation.combatInputMode ?? 'auto')

  const selectedZoneId = ref<string | null>(null)
  const selectedStageId = ref<string | null>(null)
  const combatOrigin = ref<'stage' | 'tribulation' | null>(null)

  const hasHomeOverlayOpen = computed(() => activeHomeSurface.value !== null)

  // Writable projections derived strictly from `activeHomeSurface` so existing
  // consumers and tests continue to work while `activeHomeSurface` remains the
  // sole source of truth (mutual exclusion guaranteed by construction).
  const leftPanelMode = computed<LeftPanelMode>({
    get() {
      return isFunctionLeftPanelSurface(activeHomeSurface.value)
        ? activeHomeSurface.value
        : null
    },
    set(mode) {
      if (mode === null) {
        if (isFunctionLeftPanelSurface(activeHomeSurface.value)) {
          activeHomeSurface.value = null
        }
        return
      }
      if (mode === 'character' || mode === 'inventory') {
        lastCharacterSceneTab.value = mode
      }
      activeHomeSurface.value = mode
    },
  })

  const standalonePanel = computed<StandalonePanel>({
    get() {
      const surface = activeHomeSurface.value
      return surface !== null && STANDALONE_PANELS.has(surface)
        ? (surface as StandalonePanel)
        : null
    },
    set(panel) {
      if (panel === null) {
        if (activeHomeSurface.value !== null && STANDALONE_PANELS.has(activeHomeSurface.value)) {
          activeHomeSurface.value = null
        }
        return
      }
      activeHomeSurface.value = panel
    },
  })

  const characterOverlayOpen = computed<boolean>({
    get() {
      return activeHomeSurface.value === 'character' || activeHomeSurface.value === 'inventory'
    },
    set(open) {
      if (open) {
        if (activeHomeSurface.value !== 'character' && activeHomeSurface.value !== 'inventory') {
          activeHomeSurface.value = lastCharacterSceneTab.value
        }
        return
      }
      if (activeHomeSurface.value === 'character' || activeHomeSurface.value === 'inventory') {
        activeHomeSurface.value = null
      }
    },
  })

  const characterSceneTab = computed<'character' | 'inventory'>({
    get() {
      return activeHomeSurface.value === 'character' || activeHomeSurface.value === 'inventory'
        ? activeHomeSurface.value
        : lastCharacterSceneTab.value
    },
    set(tab) {
      lastCharacterSceneTab.value = tab
      if (activeHomeSurface.value === 'character' || activeHomeSurface.value === 'inventory') {
        activeHomeSurface.value = tab
      }
    },
  })

  /**
   * Ghi snapshot automation flags vao localStorage - goi tu cac action
   * doi flag; mutation TRUC TIEP tu panel duoc bat boi $subscribe o
   * App.vue (cung ham save, hai duong vao mot dich).
   */
  function persistAutomationFlags() {
    savePersistedUiAutomationFlags({
      battleRunMode: battleRunMode.value,
      combatInputMode: combatInputMode.value,
    })
  }

  /** Dong toan bo chrome/overlay cua Dong Phu khi click nen chinh. */
  function closeHomeOverlays() {
    activeHomeSurface.value = null
    architectureFocusBuildingId.value = null
    isCommandWheelOpen.value = false
  }

  function openLeftPanel(mode: Exclude<LeftPanelMode, null>) {
    // BETA SCOPE LOCK v2 (Phase-6): scope-hidden mode no-ops.
    if (!isBetaLeftPanelMode(mode)) {
      return
    }

    closeHomeOverlays()
    if (mode === 'character' || mode === 'inventory') {
      lastCharacterSceneTab.value = mode
      activeBagTab.value = 'material'
    }
    activeHomeSurface.value = mode
  }

  function openArchitecture(focusBuildingId: string | null = null) {
    closeHomeOverlays()
    architectureFocusBuildingId.value = focusBuildingId
    activeHomeSurface.value = 'architecture'
  }

  function openStandalonePanel(panel: Exclude<StandalonePanel, null>) {
    // BETA SCOPE LOCK v2 (Phase-6): scope-hidden panels
    // (artifact / tran_phap / companion) fail closed - no caller can
    // open them through this seam.
    if (!isBetaStandalonePanel(panel)) {
      return
    }

    closeHomeOverlays()
    activeHomeSurface.value = panel
  }

  function openHomeSurface(surface: HomeSurfaceId) {
    if (surface === 'feedback') {
      closeHomeOverlays()
      activeHomeSurface.value = 'feedback'
      return
    }
    if (STANDALONE_PANELS.has(surface)) {
      openStandalonePanel(surface as Exclude<StandalonePanel, null>)
      return
    }
    openLeftPanel(surface as Exclude<LeftPanelMode, null>)
  }

  function toggleCommandWheel() {
    if (isCommandWheelOpen.value) {
      isCommandWheelOpen.value = false
      return
    }

    closeHomeOverlays()
    isCommandWheelOpen.value = true
  }

  function closeCommandWheel() {
    isCommandWheelOpen.value = false
  }

  function setActiveBagTab(tab: BagTab) {
    activeBagTab.value = tab
  }

  // Doi tieu chi sort cua mot tab - direction reset ve 'asc' va UI
  // section tu goi resetPage() (watch tren bagSorts) quay ve trang dau.
  function setBagSortMode<K extends keyof BagSortStateMap>(
    tab: K,
    mode: BagSortStateMap[K]['mode'],
  ) {
    const sort = bagSorts.value[tab] as BagSortState
    if (sort.mode === mode) {
      return
    }
    sort.mode = mode
    sort.direction = 'asc'
  }

  function toggleBagSortDirection(tab: keyof BagSortStateMap) {
    const sort = bagSorts.value[tab] as BagSortState
    sort.direction = sort.direction === 'asc' ? 'desc' : 'asc'
  }

  // Action "Mac dinh" - tra lai original order.
  function resetBagSort(tab: keyof BagSortStateMap) {
    const sort = bagSorts.value[tab] as BagSortState
    sort.mode = 'default'
    sort.direction = 'asc'
  }

  function setBattleRunMode(mode: BattleRunMode) {
    battleRunMode.value = mode
    persistAutomationFlags()
  }

  function setCombatInputMode(mode: CombatInputMode) {
    combatInputMode.value = mode
    persistAutomationFlags()
  }

  // Records which domain flow produced the current combat - read by
  // CombatResultModal/CombatExitConfirmModal to gate stage-only result
  // UI. Scene visibility itself is owned by the coordinator route
  // (useCombatSceneActive/useStageActive) - the old dismissed/active
  // flags were removed with the R12 cleanup.
  function enterCombatScene(origin: 'stage' | 'tribulation') {
    combatOrigin.value = origin
  }

  return {
    activeHomeSurface,
    lastCharacterSceneTab,
    hasHomeOverlayOpen,
    leftPanelMode,
    standalonePanel,
    characterOverlayOpen,
    characterSceneTab,
    architectureFocusBuildingId,
    isCommandWheelOpen,
    activeBagTab,
    bagSorts,
    battleRunMode,
    combatInputMode,
    selectedZoneId,
    selectedStageId,
    combatOrigin,
    persistAutomationFlags,
    openHomeSurface,
    openLeftPanel,
    openArchitecture,
    openStandalonePanel,
    closeHomeOverlays,
    toggleCommandWheel,
    closeCommandWheel,
    setActiveBagTab,
    setBagSortMode,
    toggleBagSortDirection,
    resetBagSort,
    setBattleRunMode,
    setCombatInputMode,
    enterCombatScene,
  }
})

