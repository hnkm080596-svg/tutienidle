import { defineStore } from 'pinia'

// "Trang chức năng" chiếm 100% panel trái, chỉ 1 trang hiện tại 1
// thời điểm — 'inventory' còn có thêm khối Equipment cố định 30%
// phía trên (xem LeftPanel.vue). Panel phải KHÔNG còn giữ nội dung
// chức năng nào (xem RightPanel.vue/NavMenuOverlay.vue) nên không còn
// RightPanelMode nữa. 'building' — trang riêng 100%, không có khối
// Equipment (không liên quan trang bị).
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
// icon Building đặt trong Home Scene (xem HomeBuildingIcons.vue),
// Asset Reference không còn xuất hiện trong NavMenuOverlay.vue nữa
// (component vẫn còn, chỉ không route được qua panel trái). 'exploration'
// GIỮ NGUYÊN key (chỉ đổi label hiển thị "Tầm Bảo", xem NavMenuOverlay.vue)
// — đây là hệ Thu Thập nguyên liệu tự động cũ, KHÔNG phải Thám Hiểm mới.
// 'stage_select' MỚI — màn hình chọn Địa Giới → Màn → chế độ trước khi
// vào trận (core/stage/Zone.ts), thay cho nút "Chiến Đấu" cũ.
// 'loadout' đã GỠ (2026-08-20) — Kỹ Năng/Tâm Pháp tách khỏi LeftPanel
// thành 2 overlay riêng, xem `standalonePanel` bên dưới thay vì đây.
export type LeftPanelMode =
  | 'character' | 'inventory' | 'exploration' | 'settings'
  | 'equipment_hall' | 'formation_altar' | 'talisman_institute' | 'pill_room' | 'scripture_pavilion'
  | 'stage_select'
  | null

export type BagTab = 'equipment' | 'material' | 'pill' | 'talisman' | 'formation'
export type ScripturePavilionTab = 'technique' | 'lore'
// 'passive' đã gỡ (2026-08-20) — 9 ô Passive Cảnh Giới dời sang
// CharacterPanel.vue, xem composables/usePassiveRows.ts.

// Kỹ Năng/Tâm Pháp overlay đứng ĐỘC LẬP với LeftPanel (2026-08-20) —
// SkillPathPanel.vue/TechniquePanel.vue, cùng pattern
// BreakthroughRequirementPanel.vue (overlay toàn màn hình, mount thẳng
// trong GameRoot.vue, KHÔNG qua leftPanelMode). Union riêng (không gộp
// vào LeftPanelMode) vì 2 panel này không thuộc nhóm "trang chức năng
// chiếm 100% panel trái" ở đầu file.
//
// Realm Passive & Pressure System (2026-08-20) — 'realm_passive'
// (RealmPassivePanel.vue, tách khỏi CharacterPanel.vue's "Passive Cảnh
// Giới" cũ + nội dung Nhập Đạo/Kiến Cơ MỚI) và 'luyen_the'
// (LuyenThePanel.vue, 6 tầng rèn thể Phàm Nhân) — cùng pattern 2 panel
// trên. 'quan_khi' (QuanKhiPanel.vue, follow-up cùng ngày) — tách
// path-choices ("Bước Vào Pháp Tu/Kiếm Tu") khỏi CharacterPanel.vue,
// mở qua nút "Quán Khí" bên cạnh Đột Phá thay vì liệt kê thẳng.
export type StandalonePanel = 'skill' | 'technique' | 'realm_passive' | 'luyen_the' | 'quan_khi' | null

export type BattleRunMode = 'manual' | 'repeat' | 'progress'

