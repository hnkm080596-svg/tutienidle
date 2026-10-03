import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import VictoryPreview from './VictoryPreview.vue'
import { victoryMessages } from './victoryMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(VictoryPreview).use(createI18n({legacy:false,locale:'vi',messages:victoryMessages})).mount('#app')
