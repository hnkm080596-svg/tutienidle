import {createApp} from 'vue'
import {createI18n} from 'vue-i18n'
import InventoryPreview from './InventoryPreview.vue'
import {inventoryMessages} from './inventoryMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(InventoryPreview).use(createI18n({legacy:false,locale:'vi',messages:inventoryMessages})).mount('#app')
