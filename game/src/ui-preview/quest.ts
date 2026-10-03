import {createApp} from 'vue'
import {createI18n} from 'vue-i18n'
import QuestPreview from './QuestPreview.vue'
import {remainingMessages} from './remainingMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(QuestPreview).use(createI18n({legacy:false,locale:'vi',messages:remainingMessages})).mount('#app')
