import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import vi from '@/locales/vi.json'
import en from '@/locales/en.json'
import AuthInteractivePreview from './AuthInteractivePreview.vue'
import { messages } from './authpreviewMessages'

createApp(AuthInteractivePreview).use(createI18n({ legacy: false, locale: 'vi', messages: {
  vi: { ...vi, ...messages.vi }, en: { ...en, ...messages.vi },
} })).mount('#app')
