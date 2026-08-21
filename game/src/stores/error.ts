import { defineStore } from 'pinia'

export const useErrorStore = defineStore('error', {
  state: () => ({
    current: null as string | null,
  }),

  actions: {
    report(message: string) {
      this.current = message
    },

    clear() {
      this.current = null
    },
  },
})
