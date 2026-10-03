import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import CombatPreview from './CombatPreview.vue'
import { combatMessages } from './combatMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(CombatPreview).use(createI18n({ legacy: false, locale: 'vi', messages: combatMessages })).mount('#app')
