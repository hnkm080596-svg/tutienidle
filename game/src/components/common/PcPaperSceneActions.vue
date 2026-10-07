<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PcPaperButton from './PcPaperButton.vue'
import type { PaperNavigationItem } from './PaperPanelNavigation.vue'

defineProps<{ items: readonly PaperNavigationItem[]; active: string }>()
const emit = defineEmits<{ navigate: [id: string]; back: [] }>()
const { t } = useI18n()
const open = ref(false)
const trigger = ref<InstanceType<typeof PcPaperButton> | null>(null)
function closeMenu() {
  open.value = false
  const element = trigger.value?.$el
  if (element instanceof HTMLButtonElement) element.focus()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  event.stopPropagation()
  closeMenu()
}
function navigate(item: PaperNavigationItem) {
  if (item.locked) return
  open.value = false
  emit('navigate', item.id)
}
</script>

<template>
  <nav class="pc-paper-scene-actions" :aria-label="t('paperNav.navigation')" @keydown="onKeydown">
    <PcPaperButton variant="secondary" @click="emit('back')">{{ t('pcUi.back') }}</PcPaperButton>
    <PcPaperButton ref="trigger" variant="secondary" :aria-expanded="open" @click="open = !open">{{ t('paperNav.navigation') }}</PcPaperButton>
    <div v-if="open" class="pc-paper-scene-actions__menu">
      <button v-for="item in items" :key="item.id" type="button" :data-nav-id="item.id" :aria-current="item.id === active ? 'page' : undefined" :aria-disabled="item.locked || undefined" @click="navigate(item)"><img :src="item.icon" alt=""><span>{{ item.label }}</span></button>
    </div>
  </nav>
</template>

<style scoped>
.pc-paper-scene-actions { display:flex;gap:12px; }
.pc-paper-scene-actions>.pc-paper-button { min-height:38px;font-size:17px;padding:8px 20px; }
.pc-paper-scene-actions__menu { position:absolute;right:0;top:48px;width:300px;max-height:620px;overflow:auto;background:#f5e8cd;border:3px double #b28a43;box-shadow:0 10px 25px #2a211744; }
.pc-paper-scene-actions__menu button { display:flex;align-items:center;gap:14px;width:100%;border:0;border-bottom:1px solid #b28a4355;background:transparent;color:#302718;padding:12px 18px;font:18px var(--pc-font-body);text-align:left;cursor:pointer; }
.pc-paper-scene-actions__menu img { width:28px;height:28px;object-fit:contain; }
.pc-paper-scene-actions__menu [aria-current=page] { background:#d3ae6038; }
.pc-paper-scene-actions__menu [aria-disabled=true] { opacity:.55;cursor:default; }
.pc-paper-scene-actions__menu button:focus-visible { outline:2px solid #765324;outline-offset:-3px; }
</style>
