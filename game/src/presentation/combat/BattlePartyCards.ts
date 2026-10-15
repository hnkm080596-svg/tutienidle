import type { TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'

// Live coordinates already contain the formation admitted by combat build.
// Do not reconstruct admission from a possibly scope-hidden saved loadout.
export function battlePartyCards(participants: readonly TurnBattleParticipant[]): (TurnBattleParticipant | null)[] {
  const ordered = [...participants].sort((a, b) =>
    a.entity.row - b.entity.row || a.entity.x - b.entity.x || a.id.localeCompare(b.id),
  )
  return Array.from({ length: 5 }, (_, index) => ordered[index] ?? null)
}
