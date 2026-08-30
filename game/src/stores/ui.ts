import { defineStore } from 'pinia'
import {
  loadPersistedUiAutomationFlags,
  savePersistedUiAutomationFlags,
} from './uiFlagsPersistence'

// "Trang chức năng" chiếm 100% panel trái, chỉ 1 trang hiện tại 1
// thời điểm — 'inventory' còn có thêm khối Equipment cố định 30%
// phía trên (xem LeftPanel.vue). Panel phải KHÔNG còn giữ nội dung
// chức năng nào nên không còn RightPanelMode nữa. 'building' — trang
// riêng 100%, không có khối Equipment (không liên quan trang bị).
//
// Home Hub (beta plan) — 5 mode MỚI thay nội dung 'crafting' cũ (đã
// xoá hẳn cùng CraftingPanel.vue/CraftTabs.vue ở Phase 8, tách theo
// khu vực: equipment_hall=Khí Đường, formation_altar=Trận Đài,
// talisman_institute=Phù Viện, pill_room=Đan Phòng,
// scripture_pavilion=Tàng Kinh Các, hoàn toàn mới). 'character' giữ
// nguyên (Động Phủ, chỉ enhance nội dung).
// Thám Hiểm rework (2026-08-14) — 'building' (Kiến Trúc, panel liệt kê
// phẳng mọi Building) và 'asset_reference' (dev-only, không thuộc nav
// người chơi) bị GỠ KHỎI union này — Kiến Trúc bị thay hoàn toàn bởi
// icon Building đặt trong Home Scene (xem HomeBuildingIcons.vue).
// 'exploration' GIỮ NGUYÊN key (label giờ "Sản Xuất") — đây là hệ Thu
// Thập nguyên liệu tự động cũ, KHÔNG phải Thám Hiểm mới.
// 'stage_select' MỚI — màn hình chọn Địa Giới → Màn → chế độ trước khi
// vào trận (core/stage/Zone.ts), thay cho nút "Chiến Đấu" cũ.
// 'loadout' đã GỠ (2026-08-20) — Kỹ Năng/Tâm Pháp tách khỏi LeftPanel
// thành 2 overlay riêng, xem `standalonePanel` bên dưới thay vì đây.
// (2026-08-25, resource-professions-rework plan §9/§10.1) — bỏ
// 'formation_altar'/'talisman_institute' (Phù/Trận khai tử). 'exploration'
// giữ key, đổi label "Sản Xuất" — render ProductionPanel (Lâm/Quáng/
// Động Thiên).
// Command-wheel plan (2026-08-26) — NavMenuOverlay/DongFuTopBar/
// BottomBar đã xoá: mọi entry chức năng đi qua command wheel
// (DongFuCommandWheel.vue) hoặc hotspot building.
export type LeftPanelMode =
  | 'character'
  | 'inventory'
  | 'exploration'
  | 'settings'
  | 'equipment_hall'
  | 'pill_room'
  | 'spirit_spring'
  | 'scripture_pavilion'
  | 'stage_select'
  | 'vendor'
  | null

// Phù/Trận legacy khai tử — bag chỉ còn 3 tab.
export type BagTab = 'equipment' | 'material' | 'pill'
export type ScripturePavilionTab = 'technique' | 'lore'
// 'passive' đã gỡ (2026-08-20) — 9 ô Passive Cảnh Giới dời sang
// CharacterPanel.vue (useRealmStatPassives.ts).

// Kỹ Năng/Tâm Pháp overlay đứng ĐỘC LẬP với LeftPanel (2026-08-20) —
// SkillPathPanel.vue/TechniquePanel.vue, cùng pattern
// BreakthroughRequirementPanel.vue (overlay toàn màn hình, mount thẳng
// trong GameRoot.vue, KHÔNG qua leftPanelMode). Union riêng (không gộp
// vào LeftPanelMode) vì 2 panel này không thuộc nhóm "trang chức năng
// chiếm 100% panel trái" ở đầu file.
//
// Realm Passive & Pressure System (2026-08-20) — 'realm'
// (RealmPanel.vue, kế thừa RealmPassivePanel.vue đã gỡ — tách khỏi
// CharacterPanel.vue's "Passive Cảnh Giới" cũ + nội dung Nhập Đạo/Kiến
// Cơ MỚI) và 'luyen_the' (LuyenThePanel.vue, 6 tầng rèn thể Phàm
// Nhân) — cùng pattern 2 panel trên. 'quan_khi' (QuanKhiPanel.vue,
// follow-up cùng ngày) — tách
// path-choices ("Bước Vào Pháp Tu/Kiếm Tu") khỏi CharacterPanel.vue,
// mở qua nút "Quán Khí" bên cạnh Đột Phá thay vì liệt kê thẳng.
// 'quest' (QuestPanel.vue, Quest System v1) — panel Nhiệm Vụ độc lập,
// mở qua command wheel giống các panel standalone khác ở trên.
// 'artifact' (ArtifactPanel.vue, Bản Mệnh Pháp Bảo, 2026-08-27) — cùng
// pattern các panel standalone trên, mở qua command wheel khi player
// đạt Trúc Cơ (xem game/support/commandWheelCatalog.ts's slot phap_bao).
export type StandalonePanel =
  'skill' | 'technique' | 'realm' | 'luyen_the' | 'quan_khi' | 'quest' | 'artifact' | null

