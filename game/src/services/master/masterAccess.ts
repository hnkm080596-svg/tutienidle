// Master-account dev gate (Minh 2026-10-07): allowlisted loginIds unlock
// the floating dev panel and the skill constellation design mode. This
// is a client-side test convenience - NOT a security boundary; the
// panel's mutations are test cheats applied to local save state only.
import { computed, ref, type ComputedRef } from 'vue'
import { BETA_MASTER_UNLOCKS } from '@/core/betaScope'
import type { BetaFeatureName } from '@/core/betaFeatureFlags'
import { testSandboxActive } from '../dev/testSandbox'

const MASTER_LOGIN_IDS = new Set(['admin'])

// Master gate (Minh 2026-10-10): one key string admits a session as
// master without needing the 'admin' loginId - Minh's "cua sau" for
// test-edit privileges. The key value is NOT in the repo (owner ruling
// 2026-10-10): it comes from VITE_MASTER_GATE_KEY (set it in .env.local,
// which is gitignored); when unset the gate stays closed for everyone.
// The flag persists in sessionStorage so a reload inside the same tab
// keeps the session master but never leaks to another tab/profile.
export const MASTER_GATE_KEY: string = import.meta.env.VITE_MASTER_GATE_KEY ?? ''
const MASTER_GATE_STORAGE_KEY = 'master-gate-unlocked-v1'

const gateStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> =
  typeof sessionStorage === 'undefined'
    ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    : sessionStorage

const gateUnlocked = ref(gateStorage.getItem(MASTER_GATE_STORAGE_KEY) === '1')

/** Returns true when the key admits the session through the master gate.
 *  Fails closed when no VITE_MASTER_GATE_KEY is configured. */
export function unlockMasterGate(key: string | undefined): boolean {
  if (MASTER_GATE_KEY === '' || key !== MASTER_GATE_KEY) return false
  gateUnlocked.value = true
  gateStorage.setItem(MASTER_GATE_STORAGE_KEY, '1')
  return true
}

/** Drops the gate flag - called on logout so a guest/later login in the
 *  same tab does not inherit the previous session's test privileges
 *  (QA fixpoint: sessionStorage survives logout otherwise). */
export function clearMasterGateFlag() {
  gateUnlocked.value = false
  gateStorage.removeItem(MASTER_GATE_STORAGE_KEY)
}

// Scope-hidden features a master session opens for TESTING (Minh
// 2026-10-08): tab gate + domain ops share the isBetaFeature channel.
// Empty since 2026-10-09 - wash/refine shipped to every beta player, so
// no feature remains for the master account to preview. Keep the
// channel: the next scope-hidden feature can re-list its name here.
const MASTER_BETA_UNLOCKS: readonly BetaFeatureName[] = []

const sessionLoginId = ref<string | undefined>()

// SSR/test mounts have no window.localStorage - same no-op fallback the
// paper tree used when this flag lived there.
const ls: Pick<Storage, 'getItem' | 'setItem'> =
  typeof localStorage === 'undefined'
    ? { getItem: () => null, setItem: () => {} }
    : localStorage

const SKILL_DESIGN_MODE_KEY = 'skill-tree-design-mode-v1'
const SKILL_CONST_OVERRIDES_KEY = 'skill-tree-design-const-pos-v1'

// Skill design-mode position overrides, keyed `${glyphId}:${nodeId}`.
// Module-level so the constellation panel (writer) and any exporter read
// the same record. Persisted like the paper tree's offsets so a reload
// does not lose an arrangement mid-session.
export interface SkillDesignOverride { x: number; y: number }
// QA fixpoint 2026-10-10: corrupt/non-JSON localStorage would throw at
// module init and break every import - parse defensively.
function readOverridesJson(): Record<string, SkillDesignOverride> {
  try {
    const raw = ls.getItem(SKILL_CONST_OVERRIDES_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    // Reject arrays too (QA fixpoint 2026-10-10, round-3): '[]' in storage
    // would pass the object check - same guard as the paper tree's.
    return parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)
      ? {}
      : (parsed as Record<string, SkillDesignOverride>)
  } catch {
    return {}
  }
}
export const skillDesignOverrides = ref<Record<string, SkillDesignOverride>>(
  readOverridesJson(),
)

// Shared flag: the paper tree's local toggle and the dev panel drive the
// same ref (previously a SkillPaperTree-local localStorage flag). Still
// persisted so Minh's arrangement mode survives reloads.
export const skillDesignMode = ref(ls.getItem(SKILL_DESIGN_MODE_KEY) === '1')

export function setSkillDesignMode(on: boolean) {
  skillDesignMode.value = on
  ls.setItem(SKILL_DESIGN_MODE_KEY, on ? '1' : '0')
}

export function persistSkillDesignOverrides() {
  ls.setItem(SKILL_CONST_OVERRIDES_KEY, JSON.stringify(skillDesignOverrides.value))
}

export function recordSessionLoginId(loginId: string | undefined) {
  sessionLoginId.value = loginId?.toLowerCase()
  if (!isMasterSession()) {
    setSkillDesignMode(false)
    skillDesignOverrides.value = {}
    BETA_MASTER_UNLOCKS.clear()
  } else {
    for (const feature of MASTER_BETA_UNLOCKS) {
      BETA_MASTER_UNLOCKS.add(feature)
    }
  }
}

function isMasterLoginId(loginId: string | undefined): boolean {
  return loginId !== undefined && MASTER_LOGIN_IDS.has(loginId)
}

/** Sync master check for non-component callers (save/lifecycle seams). A
 *  session is master when the loginId is allowlisted OR the gate key
 *  unlocked it - both are client-side test privileges, never authority. */
export function isMasterSession(): boolean {
  // Sandbox tools never acquire the legacy save-recovery/tolerance privileges.
  if (testSandboxActive) return false
  // Read-time kill switch: removing VITE_MASTER_GATE_KEY revokes the
  // flag too, not just new mints (QA fixpoint round on the gate).
  return (MASTER_GATE_KEY !== '' && gateUnlocked.value) || isMasterLoginId(sessionLoginId.value)
}

export function useMasterAccess(): { isMaster: ComputedRef<boolean> } {
  return { isMaster: computed(() => testSandboxActive || isMasterSession()) }
}
