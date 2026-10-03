import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import CharacterPreview from './CharacterPreview.vue'
import { characterMessages } from './characterMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(CharacterPreview).use(createI18n({ legacy: false, locale: 'vi', messages: characterMessages })).mount('#app')
