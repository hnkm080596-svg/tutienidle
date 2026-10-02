<script setup lang="ts">
// Scene 02 Kỹ Năng Khởi Đầu slot — RESERVED (audit R00 / spec
// `starter-slot` 988/716/564/56): the full-product architecture keeps the
// region, but beta renders nothing because the starter is fixed to
// `linh_bao` (BETA_MORTAL_STARTER_SKILL_ID). `visible` stays false in beta;
// flip it post-beta when a starter-skill read-model lands.
import { useI18n } from 'vue-i18n'
import CreationSectionHeader from './CreationSectionHeader.vue'

withDefaults(defineProps<{ visible?: boolean }>(), { visible: false })
const { t } = useI18n()
</script>

<template>
  <section
    v-if="visible"
    class="creation-starter-slot"
    data-hk-region="starter-slot"
  >
    <CreationSectionHeader icon="skill" :title="t('onboarding.creation.starterSlot.title')" />
    <div
      class="creation-starter-slot__banner art-needed"
      data-art-id="starter-slot-banner"
    >
      <span>{{ t('onboarding.creation.starterSlot.pending') }}</span>
    </div>
  </section>
</template>

<style scoped>
.creation-starter-slot {
  flex: 0 0 auto;
  margin-bottom: clamp(4px, 1vh, 8px);
}

/* Muted banner placeholder (ref: dim brush/mountain bar under the section
   header while the pick is unavailable). */
.creation-starter-slot__banner {
  display: grid;
  place-items: center;
  min-height: 40px;
  border: 1px solid var(--hk-border-muted, rgba(122, 98, 52, 0.42));
  border-radius: 3px;
  background:
    radial-gradient(120% 160% at 88% 100%, rgba(185, 154, 85, 0.14), transparent 55%),
    linear-gradient(170deg, #1b2621, #101718);
  color: var(--hk-text-muted, #7a7260);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
}
</style>
