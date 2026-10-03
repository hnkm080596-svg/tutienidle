import { defineStore } from 'pinia'

// Dot Pha tong quat (2026-08-16) - co hien/an BreakthroughRequirementPanel.vue
// (panel vat pham yeu cau, "con duong binh thuong"). Component tu
// resolve targetRealmId tu player.realmId hien tai (getNextRealm()),
// khong can luu o day - chi can biet CO dang mo hay khong, cung pattern
// toi gian nhu useOfflineSummaryStore.
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
