<script setup lang="ts">
// Scene 09 zone-rail region (spec 288/176/140/560, navigation family,
// nav-seal-vertical chrome): one hanging zone card per real zone. The
// beta ships a single zone; the rail stays RESERVED for expansion, so
// locked zones render dimmed and inert rather than hidden.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Zone } from '@/core/stage/Zone'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

defineProps<{
  zones: Zone[]
  selectedZoneId: string | null
  isZoneUnlocked: (zoneId: string) => boolean
}>()

const emit = defineEmits<{ (e: 'select-zone', zoneId: string): void }>()

const { t } = useI18n()
const sealArt = computed(() => hkChromeUrl('nav-seal-vertical'))
</script>

<template>
  <nav
    class="exploration-zone-rail"
    data-hk-region="zone-rail"
    data-art-id="exploration-zone-rail"
    :aria-label="t('panels.stageSelect.labels.zoneFilter')"
  >
    <ul class="exploration-zone-rail__list">
      <li v-for="zone in zones" :key="zone.id" class="exploration-zone-rail__item">
        <button
          type="button"
          class="exploration-zone-card"
          :class="{
            'is-active': zone.id === selectedZoneId,
            'is-locked': !isZoneUnlocked(zone.id),
          }"
          :aria-pressed="zone.id === selectedZoneId"
          :disabled="!isZoneUnlocked(zone.id)"
          :title="zone.name"
          @click="emit('select-zone', zone.id)"
        >
          <img
            v-if="sealArt"
            class="exploration-zone-card__art"
            :src="sealArt"
            alt=""
            aria-hidden="true"
          />
          <span
            v-else
            class="exploration-zone-card__art-fallback"
            art-needed
            data-art-id="nav-seal-vertical"
            aria-hidden="true"
          />
          <span class="exploration-zone-card__label">{{ zone.name }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.exploration-zone-rail {
  height: 100%;
  min-height: 0;
  border-right: 1px solid var(--paper-line);
}

.exploration-zone-rail__list {
  height: 100%;
  margin: 0;
  padding: 8px 4px;
  list-style: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, 0.9cqh, 12px);
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
}
.exploration-zone-rail__list::-webkit-scrollbar { display: none; }

.exploration-zone-rail__item {
  flex: 0 0 auto;
  width: min(100%, 96px);
  display: flex;
  justify-content: center;
}

/* Hanging-seal zone card - same nav-seal-vertical treatment as the
   equipment ops rail. */
.exploration-zone-card {
  position: relative;
  width: min(100%, 84px);
  aspect-ratio: 96 / 128;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 9% 8%;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--hk-text-muted, #b8ad97);
  transition: transform 0.16s ease, color 0.16s ease, filter 0.16s ease;
}

.exploration-zone-card__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  opacity: 0.82;
  transition: opacity 0.16s ease;
}

.exploration-zone-card__art-fallback {
  position: absolute;
  inset: 0;
  border: 1px solid var(--hk-border-muted, var(--paper-line));
  border-radius: var(--hk-radius-sm, 6px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--hk-jade, #315f55) 34%, transparent), transparent 60%),
    var(--hk-surface-raised, var(--ink-800, #1a2320));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hk-gold-muted, #b99a55) 25%, transparent);
  opacity: 0.82;
}

.exploration-zone-card__label {
  position: relative;
  writing-mode: vertical-rl;
  max-height: 82%;
  font-size: clamp(9px, 0.8cqw, 11px);
  font-weight: 600;
  letter-spacing: 0.12em;
  line-height: 1;
  text-align: start;
  color: inherit;
  overflow: hidden;
  white-space: nowrap;
}

.exploration-zone-card:hover {
  transform: translateY(-2px);
  color: var(--hk-text-primary, #f2ead8);
}
.exploration-zone-card:hover .exploration-zone-card__art,
.exploration-zone-card:hover .exploration-zone-card__art-fallback { opacity: 1; }

.exploration-zone-card.is-active { color: var(--hk-gold, #e3bd67); }
.exploration-zone-card.is-active .exploration-zone-card__art,
.exploration-zone-card.is-active .exploration-zone-card__art-fallback {
  opacity: 1;
  filter: brightness(1.18) drop-shadow(0 0 6px rgba(227, 189, 103, 0.45));
}

.exploration-zone-card.is-locked { opacity: 0.55; cursor: not-allowed; }

.exploration-zone-card:focus-visible {
  outline: 2px solid var(--hk-gold, #d8b45a);
  outline-offset: 2px;
}
</style>
