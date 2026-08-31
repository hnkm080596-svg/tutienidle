export type ThemeId =
  | 'default'
  | 'ink-minimal'
  | 'landscape-shanshui'
  | 'xianxia-glow'
  | 'classical-imperial'

export interface ThemeDefinition {
  readonly id: ThemeId
  readonly label: string
  /** Inline SVG data URL for preview card (160x100) */
  readonly preview: string
}
