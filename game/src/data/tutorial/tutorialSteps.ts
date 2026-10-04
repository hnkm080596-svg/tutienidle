export interface TutorialStep {
  /** Locale keys under `tutorial.steps.<n>` - the catalog stores keys (not
      strings); TutorialOverlay resolves them through t() per locale. */
  titleKey: string

  bodyKey: string
}

// Beta Phase 4 (muc XV tai lieu) - carousel giai thich core loop,
// KHONG ep nguoi choi thuc su bam dung nut moi qua buoc (xem Context
// trong ke hoach - Combat/Loot chua co instrumentation de "biet"
// nguoi choi vua lam xong 1 buoc). Noi dung THUAN huong dan cach
// choi - TUYET DOI khong nhac Dai Dao/Can Co/hidden condition/vuot
// tang bi mat, dung "Tutorial day cach choi, khong day bi mat".
export const TUTORIAL_STEPS: TutorialStep[] = Array.from({ length: 9 }, (_, index) => ({
  titleKey: `tutorial.steps.${index + 1}.title`,
  bodyKey: `tutorial.steps.${index + 1}.body`,
}))
