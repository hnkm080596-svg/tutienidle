<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const { t } = useI18n()
const art = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/combat/item-slot-v1.png')
</script>
<template>
  <div class="combat-item-pending" tabindex="0" v-tooltip="{ title: t('combat.overlay.pending.item'), description: t('combat.overlay.pending.hint') }">
    <button type="button" disabled :aria-label="t('combat.overlay.pending.item')"><img :src="art" alt="" aria-hidden="true"><span>{{ t('combat.overlay.pending.item') }}</span></button>
  </div>
</template>
<style scoped>
.combat-item-pending { position: absolute; left: 24px; bottom: 28px; width: 92px; height: 104px; pointer-events: auto; }
.combat-item-pending button { width: 100%; height: 100%; padding: 0; border: 0; background: transparent; color: #e6d5ad; opacity: .45; filter: grayscale(1); }
.combat-item-pending img { display: block; width: 92px; height: 92px; object-fit: contain; clip-path: circle(44%); }
.combat-item-pending span { font: 12px/1 var(--font-display); }
.combat-item-pending:focus-visible { outline: 2px solid #f3d58a; outline-offset: 3px; }
</style>
