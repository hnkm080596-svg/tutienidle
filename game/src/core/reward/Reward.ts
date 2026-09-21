export interface Reward {
  // P7-M3 - quest/channel rewards pay SKILL insight directly (the
  // renamed techniqueInsight channel; the technique now feeds on
  // techniqueMastery which is a battle-channel EnemyReward field).
  skillInsight?: number

  cultivation?: number

  spiritStone?: number
}