<script setup lang="ts">
// Scene 08 figure-focus orb: one meridian node on the Kinh Mach ring.
// dao-luan-node family per spec - grayscale disc tinted by state (opened
// jade, next gold, locked ink), name + state line under the node.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const props = defineProps<{
  name: string
  status: 'done' | 'next' | 'locked'
}>()

const { t } = useI18n()
const nodeUrl = hkChromeUrl('dao-luan-node')

const stateLabel = computed(() =>
  props.status === 'done'
    ? t('panels.realm.meridian.stateOpened')
    : props.status === 'next'
      ? t('panels.realm.meridian.stateNext')
      : t('panels.realm.meridian.stateLocked'),
)
</script>

<template>
  <div class="body-orb" :class="`body-orb--${status}`" :title="name">
    <span class="body-orb__disc art-needed" :data-art-id="`body-orb-${status}`">
      <img v-if="nodeUrl" class="body-orb__art" :src="nodeUrl" alt="" aria-hidden="true" />
    </span>
    <span class="body-orb__name">{{ name }}</span>
    <span class="body-orb__state">{{ stateLabel }}</span>
  </div>
</template>

<style scoped>
.body-orb {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 54px;
}
.body-orb__disc {
  position: relative;
  width: clamp(30px, 3.4cqw, 44px);
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  border: 1px solid var(--hk-ink, #5b6266);
  background: radial-gradient(circle at 38% 32%, #1c2622 0%, var(--hk-surface-base, #0b0f0d) 72%);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 72%, transparent);
}
.body-orb__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  opacity: 0.7;
}
.body-orb__name {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--hk-text-secondary, #b8ae97);
  white-space: nowrap;
}
.body-orb__state {
  font-size: 10px;
  color: var(--hk-ink, #5b6266);
  white-space: nowrap;
}

.body-orb--done .body-orb__disc {
  border-color: var(--hk-jade, #3fa68b);
  box-shadow: 0 0 12px var(--hk-glow-jade, rgba(63, 166, 139, 0.55));
}
.body-orb--done .body-orb__name { color: var(--hk-jade, #3fa68b); }
.body-orb--done .body-orb__state { color: var(--hk-jade-soft, #67c4ab); }

.body-orb--next .body-orb__disc {
  border-color: var(--hk-gold, #b99a55);
  box-shadow: 0 0 12px var(--hk-glow-gold, rgba(232, 195, 90, 0.45));
}
.body-orb--next .body-orb__name { color: var(--hk-gold-radiant, #f4d98b); }
.body-orb--next .body-orb__state { color: var(--hk-gold, #b99a55); }
</style>
