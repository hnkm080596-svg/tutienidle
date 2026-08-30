import type { ThemeDefinition, ThemeId } from './types'

export type { ThemeId, ThemeDefinition }

const previewSvg = (bg: string, accent: string, label: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100">
    <rect width="160" height="100" fill="${bg}"/>
    <rect x="20" y="30" width="120" height="20" fill="${accent}" rx="2"/>
    <text x="80" y="70" text-anchor="middle" font-family="serif" font-size="14" fill="${accent}">${label}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const THEME_REGISTRY: ReadonlyArray<ThemeDefinition> = [
  {
    id: 'default',
    label: 'Mặc họa (mặc định)',
    preview: previewSvg('#08080c', '#d4a557', 'Mặc họa'),
  },
  {
    id: 'ink-minimal',
    label: 'Mặc họa tối giản',
    preview: previewSvg('#fdfbf7', '#1a1a1a', 'Tối giản'),
  },
  {
    id: 'landscape-shanshui',
    label: 'Mặc họa phong cảnh',
    preview: previewSvg('#f0ebe0', '#2c1810', 'Phong cảnh'),
  },
  {
    id: 'xianxia-glow',
    label: 'Tu tiên huyền ảo',
    preview: previewSvg('#0d0a14', '#5c3d8f', 'Huyền ảo'),
  },
  {
    id: 'classical-imperial',
    label: 'Cổ điển Trung Hoa',
    preview: previewSvg('#f5e6e0', '#8b1a1a', 'Trung Hoa'),
  },
]

export const getTheme = (id: ThemeId): ThemeDefinition | undefined =>
  THEME_REGISTRY.find(t => t.id === id)
