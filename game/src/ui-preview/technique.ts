import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import TechniquePreview from './TechniquePreview.vue'
import { techniqueMessages } from './techniqueMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(TechniquePreview).use(createI18n({ legacy: false, locale: 'vi', messages: techniqueMessages })).mount('#app')
