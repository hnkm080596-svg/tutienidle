import { computed, getCurrentScope, onScopeDispose, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from 'vue'

// Module-scoped ordered set of ACTIVE rim claimants (spec 4.1.1). The last
// entry owns .sys-rim--live; at most one live rim may exist per screen.
// Not a mount registry: only callers whose `active` input is true hold claims.
interface RimClaimant {
  id: string
  key: symbol
}
const order = ref<RimClaimant[]>([])

function drop(key: symbol): void {
  order.value = order.value.filter(c => c.key !== key)
}

export function useSystemRimAuthority(
  id: string,
  active: MaybeRefOrGetter<boolean>,
): { isTop: ComputedRef<boolean> } {
  // Unique key per call: same authored id on two callers = two independent
  // claimants (SysPanel feeds useId(); authored ids reserved for surfaces that
  // drive the authority directly, e.g. 'hud-left').
  const claimant: RimClaimant = { id, key: Symbol(id) }

  const isTop = computed(() => order.value[order.value.length - 1]?.key === claimant.key)

  watch(
    () => toValue(active),
    isActive => {
      if (isActive) {
        drop(claimant.key)
        order.value = [...order.value, claimant] // claim = move to top (promote on every activation)
      } else {
        drop(claimant.key)
      }
    },
    { immediate: true, flush: 'sync' },
  )

  if (getCurrentScope()) {
    onScopeDispose(() => drop(claimant.key))
  }

  return { isTop }
}
