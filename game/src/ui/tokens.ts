/**
 * Huyền Kim Sơn Thủy design tokens — SINGLE SOURCE OF TRUTH (spec §54).
 *
 * Vue consumes these through CSS custom properties declared in
 * `src/assets/huyen-kim.tokens.css`; Phaser consumes the constants below.
 * Parity between the two surfaces is guarded by `tokens.parity.test.ts` —
 * any value edited here MUST be mirrored in the CSS file, and vice versa.
 *
 * Token naming in CSS: `--hk-<name>` (kebab-case of the keys below).
 */

export const HUYEN_KIM_TOKENS = {
  // ---- Surfaces: Huyền — dark lacquer / dark jade, never pure black (§5.1)
  surfaceBase: '#0B0F0D', // dark lacquer, deepest chrome layer
  surfaceRaised: '#131B17', // dark jade — panels, drawers
  surfaceOverlay: '#1B2621', // highest structural layer — modals, tooltips

  // ---- Borders (§5.2 gold intensity Muted → Radiant)
  borderMuted: '#2A352F', // static frame
  borderActive: '#7A6234', // gold Muted — active/selected edge
  borderCeremony: '#E8C35A', // gold Bright — ceremony frames only

  // ---- Text: Ivory / Paper (§5.5)
  textPrimary: '#EDE6D6',
  textSecondary: '#B8AE97',
  textMuted: '#7A7260',

  // ---- Semantic colors
  jade: '#3FA68B', // Ngọc — player, cultivation energy, learned, positive (§5.3)
  jadeSoft: '#67C4AB', // hover/soft feedback
  jadeDeep: '#1F6B58', // fills, subtle backgrounds
  goldMuted: '#7A6234', // frame only
  gold: '#C99A4A', // active
  goldBright: '#E8C35A', // actionable CTA
  goldRadiant: '#F4D98B', // milestone / ceremony only — never everywhere
  cinnabar: '#B54432', // Chu Sa — enemy, danger, damage (§5.4)
  cinnabarBright: '#D4654F',
  cinnabarDeep: '#7E2E21',
  ink: '#5B6266', // locked / desaturated state (§47)
  ivory: '#EDE6D6', // information accent = textPrimary

  // ---- Elevation & glow
  shadowLow: 'rgba(0,0,0,0.40)',
  shadowHigh: 'rgba(0,0,0,0.55)',
  glowJade: 'rgba(63,166,139,0.35)',
  glowGold: 'rgba(232,195,90,0.35)',

  // ---- Spacing scale (px)
  space1: 2,
  space2: 4,
  space3: 8,
  space4: 12,
  space5: 16,
  space6: 24,
  space7: 32,
  space8: 48,

  // ---- Radius (px)
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 12,
  radiusPill: 999,

  // ---- Motion (ms) — restrained, non-bouncy (§48-49)
  motionMicro: '150ms', // micro interaction 100-200
  motionPanel: '280ms', // panel transition 200-350
  motionScene: '450ms', // scene transition 300-600
  motionBreath: '2400ms', // attention breathing, slow (§46 Attention)
  easeStandard: 'cubic-bezier(0.22, 0.61, 0.21, 1)', // deliberate ease-out

  // ---- Density modes (§7): paddingY / paddingX / control height (px)
  densityCompactPadY: 6,
  densityCompactPadX: 10,
  densityCompactHeight: 28,
  densityStandardPadY: 8,
  densityStandardPadX: 14,
  densityStandardHeight: 36,
  densityCeremonialPadY: 14,
  densityCeremonialPadX: 22,
  densityCeremonialHeight: 48,

  // ---- Typography (§6): display serif / UI sans — Vietnamese-capable
  fontDisplay: "'Playfair Display', 'Noto Serif SC', serif",
  fontUi: "'Be Vietnam Pro', 'Noto Sans SC', system-ui, sans-serif",
} as const

export type HuyenKimTokenKey = keyof typeof HUYEN_KIM_TOKENS

const toKebab = (key: string) =>
  key
    .replace(/([a-z])([0-9])/g, '$1-$2')
    .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** `--hk-surface-base` style variable name for a token key. */
export const hkVarName = (key: HuyenKimTokenKey) => `--hk-${toKebab(key)}` as const

/** `var(--hk-...)` reference for use in inline styles / Phaser canvas text. */
export const hkVar = (key: HuyenKimTokenKey) => `var(${hkVarName(key)})`

/** Raw value by key — Phaser fills/strokes need numbers/hex, not CSS vars. */
export function hkColor(key: HuyenKimTokenKey): string
export function hkColor(key: HuyenKimTokenKey) {
  return HUYEN_KIM_TOKENS[key] as string
}

/** Millisecond number for Phaser tweens/timers from a '150ms'-style token. */
export const hkMs = (key: HuyenKimTokenKey) => Number.parseFloat(String(HUYEN_KIM_TOKENS[key]))
