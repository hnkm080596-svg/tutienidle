import { defineStore } from 'pinia'
import { THEME_REGISTRY, type ThemeId } from '@/assets/themes'

const STORAGE_KEY = 'theme'
const DEFAULT_THEME: ThemeId = 'default'

const isValidTheme = (id: string): id is ThemeId =>
  THEME_REGISTRY.some(t => t.id === id)

const readPersisted = (): ThemeId => {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && isValidTheme(stored) ? stored : DEFAULT_THEME
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    currentTheme: readPersisted(),
  }),
  actions: {
    setTheme(id: ThemeId) {
      if (!isValidTheme(id)) return
      this.currentTheme = id
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, id)
      }
      this.applyToDocument()
    },
    applyToDocument() {
      if (typeof document === 'undefined') return
      document.documentElement.setAttribute('data-theme', this.currentTheme)
    },
  },
})
