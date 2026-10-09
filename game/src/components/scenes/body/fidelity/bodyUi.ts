// Scene 08 (Luyen The) fidelity contract. The adapter maps the canonical
// useBodySceneModel() chapter units into this shape - nothing here owns
// progression predicates, costs, or invest semantics.
export type { BodyPourSpec as BodyPaperPour } from '../bodySceneModel'

export interface BodyPaperCost {
  id: string
  name: string
  icon?: string
  have: number
  need: number
  /** Resolved "have / need" line (domain-formatted). */
  amountLabel: string
  met: boolean
}

export interface BodyPaperUnit {
  id: string
  label: string
  title: string
  description: string
  state: 'done' | 'current' | 'locked'
  /** Gain rows (stat label -> value). */
  rows: readonly { label: string; value: string }[]
  /** Material/pill requirements of THIS unit. */
  costs: readonly BodyPaperCost[]
  /** Gate lines (realm/page/sequential) rendered cinnabar. */
  gates: readonly string[]
  /** Unit-level progress line (e.g. refinement tier essence fill). */
  progressLabel?: string
  /** Unit progress percent (0-100) for the tube fill - undefined hides. */
  progressPct?: number
  /** Resolved CTA text - empty hides the invest button. */
  actionLabel: string
  actionDisabled: boolean
}

export interface BodyPaperChapter {
  id: string
  label: string
  hint: string
  unlocked: boolean
}

/** Lore milestone chip (Chu Thien Tieu/Dai markers) - display only. */
export interface BodyPaperMilestone {
  id: string
  label: string
  done: boolean
}

/** Discovery-gated hidden row (AUTH-2 hidden tiers/Quan The). */
export interface BodyPaperExtra {
  title: string
  stateLabel: string
  description: string
  progressLabel?: string
  progress?: number
  progressMax?: number
  done: boolean
}

export interface BodyPaperModel {
  chapter: string
  chapterLabel: string
  chapters: readonly BodyPaperChapter[]
  units: readonly BodyPaperUnit[]
  milestones: readonly BodyPaperMilestone[]
  /** Identity line under the title (physique grade / chapter subtitle). */
  identity: string
  extra: BodyPaperExtra | null
  /** Unlock condition shown when every unit of the chapter is out of
   *  reach (hidden content never renders - only its real gate line). */
  lockHint?: string
  progressLabel: string
  progress: number
  /** Aggregated gains of every completed unit (Rèn Thể totals - owner
   *  ruling: the card shows total stats, not the viewed tier's alone). */
  totalRows: readonly { label: string; value: string }[]
}
