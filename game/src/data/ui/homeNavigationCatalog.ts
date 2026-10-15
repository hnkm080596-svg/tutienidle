// Home navigation catalog (Slice 3.3, V2) - single source of truth for
// Dong Phu navigation across both the left landscape rail (`HOME_RAIL_ENTRIES`)
// and the command wheel (`COMMAND_WHEEL_SLOTS` + `WHEEL_SLOT_SYMBOL`).
// Pure data: never imports GameManager or Pinia runtime stores.
import type { PcPaperIcon } from '@/presentation/assets/PcPaperIcons'
import type {
  HomeSurfaceId,
  LeftPanelMode,
  StandalonePanel,
} from '@/presentation/contracts/panelIds'

export type PanelTarget =
  | { kind: 'left_panel'; mode: Exclude<LeftPanelMode, null> }
  | { kind: 'standalone'; panel: Exclude<StandalonePanel, null> }

export type CommandWheelRing = 1 | 2 | 3 | 4

export interface CommandWheelSlot {
  id: string

  ring: CommandWheelRing

  labelKey: string

  target?: PanelTarget

  /** Ring 3 - mo panel chuc nang cua cong trinh qua controller. */
  buildingId?: string

  /** false = future slot, KHONG render nut. */
  available: () => boolean

  /**
   * Ban Menh Phap Bao (2026-08-27) - slot RENDER duoc nhung tam thoi
   * khong bam duoc (vd nghe chua co definition), khac han `available`
   * (ton tai tinh nang hay chua). Nhan `context` lam THAM SO thay vi tu
   * doc store/GameManager ben trong catalog - giu dung quy uoc "catalog
   * thuan data, khong import runtime" o dau file; DongFuStage.vue
   * tu build context roi truyen vao. Tra ve chuoi ly do (hien tooltip) hoac
   * null neu khong bi disable.
   */
  disabledReason?: (context: CommandWheelDisabledContext) => string | null
}

/** Context runtime toi thieu cho disabledReason() - mo rong dan khi co slot moi can. */
export interface CommandWheelDisabledContext {
  artifactDomainUnlocked: boolean
  artifactUnlockRealmAvailable: boolean
  hasArtifactDefinition: boolean
  companionDomainUnlocked: boolean
  formationUnlocked: boolean
  realmReleaseUnavailable: boolean
}

const NEVER_AVAILABLE = () => false

const ALWAYS_AVAILABLE = () => true

export const RELEASE_UNAVAILABLE_REASON = 'Chưa mở trong bản hiện tại'

export const COMMAND_WHEEL_SLOTS: CommandWheelSlot[] = [
  // ---- Ring 1 - cot loi ----
  {
    id: 'character',
    ring: 1,
    labelKey: 'panels.wheel.slots.character',
    target: { kind: 'left_panel', mode: 'character' },
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'realm',
    ring: 1,
    labelKey: 'panels.wheel.slots.realm',
    target: { kind: 'standalone', panel: 'realm' },
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'skill',
    ring: 1,
    labelKey: 'panels.wheel.slots.skill',
    target: { kind: 'standalone', panel: 'skill' },
    available: ALWAYS_AVAILABLE,
  },

  // ---- Ring 2 - he thong phat trien ----
  {
    id: 'quest',
    ring: 2,
    labelKey: 'panels.wheel.slots.quest',
    target: { kind: 'standalone', panel: 'quest' },
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'phap_bao',
    ring: 2,
    labelKey: 'panels.wheel.slots.phap_bao',
    target: { kind: 'standalone', panel: 'artifact' },
    available: ALWAYS_AVAILABLE,
    disabledReason: (context) => {
      if (!context.artifactDomainUnlocked) {
        return context.realmReleaseUnavailable || !context.artifactUnlockRealmAvailable
          ? RELEASE_UNAVAILABLE_REASON
          : 'Cần đạt Kim Đan'
      }

      if (!context.hasArtifactDefinition) {
        return 'Bản mệnh pháp bảo của nghề này đang chờ thiết kế'
      }

      return null
    },
  },
  {
    id: 'talisman_slot',
    ring: 2,
    labelKey: 'panels.wheel.slots.talisman_slot',
    available: NEVER_AVAILABLE,
  },
  {
    id: 'formation_slot',
    ring: 2,
    labelKey: 'panels.wheel.slots.formation_slot',
    target: { kind: 'standalone', panel: 'tran_phap' },
    available: ALWAYS_AVAILABLE,
    disabledReason: (context) => {
      if (context.formationUnlocked) {
        return null
      }

      return context.realmReleaseUnavailable ? RELEASE_UNAVAILABLE_REASON : 'Cần đạt Trúc Cơ'
    },
  },
  {
    id: 'companion_roster',
    ring: 2,
    labelKey: 'panels.wheel.slots.companion_roster',
    target: { kind: 'standalone', panel: 'companion' },
    available: ALWAYS_AVAILABLE,
    disabledReason: (context) => {
      if (context.companionDomainUnlocked) {
        return null
      }

      return context.realmReleaseUnavailable ? RELEASE_UNAVAILABLE_REASON : 'Cần đạt Trúc Cơ'
    },
  },

  // ---- Ring 3 - building that (dual-entry voi hotspot background) ----
  {
    id: 'teleport_array',
    ring: 3,
    labelKey: 'panels.wheel.slots.teleport_array',
    buildingId: 'teleport_array',
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'pill_room',
    ring: 3,
    labelKey: 'panels.wheel.slots.pill_room',
    buildingId: 'pill_room',
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'gathering_outpost',
    ring: 3,
    labelKey: 'panels.wheel.slots.gathering_outpost',
    buildingId: 'gathering_outpost',
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'chi_hien_quan',
    ring: 3,
    labelKey: 'panels.wheel.slots.chi_hien_quan',
    buildingId: 'chi_hien_quan',
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'equipment_hall',
    ring: 3,
    labelKey: 'panels.wheel.slots.equipment_hall',
    buildingId: 'equipment_hall',
    available: ALWAYS_AVAILABLE,
  },

  // ---- Ring 4 - he thong (doi xung ngang, ngang hang Cai Dat) ----
  {
    id: 'scripture_pavilion',
    ring: 4,
    labelKey: 'panels.wheel.slots.scripture_pavilion',
    target: { kind: 'left_panel', mode: 'scripture_pavilion' },
    available: ALWAYS_AVAILABLE,
  },
  {
    id: 'settings',
    ring: 4,
    labelKey: 'panels.wheel.slots.settings',
    target: { kind: 'left_panel', mode: 'settings' },
    available: ALWAYS_AVAILABLE,
  },
]

