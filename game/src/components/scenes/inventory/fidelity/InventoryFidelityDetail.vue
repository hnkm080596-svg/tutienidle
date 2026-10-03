<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {resolveAssetUrl} from '@/presentation/assets/AssetBaseUrl'
import type {InventoryDisplay} from './inventoryUi'
defineProps<{item:InventoryDisplay}>()
const emit=defineEmits<{use:[id:string]}>()
const {t}=useI18n()
const frame=resolveAssetUrl('/assets/ui/huyen-kim/scene/dong-fu-v2/panel-nine-slice.png')
</script>
<template><aside class="item-detail" :style="{borderImageSource:`url('${frame}')`}"><h3>{{t('inventoryPreview.details')}}</h3><img class="item-art" :src="item.icon" :alt="item.name"><h2>{{item.name}}</h2><p class="quality">{{t('inventoryPreview.quality')}} · {{t(`inventoryPreview.${item.category}`)}}</p><div class="rule"/><p class="description">{{item.description}}</p><p class="amount">{{t('inventoryPreview.amount')}}<b>{{item.amount}}</b></p><button @click="emit('use',item.id)">{{t('inventoryPreview.use')}}</button></aside></template>
<style scoped>
.item-detail{height:100%;width:310px;box-sizing:border-box;padding:25px 29px;border:0 solid transparent;border-image-slice:360 fill;border-image-width:29px;color:#eed6a2;text-align:center;filter:drop-shadow(0 4px 6px #36281c44)}h3{margin:0;font-size:17px;letter-spacing:2px}.item-art{display:block;width:100px;height:100px;object-fit:contain;margin:20px auto 13px;filter:drop-shadow(0 4px 9px #000)}h2{font-size:25px;margin:0}.quality{font-size:12px;color:#9cc9a4;margin:8px 0 18px}.rule{height:1px;background:linear-gradient(90deg,transparent,#b99a56,transparent)}.description{font-size:14px;line-height:1.8;text-align:left;color:#d3c7a9}.amount{display:flex;justify-content:space-between;font-size:13px;color:#bfbb9d;margin:19px 0}button{width:100%;height:43px;border:1px solid #c5a465;color:#342712;background:linear-gradient(#efd698,#bc8e43);font:700 18px var(--font-display,Georgia,serif);cursor:pointer}button:hover{filter:brightness(1.12)}button:focus-visible{outline:2px solid #eaca83;outline-offset:3px}
.item-detail{display:flex;flex-direction:column;gap:8px;padding:23px 28px}.item-art{width:80px;height:80px;margin:0 auto}.item-detail h3{font-size:15px}.item-detail h2{font-size:23px}.quality{margin:0;font-size:11px}.description{margin:0;font-size:13px;line-height:1.7}.amount{margin:0}.item-detail button{margin-top:auto;min-height:40px;height:40px}.rule{flex-shrink:0}
</style>
