import type { ThemeId } from '@/assets/themes'

export { type ThemeId }

export const THEME_TINT_MAP: Record<ThemeId, number> = {
  'default': 0xffffff,
  'ink-minimal': 0xfdfbf7,
  'landscape-shanshui': 0xf0ebe0,
  'xianxia-glow': 0xc9a8ff,
  'classical-imperial': 0xf5e6e0,
}

export const getTintForTheme = (themeId: string): number => {
  if (themeId in THEME_TINT_MAP) {
    return THEME_TINT_MAP[themeId as ThemeId]
  }
  return 0xffffff
}

export const applyTintToScene = (
  scene: { children: { list: unknown[] } },
  themeId: string,
): void => {
  const tint = getTintForTheme(themeId)
  for (const obj of scene.children.list) {
    if (obj && typeof obj === 'object' && 'setTint' in obj) {
      const tintable = obj as { setTint: (n: number) => void }
      tintable.setTint(tint)
    }
  }
}