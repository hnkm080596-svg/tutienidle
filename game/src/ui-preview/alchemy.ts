import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import AlchemyPreview from './AlchemyPreview.vue'
import { alchemyMessages } from './alchemyMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(AlchemyPreview).use(createI18n({ legacy: false, locale: 'vi', messages: alchemyMessages })).mount('#app')
