import { remainingMessages } from './remainingMessages'

// Inventory preview messages: the fixture vocab stays shared
// (remainingMessages); the namespaced keys below mirror the prod keys
// the migrated scene chrome resolves so the preview never renders raw
// key paths. The preview keeps its Tui Do fixture title where prod
// resolves panels.bag.title to Kho Vat.
export const inventoryMessages = { vi: {
  ...remainingMessages.vi,
  panels: { bag: { title: 'Túi Đồ', countSuffix: 'món' } },
  paperNav: { navigation: 'Chức năng' },
} } as const
