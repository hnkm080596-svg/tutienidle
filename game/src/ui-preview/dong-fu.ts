import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import DongFuPreview from './DongFuPreview.vue'
import { messages } from './dongFuMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'

createApp(DongFuPreview).use(createI18n({ legacy: false, locale: 'vi', fallbackLocale: 'vi', messages })).mount('#app')
