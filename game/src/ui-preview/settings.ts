import {createApp} from 'vue'
import {createI18n} from 'vue-i18n'
import SettingsPreview from './SettingsPreview.vue'
import {settingsMessages} from './settingsMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(SettingsPreview).use(createI18n({legacy:false,locale:'vi',messages:settingsMessages})).mount('#app')
