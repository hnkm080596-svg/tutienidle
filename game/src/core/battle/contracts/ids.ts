// contracts/ids.ts — branded string aliases (type-level only).
//
// Plain string aliases: uniqueness is enforced by the scheduler at enqueue
// time (contract §13), not by the type system. Sibling systems never
// redefine these — import them.

export type CombatEntityId = string
export type BuffDefinitionId = string
export type BuffInstanceId = string
export type ReactionId = string
export type SkillId = string
export type CombatOperationId = string
export type CombatEventId = string
