export interface TechniqueUiRow { id: string; label: string; value: string }
export interface TechniqueUiModel {
  name: string
  quality: string
  description: string
  art: string
  sections: readonly { id: string; title: string; rows: readonly TechniqueUiRow[] }[]
  stages: readonly { id: string; label: string; state: 'reached' | 'current' | 'next' }[]
  rankLabel: string
  masteryLabel: string
  masteryPercent: number
  currentGrade: string
  nextGrade: string
  material: { name: string; amountLabel: string }
  /** Optional footnote under the material row (empty = hidden). The
   *  preview uses it for its fixture disclaimer; production leaves it
   *  blank because the row already carries real owned/cost numbers. */
  materialNote: string
  /** Canonical gradeAdvance gate - the CTA renders disabled and the
   *  reserved notice line explains why until a transient notice wins. */
  advanceDisabled: boolean
  disabledReason: string
  /** True while `art` is the fallback placeholder rather than the
   *  technique's own icon - the vista shows its temp-art caption. */
  artTemporary: boolean
}
