export type SkillEventType =
  'cast' | 'hit' | 'kill' | 'damage_taken' | 'attack' | 'critical' | 'dodge' | 'block'

export interface SkillEvent {
  type: SkillEventType

  skillId?: string

  sourceId?: string

  targetId?: string

  value?: number
}
