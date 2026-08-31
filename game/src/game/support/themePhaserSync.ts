import { watch } from 'vue'
import { useThemeStore } from '@/stores/themeStore'
import { applyTintToScene } from './phaserThemeBridge'

export const installThemePhaserSync = (
  getActiveScene: () => { children: { list: unknown[] } } | null,
): void => {
  const store = useThemeStore()
  watch(
    () => store.currentTheme,
    (newTheme) => {
      const scene = getActiveScene()
      if (scene) {
        applyTintToScene(scene, newTheme)
      }
    },
  )
}
