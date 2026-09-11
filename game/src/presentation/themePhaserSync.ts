// Theme -> Phaser tint bridge.
//
// V1 of docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md:
// this watches a Pinia store and pushes into a scene, so it is a bridge, not a
// visual, and it may not live under `src/game/`.
//
// Note for whoever wires this up: it currently has NO caller anywhere in the
// tree, production or test. It is moved rather than deleted because theme
// tinting is a capability someone intended and five themes exist to use it —
// removing it is a product call, not a boundary one.
import { watch } from 'vue'
import { useThemeStore } from '@/stores/themeStore'
import { applyTintToScene } from '@/game/support/phaserThemeBridge'

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
