export interface ExplorationNode {
  id: string
  label: string
  x: number
  y: number
  // Canonical StageSurfaceState: 'perfect' renders as cleared+perfect
  // marker, 'completed' as cleared, 'available' as an unlocked non-
  // frontier node, 'current' as the frontier, 'locked' sealed.
  state: 'cleared' | 'current' | 'available' | 'locked'
  boss: boolean
  perfect: boolean
  // displayEnemy.name - which species guards this ai at a glance.
  enemy?: string
}
export interface ExplorationChapter {
  id: string
  label: string
  tone: string
  nodes: readonly ExplorationNode[]
  edges: readonly { from: string; to: string }[]
}
export interface ExplorationZone {
  id: string
  label: string
  unlocked: boolean
}
export interface ExplorationModeChip {
  id: string
  label: string
  active: boolean
  disabled: boolean
}
export interface ExplorationReward {
  label: string
  amount: string
  icon?: string
  tooltip?: import('@/composables/useTooltip').TooltipContent
}
export interface ExplorationDetail {
  id: string
  title: string
  chapter: string
  description: string
  state: ExplorationNode['state']
  stateLabel: string
  // "10 Dich" encounter count line (with boss prefix when isBossFloor).
  enemySummary: string
  // "Ten Quai - Cap 3 - Can chien" - displayEnemy name/level/archetype.
  enemyLabel: string
  // Reward cells render as SlotView tiles - icon/tooltip resolve from
  // the item registries (undefined icon falls back to the monogram,
  // undefined tooltip renders nothing on hover).
  rewards: readonly ExplorationReward[]
  // disabledReasonLabel() verdict - empty when startable.
  disabledLabel: string
  modes: readonly ExplorationModeChip[]
  modeHint: string
  buildLabel: string
  startLabel: string
  startDisabled: boolean
}
export interface ExplorationPaperModel {
  title: string
  subtitle: string
  terrain: string
  zones: readonly ExplorationZone[]
  zone: string
  chapters: readonly ExplorationChapter[]
  progress: number
  progressLabel: string
  armedFarm: { stageName: string } | null
  stopLabel: string
}
