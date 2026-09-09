<script setup lang="ts">
/**
 * Renderless mount witness for a presentation route.
 *
 * Composite READY needs evidence that the Vue tree for the target route
 * actually rendered. Wrapping a route's screen in this component is that
 * evidence: it reports on mount and withdraws on unmount, so a transition
 * cannot commit to a route whose UI never appeared.
 */
import { inject, onMounted, onUnmounted, watch } from 'vue'
import { VUE_ROUTE_ADAPTER_KEY, type Route } from '@/presentation/PresentationContracts'

const props = defineProps<{ route: Route }>()

const routeAdapter = inject(VUE_ROUTE_ADAPTER_KEY, null)

onMounted(() => {
  routeAdapter?.markRouteMounted(props.route)
})

// One long-lived tree can stand in for several routes (GameRoot covers home,
// combat and tribulation), so a changed route is a new mount witness.
watch(
  () => props.route,
  (route, previous) => {
    routeAdapter?.markRouteUnmounted(previous)
    routeAdapter?.markRouteMounted(route)
  },
)

onUnmounted(() => {
  routeAdapter?.markRouteUnmounted(props.route)
})
</script>

<template>
  <slot />
</template>
