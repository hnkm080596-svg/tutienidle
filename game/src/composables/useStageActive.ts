import { computed, inject } from 'vue'
import { VUE_ROUTE_ADAPTER_KEY } from '@/presentation/PresentationContracts'

// Đang ở giữa 1 Stage hoặc trận đang đánh — camera/scene combat chiếm màn
// hình nên mọi thứ tĩnh của Home Scene (building icon, background động phủ)
// phải tự ẩn, tránh đè lên khung combat. Single authority: the presentation
// coordinator's active route (the ui-store fallback flags were retired with
// the R12 cleanup — a second writer could disagree with the committed route).
export function useStageActive() {
  const routeAdapter = inject(VUE_ROUTE_ADAPTER_KEY, null)

  if (!routeAdapter) {
    throw new Error('useStageActive requires VUE_ROUTE_ADAPTER_KEY (provided by App.vue)')
  }

  return computed(() => {
    const route = routeAdapter.activeRoute.value
    return route === 'combat' || route === 'tribulation'
  })
}
