<script setup lang="ts">
import { useId } from 'vue'
import '@/assets/pc-paper-scene.css'
import { pcPaperControlStyles } from '@/presentation/assets/PcPaperControls'
import PcPaperChrome from './PcPaperChrome.vue'

withDefaults(defineProps<{ title: string; width?: number }>(), { width: 680 })
const titleId = useId()
const controls = pcPaperControlStyles()
</script>

<template>
  <section class="pc-paper-dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" :style="{ ...controls, width: `${width}px` }">
    <PcPaperChrome />
    <header class="pc-paper-dialog__title"><h1 :id="titleId"><slot name="title">{{ title }}</slot></h1></header>
    <div class="pc-paper-dialog__body"><slot name="body"><slot /></slot></div>
    <footer v-if="$slots.footer" class="pc-paper-dialog__footer"><slot name="footer" /></footer>
  </section>
</template>

<style scoped>
.pc-paper-dialog { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); max-width: calc(100% - 90px); max-height: calc(100% - 70px); padding: 30px 36px 33px; display: flex; flex-direction: column; gap: 22px; isolation: isolate; color: #302718; font-family: var(--pc-font-body); filter: drop-shadow(0 10px 16px #16120955); }
.pc-paper-dialog__title { padding-bottom: 15px; border-bottom: 1px solid #b08b4d88; }
.pc-paper-dialog__title h1 { font: 700 34px/1.2 var(--pc-font-body); letter-spacing: -.025em; margin: 0; }
.pc-paper-dialog__body { min-height: 0; overflow: auto; }
.pc-paper-dialog__footer { display: flex; gap: 16px; align-items: center; justify-content: flex-end; }
.pc-paper-dialog__footer :deep(.pc-paper-button) { font-size: 18px; }
</style>
