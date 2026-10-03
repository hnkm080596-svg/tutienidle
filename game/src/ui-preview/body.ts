import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import BodyPreview from './BodyPreview.vue'
import { bodyMessages } from './bodyMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(BodyPreview).use(createI18n({legacy:false,locale:'vi',messages:bodyMessages})).mount('#app')
