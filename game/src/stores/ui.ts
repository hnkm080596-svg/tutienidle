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
// phia tren (xem LeftPanel.vue). Panel phai KHONG con giu noi dung
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
// icon Building dat trong Home Scene (xem scenes/dong-fu/hotspots/DongFuBuildingHotspots.vue).
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
// Command-wheel plan (2026-08-26) - NavMenuOverlay/DongFuTopBar/
// BottomBar da xoa: moi entry chuc nang di qua command wheel
// (DongFuCommandWheel.vue) hoac hotspot building.
// Declared in `presentation/contracts/panelIds.ts` and re-exported here, so
// that `src/game/` can name a panel without importing a Pinia store (V2/sec3.2).
// Every existing `from '@/stores/ui'` import keeps working.
export type { LeftPanelMode, StandalonePanel } from '@/presentation/contracts/panelIds'
import type { LeftPanelMode, StandalonePanel } from '@/presentation/contracts/panelIds'

// Phu/Tran legacy khai tu - bag chi con 3 tab.
export type BagTab = 'equipment' | 'material' | 'pill'
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
}

export const useUiStore = defineStore('ui', {
  // Automation flags (battleRunMode) duoc HYDRATE tu localStorage qua
  // uiFlagsPersistence.ts - nguoi choi yeu cau "luu lai flag cua cac
  // trang thai tu dong" nen chung song qua reload (2026-08-26). Cac
  // flag con lai van transient theo phien.
  state: () => {
    const automation = loadPersistedUiAutomationFlags()

    return {
    leftPanelMode: null as LeftPanelMode,

    characterOverlayOpen: false,

    // Which imperial scroll the home overlay currently shows:
    // 'character' (scene 04) or 'inventory' (scene 09). The boolean above
    // keeps governing whether the overlay is open at all.
    characterSceneTab: 'character' as 'character' | 'inventory',

    // Command wheel (dong-fu-command-wheel plan) - mo/dong bang click
    // nhan vat tu luyen giua Dong Phu; Escape/click vung trong dong.
    // Transient theo phien, KHONG luu save.
    isCommandWheelOpen: false,

    activeBagTab: 'material' as BagTab,

    // Sort theo tung tab (plan Workstream E) - chi song trong phien choi,
    // KHONG ghi vao game save. Doi mode tu reset direction ve 'asc'.
    bagSorts: {
      equipment: { mode: 'default', direction: 'asc' },
      material: { mode: 'default', direction: 'asc' },
      pill: { mode: 'default', direction: 'asc' },
    } as BagSortStateMap,

    // Dong Phu quick nav - command wheel entries mo cac overlay DOC
    // LAP (xem StandalonePanel o tren), thay cho loadoutTab cu (2 tab
    // cua chung 1 LoadoutManager.vue, da xoa). Transient (KHONG luu
    // save) - cung nhom isAuto.
    standalonePanel: null as StandalonePanel,


    battleRunMode: automation.battleRunMode ?? 'manual',

    // Slice 7 - combat input mode, persist cung nhom automation flags.
    combatInputMode: automation.combatInputMode ?? 'auto',

    // (2026-08-30) isAutoConsumeTinhHoa da GO - Luyen The tu dau tu qua
    // essence stream (App.vue), khong con flag auto.

    // Tham Hiem rework - Dia Gioi + Man dang chon de danh (App.vue's
    // fightStage() doc 2 field nay thay vi hardcode STAGES[0]) + che
    // do Auto-refight ung xu ra sao khi thang (xem
    // GameManager.getNextStageInZone() - can selectedZoneId de biet
    // tim Man ke tiep trong DUNG Dia Gioi nao).
    // battleRunMode: 2026-08-26 DUOC LUU qua localStorage (automation
    // flags); selected* van transient theo phien choi hien tai.
    selectedZoneId: null as string | null,

    selectedStageId: null as string | null,

    // Nguon goc tran dang/vua dien ra - Stage (qua StageSelectPanel) co
    // CombatResultModal rieng (reward/Danh Lai/Tiep Tuc theo dung spec);
    // Tribulation (Dot Pha) da co luong thang/thua RIENG tu truoc (xem
    // useTribulation.ts's resolveVictory/resolveDefeat + World
    // Announcement) - Combat Scene van hien chien truong cho Tribulation
    // nhung KHONG hien CombatResultModal (tranh hien 2 lop ket qua chong
    // nhau). null = chua tung co tran nao.
    combatOrigin: null as 'stage' | 'tribulation' | null,
    }
  },

  actions: {
    /**
     * Ghi snapshot automation flags vao localStorage - goi tu cac action
     * doi flag; mutation TRUC TIEP tu panel duoc bat boi $subscribe o
     * App.vue (cung ham save, hai duong vao mot dich).
     */
    persistAutomationFlags() {
      savePersistedUiAutomationFlags({
        battleRunMode: this.battleRunMode,
        combatInputMode: this.combatInputMode,
      })
    },

    // Bam lai chuc nang dang mo se dong, bam chuc nang khac tu thay
    // the (khong can tu dong cai cu thu cong).
    toggleLeft(mode: Exclude<LeftPanelMode, null>) {
      // BETA SCOPE LOCK v2 (Phase-6): a scope-hidden mode (worker_lodge)
      // toggles nothing - deep links fail closed.
      if (!isBetaLeftPanelMode(mode)) {
        return
      }

      if (mode === 'character' || mode === 'inventory') {
        const shouldClose =
          this.characterOverlayOpen && this.characterSceneTab === mode
        this.closeHomeOverlays()
        this.characterOverlayOpen = !shouldClose
        if (this.characterOverlayOpen) {
          this.characterSceneTab = mode
          this.activeBagTab = 'equipment'
        }
        return
      }
      const shouldClose = this.leftPanelMode === mode

      this.closeHomeOverlays()

      if (!shouldClose) {
        this.leftPanelMode = mode
      }
    },

    openLeftPanel(mode: Exclude<LeftPanelMode, null>) {
      // BETA SCOPE LOCK v2 (Phase-6): scope-hidden mode no-ops.
      if (!isBetaLeftPanelMode(mode)) {
        return
      }

      if (mode === 'character' || mode === 'inventory') {
        this.closeHomeOverlays()
        this.characterOverlayOpen = true
        this.characterSceneTab = mode
        this.activeBagTab = 'equipment'
        return
      }
      this.closeHomeOverlays()

      this.leftPanelMode = mode
    },

    openStandalonePanel(panel: Exclude<StandalonePanel, null>) {
      // BETA SCOPE LOCK v2 (Phase-6): scope-hidden panels
      // (artifact / tran_phap / companion) fail closed - no caller can
      // open them through this seam.
      if (!isBetaStandalonePanel(panel)) {
        return
      }

      this.closeHomeOverlays()

      this.standalonePanel = panel
    },

    /** Dong toan bo chrome/overlay cua Dong Phu khi click nen chinh. */
    closeHomeOverlays() {
      this.leftPanelMode = null
      this.characterOverlayOpen = false
      this.standalonePanel = null
      this.isCommandWheelOpen = false
    },

    toggleCommandWheel() {
      if (this.isCommandWheelOpen) {
        this.isCommandWheelOpen = false

        return
      }

      this.closeHomeOverlays()
      this.isCommandWheelOpen = true
    },

    closeCommandWheel() {
      this.isCommandWheelOpen = false
    },

    setActiveBagTab(tab: BagTab) {
      this.activeBagTab = tab
    },

    // Doi tieu chi sort cua mot tab - direction reset ve 'asc' va UI
    // section tu goi resetPage() (watch tren bagSorts) quay ve trang dau.
    setBagSortMode<K extends keyof BagSortStateMap>(
      tab: K,

      mode: BagSortStateMap[K]['mode'],
    ) {
      const sort = this.bagSorts[tab] as BagSortState

      if (sort.mode === mode) {
        return
      }

      sort.mode = mode

      sort.direction = 'asc'
    },

    toggleBagSortDirection(tab: BagTab) {
      const sort = this.bagSorts[tab] as BagSortState

      sort.direction = sort.direction === 'asc' ? 'desc' : 'asc'
    },

    // Action "Mac dinh" - tra lai original order.
    resetBagSort(tab: BagTab) {
      const sort = this.bagSorts[tab] as BagSortState

      sort.mode = 'default'

      sort.direction = 'asc'
    },

    // Cung pattern toggleLeft() - bam lai panel dang mo se dong, bam
    // panel khac tu thay the (Ky Nang/Tam Phap loai tru lan nhau, khong
    // mo dong thoi).
    toggleStandalonePanel(panel: Exclude<StandalonePanel, null>) {
      // BETA SCOPE LOCK v2 (Phase-6): a scope-hidden panel can only
      // close (never open).
      if (!isBetaStandalonePanel(panel)) {
        if (this.standalonePanel === panel) {
          this.standalonePanel = null
        }
        return
      }

      this.standalonePanel = this.standalonePanel === panel ? null : panel
    },

    setBattleRunMode(mode: BattleRunMode) {
      this.battleRunMode = mode

      this.persistAutomationFlags()
    },

    setCombatInputMode(mode: CombatInputMode) {
      this.combatInputMode = mode

      this.persistAutomationFlags()
    },

    // Records which domain flow produced the current combat - read by
    // CombatResultModal/CombatExitConfirmModal to gate stage-only result
    // UI. Scene visibility itself is owned by the coordinator route
    // (useCombatSceneActive/useStageActive) - the old dismissed/active
    // flags were removed with the R12 cleanup.
    enterCombatScene(origin: 'stage' | 'tribulation') {
      this.combatOrigin = origin
    },
  },
})