export const useUiStore = defineStore('ui', {
  state: () => ({
    leftPanelMode: null as LeftPanelMode,

    // Bảng navigation toàn màn hình (NavMenuOverlay.vue) — mở qua nút
    // "Menu" ở panel phải hoặc phím tắt Tab (xem App.vue).
    isNavMenuOpen: false,

    activeBagTab: 'material' as BagTab,

    // Tàng Kinh Các (Home Hub) — 2 tab con: Công Pháp/Lore.
    scripturePavilionTab: 'technique' as ScripturePavilionTab,

    // Động Phủ quick nav — "Kỹ Năng"/"Tâm Pháp" mở 1 trong 2 overlay
    // ĐỘC LẬP (xem StandalonePanel ở trên), thay cho loadoutTab cũ (2
    // tab của chung 1 LoadoutManager.vue, đã xoá). Transient (KHÔNG lưu
    // save) — cùng nhóm isPaused/isAuto.
    standalonePanel: null as StandalonePanel,

    // Home Hub — Trận Đài/Phù Viện cần chọn 1 trang bị làm đích
    // nhưng equipment giờ nằm ở panel KHÁC (Kho — 'inventory', tab
    // Trang Bị), không còn là tab-flip trong cùng 1 panel như
    // BagGrid.vue cũ (đó vẫn dùng ref cục bộ, xem BagGrid.vue) — set
    // field này rồi đổi leftPanelMode='inventory' để điều hướng
    // liên-panel. UI redesign Step 9 (2026-08-20) — trước đó trỏ vào
    // 'equipment_hall' (Khí Đường), đã dời sang đây khi Khí Đường thu
    // gọn về thuần Luyện Khí (bỏ hẳn bag equip, xem
    // EquipmentHallPanel.vue).
    pendingEquipTarget: null as { kind: 'talisman' | 'formation'; id: string } | null,

    isPaused: false,

    battleRunMode: 'manual' as BattleRunMode,

    // Auto Đột Phá tiểu cảnh giới (2026-08-20) — tick user tự bấm, App.vue's
    // tick() tự gọi breakthrough() thay người chơi mỗi khi tu vi đủ (xem
    // useBreakthrough.ts). CHỈ áp dụng tiểu cảnh giới (tầng trong cùng đại
    // cảnh giới) — Trúc Cơ/Đột Phá đại cảnh giới vẫn cần bấm tay (yêu cầu
    // vật phẩm + xác nhận Độ Kiếp, không phù hợp tự động). Transient (KHÔNG
    // lưu save) — cùng nhóm isPaused/isAuto.
    isAutoBreakthrough: false,

    // Tự tiêu Tinh Hoa Phàm Thể vừa nhặt vào tầng Luyện Thể đang mở.
    // Transient theo phiên, giống các toggle auto khác.
    isAutoConsumeTinhHoa: false,

    // Thám Hiểm rework — Địa Giới + Màn đang chọn để đánh (App.vue's
    // fightStage() đọc 2 field này thay vì hardcode STAGES[0]) + chế
    // độ Auto-refight ứng xử ra sao khi thắng (xem
    // GameManager.getNextStageInZone() — cần selectedZoneId để biết
    // tìm Màn kế tiếp trong ĐÚNG Địa Giới nào). Transient (KHÔNG lưu
    // save) — cùng nhóm isPaused/isAuto, chỉ có ý nghĩa trong phiên
    // chơi hiện tại.
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
  }),

  actions: {
    // Bấm lại chức năng đang mở sẽ đóng, bấm chức năng khác tự thay
    // thế (không cần tự đóng cái cũ thủ công).
    toggleLeft(mode: Exclude<LeftPanelMode, null>) {
      this.leftPanelMode = this.leftPanelMode === mode ? null : mode
    },

    toggleNavMenu() {
      this.isNavMenuOpen = !this.isNavMenuOpen
    },

    setActiveBagTab(tab: BagTab) {
      this.activeBagTab = tab
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

    togglePause() {
      this.isPaused = !this.isPaused
    },

    setPaused(paused: boolean) {
      this.isPaused = paused
    },

    setBattleRunMode(mode: BattleRunMode) {
      this.battleRunMode = mode
    },

    toggleAutoBreakthrough() {
      this.isAutoBreakthrough = !this.isAutoBreakthrough
    },

    toggleAutoConsumeTinhHoa() {
      this.isAutoConsumeTinhHoa = !this.isAutoConsumeTinhHoa
    },

    // Combat UI Redesign — gọi bởi CombatVictoryPanel's "Tiếp Tục" (khi
    // !isAuto) và CombatDefeatPanel's "Về Động Phủ" — CombatScene.ts
    // lắng nghe cùng lúc trên eventBus ('combat_scene_exit') để tự
    // this.scene.start('MainScene'), xem CombatResultModal.vue.
    exitCombatScene() {
      this.combatSceneDismissed = true
      this.isPaused = false
    },

    enterCombatScene(origin: 'stage' | 'tribulation') {
      this.isPaused = false
      this.combatSceneDismissed = false
      this.combatOrigin = origin
    },
    enterTribulationScene() {
      // Scene Độ Kiếp không có nút Play/Pause. Không cho một flag pause cũ
      // từ trận Stage khiến kiếp nạn bị đóng băng vĩnh viễn.
      this.isPaused = false
      this.isTribulationSceneActive = true
    },
    exitTribulationScene() {
      this.isPaused = false
      this.isTribulationSceneActive = false
    },
  },
})
