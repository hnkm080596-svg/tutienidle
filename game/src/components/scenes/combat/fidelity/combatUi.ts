export interface CombatDisplayBar { id: string; label: string; value: string; percent: number; tone?: string }
export interface CombatDisplayPlayer { name: string; level: string; portrait: string; bars: readonly CombatDisplayBar[]; effects: readonly { id: string; label: string; icon: string }[]; pips: number; pipTotal: number }
export interface CombatDisplayTurn { id: string; name: string; portrait: string; side: 'player' | 'enemy' }
export interface CombatDisplaySkill { id: string; label: string; icon: string; motif?: 'sword' | 'orb' | 'fist'; hint: string; badge: string }
export interface CombatDisplayEnemy { id: string; name: string; x: number; y: number; bar: CombatDisplayBar }
export interface CombatDisplayModel { zone: string; stage: string; round: string; player: CombatDisplayPlayer; turns: readonly CombatDisplayTurn[]; currentTurn: string; enemies: readonly CombatDisplayEnemy[]; strategies: readonly { id: string; label: string }[]; skills: readonly CombatDisplaySkill[] }
