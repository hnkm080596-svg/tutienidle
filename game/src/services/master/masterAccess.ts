// Master-account dev gate (Minh 2026-10-07): allowlisted loginIds unlock
// the floating dev panel and the skill constellation design mode. This
// is a client-side test convenience - NOT a security boundary; the
// panel's mutations are test cheats applied to local save state only.
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { BETA_MASTER_UNLOCKS } from '@/core/betaScope'
import type { BetaFeatureName } from '@/core/betaFeatureFlags'

const MASTER_LOGIN_IDS = new Set(['admin'])

// Scope-hidden features a master session opens for TESTING (Minh
// 2026-10-08): tab gate + domain ops share the isBetaFeature channel -
// wash/refine tabs render AND their EquipmentSystem guards pass for
// admin while every other player still fails closed.
const MASTER_BETA_UNLOCKS: readonly BetaFeatureName[] = [
  'equipmentWash',
  'equipmentRefine',
]

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
export const skillDesignOverrides = ref<Record<string, SkillDesignOverride>>(
  JSON.parse(ls.getItem(SKILL_CONST_OVERRIDES_KEY) ?? '{}'),
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
  if (!isMasterLoginId(sessionLoginId.value)) {
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

export function useMasterAccess(): { isMaster: ComputedRef<boolean> } {
  return { isMaster: computed(() => isMasterLoginId(sessionLoginId.value)) }
}
