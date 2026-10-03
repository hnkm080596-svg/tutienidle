import {createApp} from 'vue'
import {createI18n} from 'vue-i18n'
import ForgePreview from './ForgePreview.vue'
import {forgeMessages} from './forgeMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(ForgePreview).use(createI18n({legacy:false,locale:'vi',messages:forgeMessages})).mount('#app')
