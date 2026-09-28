export interface TutorialStep {
  /** Locale keys under `tutorial.steps.<n>` - the catalog stores keys (not
      strings); TutorialOverlay resolves them through t() per locale. */
  titleKey: string

  bodyKey: string
}

// Beta Phase 4 (mục XV tài liệu) — carousel giải thích core loop,
// KHÔNG ép người chơi thực sự bấm đúng nút mới qua bước (xem Context
// trong kế hoạch — Combat/Loot chưa có instrumentation để "biết"
// người chơi vừa làm xong 1 bước). Nội dung THUẦN hướng dẫn cách
// chơi — TUYỆT ĐỐI không nhắc Đại Đạo/Căn Cơ/hidden condition/vượt
// tầng bí mật, đúng "Tutorial dạy cách chơi, không dạy bí mật".
export const TUTORIAL_STEPS: TutorialStep[] = Array.from({ length: 9 }, (_, index) => ({
  titleKey: `tutorial.steps.${index + 1}.title`,
  bodyKey: `tutorial.steps.${index + 1}.body`,
}))
