export interface TribulationChapterDisplay { id: string; name: string; hint: string; icon: string }
export interface TribulationAnswerDisplay { id: string; label: string }
export interface TribulationUiModel {
  realm: string
  progress: string
  chapterId: string
  chapters: readonly TribulationChapterDisplay[]
  description: string
  seconds: string
  strikes: string
  strikePips: readonly { id: string; lit: boolean }[]
  hp: { label: string; value: string; percent: number }
  question: string | null
  answers: readonly TribulationAnswerDisplay[]
  timePercent: number
}
