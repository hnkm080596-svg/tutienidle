import { createI18n } from 'vue-i18n'
import vi from '@/locales/vi.json'
import en from '@/locales/en.json'

export type MessageSchema = typeof vi

export const i18n = createI18n<[typeof vi], 'vi' | 'en'>({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'en',
  messages: { vi, en }
})

export default i18n
