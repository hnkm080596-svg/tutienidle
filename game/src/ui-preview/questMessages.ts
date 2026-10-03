import { remainingMessages } from './remainingMessages'

// Quest preview messages: the fixture vocab stays shared
// (remainingMessages); the namespaced keys below mirror the prod keys
// the migrated scene chrome resolves so the preview never renders raw
// key paths.
export const questMessages = { vi: {
  ...remainingMessages.vi,
  panels: { quest: { title: 'Nhiệm Vụ' } },
  paperNav: { navigation: 'Chức năng' },
} } as const