export type BattleRunMode = 'manual' | 'repeat' | 'progress'

// ================= Sort Hành Trang (plan Workstream E) =================
export type SortDirection = 'asc' | 'desc'

export interface BagSortState<TMode extends string = string> {
  mode: TMode

  direction: SortDirection
}

// Tiêu chí sort RIÊNG từng tab kho.
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
  // Automation flags (battleRunMode) được HYDRATE từ localStorage qua
  // uiFlagsPersistence.ts — người chơi yêu cầu "lưu lại flag của các
  // trạng thái tự động" nên chúng sống qua reload (2026-08-26). Các
  // flag còn lại vẫn transient theo phiên.
  state: () => {
    const automation = loadPersistedUiAutomationFlags()

    return {
    leftPanelMode: null as LeftPanelMode,

    characterOverlayOpen: false,

    // Command wheel (dong-fu-command-wheel plan) — mở/đóng bằng click
    // nhân vật tu luyện giữa Động Phủ; Escape/click vùng trống đóng.
    // Transient theo phiên, KHÔNG lưu save.
    isCommandWheelOpen: false,

    // Shared popover authority (plan Workstream C) — CHỈ MỘT
    // BuildingDetailPopover ở tầng GameRoot, id building đang hiển thị
    // popover. null = đóng. Cả hotspot lẫn command wheel cùng ghi vào
    // đây qua composables/useBuildingNavigation.ts.
    activeBuildingPopoverId: null as string | null,

    activeBagTab: 'material' as BagTab,

    // Sort theo từng tab (plan Workstream E) — chỉ sống trong phiên chơi,
    // KHÔNG ghi vào game save. Đổi mode tự reset direction về 'asc'.
    bagSorts: {
      equipment: { mode: 'default', direction: 'asc' },
      material: { mode: 'default', direction: 'asc' },
      pill: { mode: 'default', direction: 'asc' },
    } as BagSortStateMap,

    // Tàng Kinh Các (Home Hub) — 2 tab con: Công Pháp/Lore.
    scripturePavilionTab: 'technique' as ScripturePavilionTab,

    // Động Phủ quick nav — "Kỹ Năng"/"Tâm Pháp" mở 1 trong 2 overlay
    // ĐỘC LẬP (xem StandalonePanel ở trên), thay cho loadoutTab cũ (2
    // tab của chung 1 LoadoutManager.vue, đã xoá). Transient (KHÔNG lưu
    // save) — cùng nhóm isAuto.
    standalonePanel: null as StandalonePanel,

    // (legacy) pendingEquipTarget giữ để tránh vỡ shape store.
    pendingEquipTarget: null as { kind: 'talisman' | 'formation'; id: string } | null,

    battleRunMode: automation.battleRunMode ?? 'manual',

    // (2026-08-30) isAutoConsumeTinhHoa đã GỠ — Luyện Thể tự đầu tư qua
    // essence stream (App.vue), không còn flag auto.

    // Thám Hiểm rework — Địa Giới + Màn đang chọn để đánh (App.vue's
    // fightStage() đọc 2 field này thay vì hardcode STAGES[0]) + chế
    // độ Auto-refight ứng xử ra sao khi thắng (xem
    // GameManager.getNextStageInZone() — cần selectedZoneId để biết
    // tìm Màn kế tiếp trong ĐÚNG Địa Giới nào).
    // battleRunMode: 2026-08-26 ĐƯỢC LƯU qua localStorage (automation
    // flags); selected* vẫn transient theo phiên chơi hiện tại.
    selectedZoneId: null as string | null,

    selectedStageId: null as string | null,

    // Combat UI Redesign — battle vẫn "sticky" ở state victory/defeat
    // (xem BattleSystem) cho tới khi trận mới ghi đè, nên
    // useCombatSceneActive() cần 1 cờ RIÊNG để biết người chơi đã chủ
    // động rời Combat Scene (bấm "Tiếp Tục"/"Về Động Phủ") hay chưa —
    // false thì Combat Scene vẫn hiện dù battle đã kết thúc, đợi
    // CombatResultModal xử lý (đếm ngược Auto Battle hoặc chờ bấm nút).
    // Reset về false ở useBattleActions.startSelectedStage()/App.vue's
    // fightStage() (mọi điểm bắt đầu trận mới).
    combatSceneDismissed: false,

    // Nguồn gốc trận đang/vừa diễn ra — Stage (qua StageSelectPanel) có
    // CombatResultModal riêng (reward/Đánh Lại/Tiếp Tục theo đúng spec);
    // Tribulation (Đột Phá) đã có luồng thắng/thua RIÊNG từ trước (xem
    // useTribulation.ts's resolveVictory/resolveDefeat + World
    // Announcement) — Combat Scene vẫn hiện chiến trường cho Tribulation
    // nhưng KHÔNG hiện CombatResultModal (tránh hiện 2 lớp kết quả chồng
    // nhau). null = chưa từng có trận nào.
    combatOrigin: null as 'stage' | 'tribulation' | null,
    isTribulationSceneActive: false,
    }
  },

  actions: {
    /**
     * Ghi snapshot automation flags vào localStorage — gọi từ các action
     * đổi flag; mutation TRỰC TIẾP từ panel được bắt bởi $subscribe ở
     * App.vue (cùng hàm save, hai đường vào một đích).
     */
    persistAutomationFlags() {
      savePersistedUiAutomationFlags({
        battleRunMode: this.battleRunMode,
      })
    },

    // Bấm lại chức năng đang mở sẽ đóng, bấm chức năng khác tự thay
    // thế (không cần tự đóng cái cũ thủ công).
    toggleLeft(mode: Exclude<LeftPanelMode, null>) {
      if (mode === 'character' || mode === 'inventory') {
        const shouldClose = this.characterOverlayOpen
        this.closeHomeOverlays()
        this.characterOverlayOpen = !shouldClose
        if (this.characterOverlayOpen) this.activeBagTab = 'equipment'
        return
      }
      const shouldClose = this.leftPanelMode === mode

      this.closeHomeOverlays()

      if (!shouldClose) {
        this.leftPanelMode = mode
      }
    },

    openLeftPanel(mode: Exclude<LeftPanelMode, null>) {
      if (mode === 'character' || mode === 'inventory') {
        this.closeHomeOverlays()
        this.characterOverlayOpen = true
        this.activeBagTab = 'equipment'
        return
      }
      this.closeHomeOverlays()

      this.leftPanelMode = mode
    },

    openStandalonePanel(panel: Exclude<StandalonePanel, null>) {
      this.closeHomeOverlays()

      this.standalonePanel = panel
    },

    /** Đóng toàn bộ chrome/overlay của Động Phủ khi click nền chính. */
    closeHomeOverlays() {
      this.leftPanelMode = null
      this.characterOverlayOpen = false
      this.standalonePanel = null
      this.activeBuildingPopoverId = null
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

    openBuildingPopover(buildingId: string) {
      this.closeHomeOverlays()

      this.activeBuildingPopoverId = buildingId
    },

    closeBuildingPopover() {
      this.activeBuildingPopoverId = null
    },

    setActiveBagTab(tab: BagTab) {
      this.activeBagTab = tab
    },

    // Đổi tiêu chí sort của một tab — direction reset về 'asc' và UI
    // section tự gọi resetPage() (watch trên bagSorts) quay về trang đầu.
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

    // Action "Mặc định" — trả lại original order.
    resetBagSort(tab: BagTab) {
      const sort = this.bagSorts[tab] as BagSortState

      sort.mode = 'default'

      sort.direction = 'asc'
    },

    setScripturePavilionTab(tab: ScripturePavilionTab) {
      this.scripturePavilionTab = tab
    },

    // Cùng pattern toggleLeft() — bấm lại panel đang mở sẽ đóng, bấm
    // panel khác tự thay thế (Kỹ Năng/Tâm Pháp loại trừ lẫn nhau, không
    // mở đồng thời).
    toggleStandalonePanel(panel: Exclude<StandalonePanel, null>) {
      this.standalonePanel = this.standalonePanel === panel ? null : panel
    },

    setBattleRunMode(mode: BattleRunMode) {
      this.battleRunMode = mode

      this.persistAutomationFlags()
    },

    // Combat UI Redesign — gọi bởi CombatVictoryPanel's "Tiếp Tục" (khi
    // !isAuto) và CombatDefeatPanel's "Về Động Phủ" — CombatScene.ts
    // lắng nghe cùng lúc trên eventBus ('combat_scene_exit') để tự
    // this.scene.start('MainScene'), xem CombatResultModal.vue.
    exitCombatScene() {
      this.combatSceneDismissed = true
    },

    enterCombatScene(origin: 'stage' | 'tribulation') {
      this.combatSceneDismissed = false
      this.combatOrigin = origin
    },
    enterTribulationScene() {
      this.isTribulationSceneActive = true
    },
    exitTribulationScene() {
      this.isTribulationSceneActive = false
    },
  },
})
