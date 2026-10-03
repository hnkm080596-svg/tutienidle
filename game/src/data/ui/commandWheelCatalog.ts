// Command wheel catalog (dong-fu-command-wheel-inventory-spirit-stone-
// plan.md Workstream B) - nguon DUY NHAT cho cac shortcut cua wheel
// nhieu tang. Thuan data: KHONG import GameManager/store runtime;
// `available` la closure hang (future slot -> false, khong render nut).
// Building ring KHONG liet ke id trung lap noi khac - hotspot layer va
// wheel cung doc catalog nay (P2 cleanup: catalog la nguon duy nhat cho
// building id dung chung trong UI moi).
import type { LeftPanelMode, StandalonePanel } from '@/presentation/contracts/panelIds'

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
   * thuan data, khong import runtime" o dau file; DongFuCommandWheel.vue
   * tu build context roi truyen vao. Tra ve chuoi ly do (hien tooltip) hoac
   * null neu khong bi disable.
   */
  disabledReason?: (context: CommandWheelDisabledContext) => string | null
}

/** Context runtime toi thieu cho disabledReason() - mo rong dan khi co slot moi can. */
export interface CommandWheelDisabledContext {
  // P7-M9 + M-F-CEILING: per-domain unlock booleans resolved in
  // DongFuCommandWheel.vue from the AUTHORITATIVE domain predicates
  // (isArtifactDomainUnlocked / isCompanionDomainUnlocked /
  // isFormationUnlocked) - the slots must not key off raw realm presence
  // or the wheel drifts from the domain gate when a threshold (or the
  // release ceiling) moves.
  artifactDomainUnlocked: boolean
  // M-F-ARTIFACT-DEFER: isRealmAvailable(ARTIFACT_UNLOCK_REALM_ID) - the
  // domain's unlock realm sits inside the release window. Distinguishes
  // the two below-unlock locks once the domain defers past the ceiling:
  // unlock realm outside the window -> release-hidden; inside the window
  // but not yet reached -> the progression lock names Kim Dan.
  artifactUnlockRealmAvailable: boolean
  hasArtifactDefinition: boolean
  companionDomainUnlocked: boolean
  formationUnlocked: boolean
  // M-F-CEILING (C2C-12): !isRealmAvailable(player.realmId) - the save
  // sits beyond the release ceiling, so a locked slot is release-hidden,
  // not "requires Truc Co". Lets the tooltip distinguish the two locks.
  realmReleaseUnavailable: boolean
}

const NEVER_AVAILABLE = () => false

const ALWAYS_AVAILABLE = () => true

// M-F-CEILING (C2C-12): tooltip for a domain hidden by the release
// ceiling (save realm unavailable), distinct from the progression lock
// "requires Truc Co". Exported for the deferred-domain boundary suite
// (ReleasePolicy.artifactDeferred.test.ts).
export const RELEASE_UNAVAILABLE_REASON = 'Chưa mở trong bản hiện tại'

/**
 * Bo cuc 4 vong (plan "Kien truc UI dich"):
 * - Ring 1 cot loi - Nhan Vat/Kho/Ky Nang/Tam Phap o 4 duong cheo.
 * - Ring 2 he thong phat trien - Luyen The/Realm Passive + future slots
 *   (Phap Bao/Phu/Tran) KHONG render. Quan Khi da go khoi wheel - mo
 *   qua nut rieng trong Character Panel khi dat dieu kien.
 * - Ring 3 building that - 5 cong trinh, con hotspot tren background
 *   song song (Workstream C dual-entry).
 * - Ring 4 he thong - Tang Kinh Cac TRAI / Cai Dat PHAI doi xung ngang,
 *   luon kha dung, khong phai building.
 */
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
  // Ban Menh Phap Bao (2026-08-27) - SHIPPED (khac talisman_slot ben
  // duoi, van future). Render ngay ca truoc Truc Co/ voi nghe chua co
  // definition - disabledReason() chan bam + giai thich ly do, dung
  // doc sec12.1 (khac an han nut).
  {
    id: 'phap_bao',
    ring: 2,
    labelKey: 'panels.wheel.slots.phap_bao',
    target: { kind: 'standalone', panel: 'artifact' },
    available: ALWAYS_AVAILABLE,
    // M-F-ARTIFACT-DEFER: the domain is deferred to Kim Dan+, which is
    // outside the release window - a below-unlock player reads
    // release-hidden while the unlock realm is out of window, and the
    // progression lock once Kim Dan ships (artifactUnlockRealmAvailable
    // is fed by isRealmAvailable(ARTIFACT_UNLOCK_REALM_ID)).
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
  // Future slot - ton tai trong catalog nhung KHONG render nut.
  {
    id: 'talisman_slot',
    ring: 2,
    labelKey: 'panels.wheel.slots.talisman_slot',
    available: NEVER_AVAILABLE,
  },
  // Tran Phap (Combat Art Roster spec, 2026-09-05) - SHIPPED, mo
  // TranPhapPanel.vue de keo-tha gan player/companion vao luoi 6x6.
  // P7-M9 (decisions D3 + M9-F1): Tran unlocks with party/companion progression
  // at Truc Co - renders with a lock badge before that (phap_bao precedent).
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
  // Companion Roster (companion-gacha spec, 2026-09-12) - SHIPPED.
  // Opens CompanionPanel.vue (roster by grade, detail, feed control).
  // P7-M9 (decision D4): the Companion domain begins at Tru Co.
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
    // KHONG qua building controller - entry duy nhat la shortcut nay.
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
