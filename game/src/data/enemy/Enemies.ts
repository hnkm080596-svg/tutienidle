import { defineEnemy } from '../../core/enemy/Enemy'
import type { Enemy } from '../../core/enemy/Enemy'
import { MORTAL_ENEMIES } from './MortalEnemies'
import { FOUNDATION_ENEMIES } from './FoundationEnemies'
import { HIDDEN_BEASTS } from './HiddenBeasts'

/** Runtime enemy data: linh thao chi den tu Dong Thien, khong roi tu quai. */
export const ENEMIES: Enemy[] = [...MORTAL_ENEMIES, ...FOUNDATION_ENEMIES, ...HIDDEN_BEASTS]