/** Id building that o ring 3 - hotspot layer dung chung danh sach nay. */
export const RING_3_BUILDING_IDS: string[] = COMMAND_WHEEL_SLOTS
  .filter((slot) => slot.buildingId !== undefined)
  .map((slot) => slot.buildingId as string)

/** Symbol mapping for command-wheel slots rendered by DongFuWheel. */
export const WHEEL_SLOT_SYMBOL: Readonly<Record<string, string>> = {
  character: 'character',
  realm: 'realm',
  skill: 'skill',
  quest: 'quest',
  phap_bao: 'equipment',
  talisman_slot: 'technique',
  formation_slot: 'realm',
  companion_roster: 'character',
  teleport_array: 'exploration',
  pill_room: 'alchemy',
  gathering_outpost: 'auto-farm',
  chi_hien_quan: 'home',
  equipment_hall: 'equipment',
  scripture_pavilion: 'technique',
  settings: 'settings',
}

export interface HomeRailEntry {
  readonly id: PcPaperIcon
  /**
   * Canonical surface in `stores/ui.ts` (`activeHomeSurface`) this rail
   * button opens and highlights against (`null` for `'home'` or static
   * locked entries).
   */
  readonly surfaceId: HomeSurfaceId | null
  /**
   * When set, clicking routes through `useBuildingNavigation().openBuilding(buildingId)`
   * so building scope/progression gates apply uniformly with the wheel.
   */
  readonly buildingId?: string
  /** When true, clicking routes through `ui.openArchitecture()`. */
  readonly opensArchitecture?: boolean
  /** True when permanently locked on the beta rail (no beta surface yet). */
  readonly staticLocked?: boolean
  /** Standalone panel id whose `isBetaStandalonePanel` gate locks the rail button when false. */
  readonly betaStandaloneGate?: Exclude<StandalonePanel, null>
  /** True when gated by `isBetaTechniqueSurfaceUnlocked(player)`. */
  readonly requiresTechniqueUnlock?: boolean
}

/**
 * Canonical ordered list of entries for the left Dong Phu navigation rail.
 * Replaces the 6 parallel ad-hoc lookup tables previously embedded in
 * `DongFuStage.vue`.
 */
export const HOME_RAIL_ENTRIES: readonly HomeRailEntry[] = [
  { id: 'home', surfaceId: null },
  { id: 'character', surfaceId: 'character' },
  { id: 'skill', surfaceId: 'skill' },
  { id: 'equipment', surfaceId: 'equipment_hall', buildingId: 'equipment_hall' },
  { id: 'body', surfaceId: 'body' },
  { id: 'technique', surfaceId: 'technique', requiresTechniqueUnlock: true },
  { id: 'realm', surfaceId: 'realm' },
  { id: 'inventory', surfaceId: 'inventory' },
  { id: 'alchemy', surfaceId: 'pill_room', buildingId: 'pill_room' },
  { id: 'formation', surfaceId: 'tran_phap', betaStandaloneGate: 'tran_phap' },
  { id: 'exploration', surfaceId: 'stage_select' },
  { id: 'quest', surfaceId: 'quest' },
  { id: 'production', surfaceId: 'exploration', buildingId: 'gathering_outpost' },
  { id: 'vendor', surfaceId: null, staticLocked: true },
  { id: 'sect', surfaceId: 'architecture', opensArchitecture: true },
  { id: 'settings', surfaceId: 'settings' },
  { id: 'feedback', surfaceId: 'feedback' },
  { id: 'artifact', surfaceId: null, staticLocked: true },
  { id: 'companion', surfaceId: null, staticLocked: true },
  { id: 'guild', surfaceId: null, staticLocked: true },
  { id: 'portal', surfaceId: null, staticLocked: true },
]

export const HOME_RAIL_ENTRY_BY_ID: Readonly<Record<PcPaperIcon, HomeRailEntry>> =
  Object.fromEntries(
    HOME_RAIL_ENTRIES.map((entry) => [entry.id, entry]),
  ) as unknown as Readonly<Record<PcPaperIcon, HomeRailEntry>>
