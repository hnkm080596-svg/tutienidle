import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import SkillPreview from './SkillPreview.vue'
import { skillMessages } from './skillMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(SkillPreview).use(createI18n({ legacy: false, locale: 'vi', messages: skillMessages })).mount('#app')
