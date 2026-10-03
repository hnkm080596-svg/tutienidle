export interface VictoryRewardDisplay { id: string; name: string; amount: string; icon?: string; motif?: 'jade'; tone: string }
export interface VictoryGrowthDisplay { id: string; label: string; value: string; detail: string; icon: string; progress: number; tone: string }
export interface VictoryDisplayModel { stage: string; caption: string; rewards: readonly VictoryRewardDisplay[]; growth: readonly VictoryGrowthDisplay[] }
