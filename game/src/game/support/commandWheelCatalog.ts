// Command wheel catalog (dong-fu-command-wheel-inventory-spirit-stone-
// plan.md Workstream B) — nguồn DUY NHẤT cho các shortcut của wheel
// nhiều tầng. Thuần data: KHÔNG import GameManager/store runtime;
// `available` là closure hằng (future slot → false, không render nút).
// Building ring KHÔNG liệt kê id trùng lặp nơi khác — hotspot layer và
// wheel cùng đọc catalog này (P2 cleanup: catalog là nguồn duy nhất cho
// building id dùng chung trong UI mới).
import type { LeftPanelMode, StandalonePanel } from '@/stores/ui'

export type PanelTarget =
  | { kind: 'left_panel'; mode: Exclude<LeftPanelMode, null> }
  | { kind: 'standalone'; panel: Exclude<StandalonePanel, null> }

export type CommandWheelRing = 1 | 2 | 3 | 4

export interface CommandWheelSlot {
  id: string

  ring: CommandWheelRing

  label: string

  target?: PanelTarget

  /** Ring 3 — mở popover xây/nâng cấp hoặc panel chức năng qua controller. */
  buildingId?: string

  /** false = future slot, KHÔNG render nút. */
  available: () => boolean

  /**
   * Bản Mệnh Pháp Bảo (2026-08-27) — slot RENDER được nhưng tạm thời
   * không bấm được (vd nghề chưa có definition), khác hẳn `available`
   * (tồn tại tính năng hay chưa). Nhận `context` làm THAM SỐ thay vì tự
   * đọc store/GameManager bên trong catalog — giữ đúng quy ước "catalog
   * thuần data, không import runtime" ở đầu file; DongFuCommandWheel.vue
   * tự build context rồi truyền vào. Trả về chuỗi lý do (hiện tooltip) hoặc
   * null nếu không bị disable.
   */
  disabledReason?: (context: CommandWheelDisabledContext) => string | null
}

/** Context runtime tối thiểu cho disabledReason() — mở rộng dần khi có slot mới cần. */
export interface CommandWheelDisabledContext {
  hasFoundationRealm: boolean
  hasArtifactDefinition: boolean
}

const NEVER_AVAILABLE = () => false

const ALWAYS_AVAILABLE = () => true

/**
 * Bố cục 4 vòng (plan "Kiến trúc UI đích"):
 * - Ring 1 cốt lõi — Nhân Vật/Kho/Kỹ Năng/Tâm Pháp ở 4 đường chéo.
 * - Ring 2 hệ thống phát triển — Luyện Thể/Realm Passive + future slots
 *   (Pháp Bảo/Phù/Trận) KHÔNG render. Quán Khí đã gỡ khỏi wheel — mở
 *   qua nút riêng trong Character Panel khi đạt điều kiện.
 * - Ring 3 building thật — 5 công trình, còn hotspot trên background
 *   song song (Workstream C dual-entry).
 * - Ring 4 hệ thống — Tàng Kinh Các TRÁI / Cài Đặt PHẢI đối xứng ngang,
 *   luôn khả dụng, không phải building.
 */
export const COMMAND_WHEEL_SLOTS: CommandWheelSlot[] = [
  // ---- Ring 1 — cốt lõi ----
  {
    id: 'character',
    ring: 1,
    label: 'Nhân Vật',
    target: { kind: 'left_panel', mode: 'character' },
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'realm',
    ring: 1,
    label: 'Cảnh Giới',
    target: { kind: 'standalone', panel: 'realm' },
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'skill',
    ring: 1,
    label: 'Kỹ Năng',
    target: { kind: 'standalone', panel: 'skill' },
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'technique',
    ring: 1,
    label: 'Tâm Pháp',
    target: { kind: 'standalone', panel: 'technique' },
    available: ALWAYS_AVAILABLE,
  },

  // ---- Ring 2 — hệ thống phát triển ----
  {
    id: 'luyen_the',
    ring: 2,
    label: 'Luyện Thể',
    target: { kind: 'standalone', panel: 'luyen_the' },
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'quest',
    ring: 2,
    label: 'Nhiệm Vụ',
    target: { kind: 'standalone', panel: 'quest' },
    available: ALWAYS_AVAILABLE,
  },
  // Bản Mệnh Pháp Bảo (2026-08-27) — SHIPPED (khác talisman_slot/
  // formation_slot bên dưới, vẫn future). Render ngay cả trước Trúc Cơ/
  // với nghề chưa có definition — disabledReason() chặn bấm + giải
  // thích lý do, đúng doc §12.1 (khác ẩn hẳn nút).
  {
    id: 'phap_bao',
    ring: 2,
    label: 'Pháp Bảo',
    target: { kind: 'standalone', panel: 'artifact' },
    available: ALWAYS_AVAILABLE,
    disabledReason: (context) => {
      if (!context.hasFoundationRealm) {
        return 'Cần đạt Trúc Cơ'
      }

      if (!context.hasArtifactDefinition) {
        return 'Bản mệnh pháp bảo của nghề này đang chờ thiết kế'
      }

      return null
    },
  },
  // Future slots — tồn tại trong catalog nhưng KHÔNG render nút.
  {
    id: 'talisman_slot',
    ring: 2,
    label: 'Phù',
    available: NEVER_AVAILABLE,
  },
  {
    id: 'formation_slot',
    ring: 2,
    label: 'Trận',
    available: NEVER_AVAILABLE,
  },

  // ---- Ring 3 — building thật (dual-entry với hotspot background) ----
  {
    id: 'teleport_array',
    ring: 3,
    label: 'Truyền Tống Trận',
    buildingId: 'teleport_array',
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'pill_room',
    ring: 3,
    label: 'Đan Phòng',
    buildingId: 'pill_room',
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'gathering_outpost',
    ring: 3,
    label: 'Sản Xuất',
    buildingId: 'gathering_outpost',
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'spirit_spring',
    ring: 3,
    label: 'Linh Tuyền',
    buildingId: 'spirit_spring',
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'equipment_hall',
    ring: 3,
    label: 'Khí Đường',
    buildingId: 'equipment_hall',
    available: ALWAYS_AVAILABLE,
  },

  // ---- Ring 4 — hệ thống (đối xứng ngang, ngang hàng Cài Đặt) ----
  {
    id: 'scripture_pavilion',
    ring: 4,
    label: 'Tàng Kinh Các',
    // KHÔNG qua building controller — entry duy nhất là shortcut này.
    target: { kind: 'left_panel', mode: 'scripture_pavilion' },
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'settings',
    ring: 4,
    label: 'Cài Đặt',
    target: { kind: 'left_panel', mode: 'settings' },
    available: ALWAYS_AVAILABLE,
  },
]

/** Id building thật ở ring 3 — hotspot layer dùng chung danh sách này. */
export const RING_3_BUILDING_IDS: string[] = COMMAND_WHEEL_SLOTS
  .filter((slot) => slot.buildingId !== undefined)
  .map((slot) => slot.buildingId as string)
