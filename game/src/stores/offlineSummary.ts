import { defineStore } from 'pinia'
import { formatDuration } from '@/core/format/formatDuration'
import { formatNumber } from '@/core/format/NumberFormatter'
import { i18n } from '@/i18n'
import { useNotificationStore } from './notification'

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
      try {
        const msg = i18n.global.t('dongFu.chatbox.offlineSummary', {
          duration: formatDuration(data.elapsedSeconds),
          cultivation: formatNumber(data.cultivation),
        })
        useNotificationStore().recordLogEntry('upgrade', msg, undefined, true)
      } catch {
        // Best-effort log entry for Dong Fu chatbox.
      }
    },

    clear() {
      this.data = null
    },
  },
})
