import { remainingMessages } from './remainingMessages'

// Settings preview messages: the fixture vocab stays shared
// (remainingMessages); the namespaced keys below mirror the prod keys
// the migrated scene chrome resolves so the preview never renders raw
// key paths.
export const settingsMessages = { vi: {
  ...remainingMessages.vi,
  layout: { functionOverlay: { titles: { settings: 'Cài Đặt' } } },
  paperNav: { navigation: 'Chức năng' },
} } as const
