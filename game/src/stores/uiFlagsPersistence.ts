// Ui automation flags persistence (2026-08-26) - nguoi choi yeu cau
// "luu lai flag cua cac trang thai tu dong" (che do auto-refight) nen
// chung SONG qua reload. (2026-08-30) isAutoConsumeTinhHoa da GO - Luyen
// The tu dau tu qua essence stream nen khong con la tuy chon nguoi choi.
//
// Lua chon storage: localStorage RIENG thay vi PlayerData/save chinh vi
// day la tuy chon THIET BI (per-device convenience), khong thuoc tien
// trinh nhan vat - khong bump CURRENT_SAVE_VERSION, khong dung cloud
// save. Development build: hong/quota -> fallback gia tri mac dinh, khong
// throw.

import type { BattleRunMode, CombatInputMode } from './ui'

export const UI_AUTOMATION_STORAGE_KEY = 'tien-hiep-idle-ui-automation'

/** Nhom flag tu dong duoc luu - CHI gom cac trang thai co y nghia dai han. */
export interface UiAutomationFlagSnapshot {
  /** Che do auto-refight dang chon o Stage Select (manual/repeat/progress). */
  battleRunMode: BattleRunMode

  /** Slice 7 (2026-09-04) - che do input combat (auto = engine khong pause; manual = pause cho chon skill tai luot player). Truc RIENG khoi battleRunMode. */
  combatInputMode: CombatInputMode
}

const BATTLE_RUN_MODES: readonly BattleRunMode[] = ['manual', 'repeat', 'progress', 'perfect_farm']

export function isBattleRunMode(value: unknown): value is BattleRunMode {
  return typeof value === 'string' && (BATTLE_RUN_MODES as readonly string[]).includes(value)
}

const COMBAT_INPUT_MODES: readonly CombatInputMode[] = ['manual', 'auto']

export function isCombatInputMode(value: unknown): value is CombatInputMode {
  return typeof value === 'string' && (COMBAT_INPUT_MODES as readonly string[]).includes(value)
}

/**
 * Doc snapshot da luu - gia tri thieu/sai kieu bi BO (caller dung
 * `?? default`), JSON hong tra ve rong hoan toan, khong bao gio throw.
 */
export function loadPersistedUiAutomationFlags(): Partial<UiAutomationFlagSnapshot> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {}
  }

  try {
    const raw = localStorage.getItem(UI_AUTOMATION_STORAGE_KEY)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>

    const snapshot: Partial<UiAutomationFlagSnapshot> = {}

    if (isBattleRunMode(parsed.battleRunMode)) {
      snapshot.battleRunMode = parsed.battleRunMode
    }

    if (isCombatInputMode(parsed.combatInputMode)) {
      snapshot.combatInputMode = parsed.combatInputMode
    }

    return snapshot
  } catch {
    return {}
  }
}

export function savePersistedUiAutomationFlags(snapshot: UiAutomationFlagSnapshot): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(UI_AUTOMATION_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Private mode/quota exceeded - bo qua, flags van chay trong phien.
  }
}

/**
 * Minimal structural contract for a Pinia store carrying the two
 * automation flags - lets this module own the subscribe wiring without
 * importing the ui store (which already imports this module).
 */
interface AutomationFlagsSource {
  $subscribe(
    callback: (
      mutation: unknown,
      state: Pick<AutomationFlagsSource, 'battleRunMode' | 'combatInputMode'>,
    ) => void,
    options?: { detached?: boolean },
  ): () => void

  battleRunMode: BattleRunMode

  combatInputMode: CombatInputMode
}

/**
 * Mission A4 - persist automation flags on ANY store mutation, including
 * direct `ui.battleRunMode = ...` / `ui.combatInputMode = ...` writes from
 * panels that bypass the setter actions. The dirty check compares the
 * composite signature so a combatInputMode-only change still writes.
 * Returns the Pinia unsubscribe - the caller owns the lifecycle.
 */
export function installAutomationFlagsPersistence(
  store: AutomationFlagsSource,
): () => void {
  let lastSnapshot: string | undefined

  return store.$subscribe(
    (_mutation, state) => {
      const snapshot = `${state.battleRunMode}|${state.combatInputMode}`

      if (snapshot === lastSnapshot) {
        return
      }

      lastSnapshot = snapshot

      savePersistedUiAutomationFlags({
        battleRunMode: state.battleRunMode,
        combatInputMode: state.combatInputMode,
      })
    },
    { detached: true },
  )
}
