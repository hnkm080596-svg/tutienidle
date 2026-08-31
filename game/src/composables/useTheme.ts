// game/src/composables/useTheme.ts
import { computed } from 'vue'
import { useThemeStore } from '@/stores/themeStore'
import { THEME_REGISTRY, type ThemeId } from '@/assets/themes'

export const useTheme = () => {
  const store = useThemeStore()

  return {
    currentTheme: computed(() => store.currentTheme),
    themes: THEME_REGISTRY,
    setTheme: (id: ThemeId) => store.setTheme(id),
  }
}
