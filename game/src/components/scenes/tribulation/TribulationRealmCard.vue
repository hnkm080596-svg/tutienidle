<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GameCard from '@/components/common/GameCard.vue'

defineProps<{
  realmName: string
  chapterProgress: string
  strikesTaken: number
}>()
const { t } = useI18n()
</script>

<template>
  <GameCard as="section" class="tribulation-realm-card" data-hk-region="realm-card">
    <div class="tribulation-realm-card__inner">
      <span class="tribulation-realm-card__ornament" aria-hidden="true" />
      <h1 class="tribulation-realm-card__title">
        {{ t('tribulation.overlay.realmCardTitle', { name: realmName }) }}
      </h1>
      <span class="tribulation-realm-card__ornament" aria-hidden="true" />
    </div>
  </GameCard>
</template>

<style scoped>
.tribulation-realm-card {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: min(460px, 84vw);
  padding: 10px 24px;
  text-align: center;
  isolation: isolate;
}

.tribulation-realm-card__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.tribulation-realm-card__ornament {
  width: 6px;
  height: 6px;
  transform: rotate(45deg);
  background: rgba(213, 183, 116, 0.75);
  box-shadow: 0 0 6px rgba(213, 183, 116, 0.45);
}

.tribulation-realm-card__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #f3e7bd;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.75);
}
</style>
