import { defineStore } from 'pinia'

// Đột Phá tổng quát (2026-08-16) — cờ hiện/ẩn BreakthroughRequirementPanel.vue
// (panel vật phẩm yêu cầu, "con đường bình thường"). Component tự
// resolve targetRealmId từ player.realmId hiện tại (getNextRealm()),
// không cần lưu ở đây — chỉ cần biết CÓ đang mở hay không, cùng pattern
// tối giản như useOfflineSummaryStore.
export const useBreakthroughRequirementStore = defineStore('breakthroughRequirement', {
  state: () => ({
    isOpen: false,
  }),

  actions: {
    open() {
      this.isOpen = true
    },

    close() {
      this.isOpen = false
    },
  },
})
