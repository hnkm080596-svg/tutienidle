import type { ThemeId } from '@/assets/themes'

export interface IconSet {
  [iconName: string]: string
}

const inkMinimalIcons: IconSet = {
  home: 'M3 12L12 4L21 12M5 10V20H19V10',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 6l-6 6 6 6',
  check: 'M5 12l5 5L20 7',
  star: 'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  chevron: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  attack: 'M14 6l4 4-9 9-4-4zM3 21l4-4',
  defend: 'M12 3l8 3v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z',
  pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
  speed: 'M13 3l-9 9 3 3 9-9 4 4V3z',
  auto: 'M5 12a7 7 0 0114 0M12 8v4l3 3',
  spirit: 'M12 3L4 9v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V9z',
  wood: 'M12 3v18M5 7l7 3M19 7l-7 3',
  ore: 'M3 9l9-6 9 6-9 6z',
  herb: 'M12 3c-3 3-3 9 0 12 3 3 6 3 9 0-3-3-3-9 0-12-3 0-6 0-9 0z',
  essence: 'M12 3l4 4-4 4-4-4z',
  tab: 'M4 8h16M4 14h16M4 20h16',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zM19 12l2-2-2-2M5 12l-2 2 2 2',
  bag: 'M5 7h14l-1 13H6zM9 7V4h6v3',
  character: 'M12 8a3 3 0 100 6 3 3 0 000-6zM5 21v-1c0-3 3-5 7-5s7 2 7 5v1',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z',
}

const shanshuiIcons: IconSet = { ...inkMinimalIcons }
const xianxiaIcons: IconSet = { ...inkMinimalIcons }
const imperialIcons: IconSet = { ...inkMinimalIcons }

const allSets: Record<ThemeId, IconSet> = {
  'default': inkMinimalIcons,
  'ink-minimal': inkMinimalIcons,
  'landscape-shanshui': shanshuiIcons,
  'xianxia-glow': xianxiaIcons,
  'classical-imperial': imperialIcons,
}

export const ICON_REGISTRY: Record<ThemeId, IconSet> = allSets

const FALLBACK_PATH = 'M3 12L12 4L21 12M5 10V20H19V10'

export const getIconPath = (name: string, themeId: ThemeId): string => {
  const set = allSets[themeId] ?? inkMinimalIcons
  return set[name] ?? inkMinimalIcons[name] ?? FALLBACK_PATH
}
