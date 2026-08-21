import { defineStore } from 'pinia'

export interface OfflineSummaryData {
  elapsedSeconds: number

  cultivation: number
}

export const useOfflineSummaryStore = defineStore('offlineSummary', {
  state: () => ({
    data: null as OfflineSummaryData | null,
  }),

  actions: {
    show(data: OfflineSummaryData) {
      this.data = data
    },

    clear() {
      this.data = null
    },
  },
})
