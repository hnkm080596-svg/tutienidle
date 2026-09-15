import type { BuffDefinition } from '@/core/buff/BuffDefinition'

export const BOSS_BUFFS: BuffDefinition[] = [
  // Phase A2 boss enrage content (2026-09-07) — turn-based twin of the
  // legacy FLOOD_DRAGON_ENRAGE constant in data/enemy/Enemies.ts (same
  // id, same values, intentionally kept as two separate definitions
  // until roadmap item C1 removes the legacy engine — see
  // docs/superpowers/specs/2026-09-07-phase-a2-buff-content-wiring-design.md).
  // Fires via TurnBossTrigger after 60 turns (same magnitude as the
  // existing Trúc Cơ boss — starting point for playtesting, not a
  // derived balance formula).
  {
    id: 'foundation_dragon_enrage',
    name: 'Đại Vương Bạo Nộ',
    description: 'Trận đấu kéo dài quá lâu — Giao Sủng điên cuồng.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'replace',
    effects: [
      { type: 'statModifier', stat: 'might', percent: 0.5 },
      { type: 'statModifier', stat: 'speed', percent: 0.2 },
    ],
  },
  {
    id: 'mortal_crocodile_enrage',
    name: 'Cự Ngạc Bạo Nộ',
    description: 'Trận đấu kéo dài quá lâu — Hung Cự Ngạc điên cuồng.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'replace',
    effects: [
      { type: 'statModifier', stat: 'might', percent: 0.5 },
      { type: 'statModifier', stat: 'speed', percent: 0.2 },
    ],
  },
  {
    id: 'qi_refining_serpent_enrage',
    name: 'Giao Xà Bạo Nộ',
    description: 'Trận đấu kéo dài quá lâu — Hung Giao Xà điên cuồng.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'replace',
    effects: [
      { type: 'statModifier', stat: 'might', percent: 0.5 },
      { type: 'statModifier', stat: 'speed', percent: 0.2 },
    ],
  },
]
