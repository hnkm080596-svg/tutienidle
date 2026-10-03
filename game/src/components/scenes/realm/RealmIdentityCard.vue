<script setup lang="ts">
// Scene 05 realm-card region (spec: 1116/176/416/150, shell-panel
// family, surface-m-panel). Ref: ornate circular realm medallion left,
// realm name center, "Tang n/18" right.
import { useI18n } from 'vue-i18n'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'

defineProps<{
  realmName: string
  realmLevel: number
  maxLevel: number
  playerName: string
}>()

const { t } = useI18n()
</script>

<template>
  <div class="realm-card" data-hk-region="realm-card">
    <!-- Realm medallion (art-needed): crystal-mountain glyph inside an
         ornate gold ring; temp uses the delivered 'realm' symbol. -->
    <span class="realm-card__medallion art-needed" data-art-id="realm-medallion" aria-hidden="true">
      <HuyenKimSymbol name="realm" />
    </span>
    <div class="realm-card__identity">
      <strong class="realm-card__realm">{{ realmName }}</strong>
      <span class="realm-card__player">{{ playerName }}</span>
    </div>
    <span class="realm-card__tier">{{ t('panels.realm.tierOf', { level: realmLevel, max: maxLevel }) }}</span>
  </div>
</template>

<style scoped>
.realm-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}
.realm-card__medallion {
  flex: 0 0 auto;
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid var(--hk-gold-muted, #7a6234);
  background: radial-gradient(circle at 42% 32%, #2a453c, #101718 74%);
  box-shadow:
    0 0 0 3px var(--hk-surface-base, #0b0f0d),
    0 0 12px var(--hk-glow-jade, rgba(63, 166, 139, 0.35));
}
.realm-card__medallion .hk-symbol { width: 55%; height: 55%; background: var(--hk-jade-soft, #67c4ab); }
.realm-card__identity { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.realm-card__realm {
  color: var(--hk-text-primary, #ede6d6);
  font: 700 var(--text-title) var(--font-display, serif);
  letter-spacing: 0.05em;
}
.realm-card__player { color: var(--hk-text-muted, #7a7260); font-size: var(--text-xs); }
.realm-card__tier {
  margin-left: auto;
  flex: 0 0 auto;
  color: var(--hk-jade, #3fa68b);
  font: 700 var(--text-sm) var(--font-display, serif);
  font-variant-numeric: tabular-nums;
}
</style>
