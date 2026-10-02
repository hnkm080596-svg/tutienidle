<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { isActivePath } from '@/core/player/CultivationPathSystem'
import { isScopeHidden } from '@/core/betaScope'

// Action rail (footer zone): the Chi Tiet drawer toggle plus the
// contextual Quan Khi re-entry (Kiem Tu only - the breakthrough flow
// itself is unified under triggerBreakthroughAction()).
const { t } = useI18n()
const player = usePlayerStore()
const ui = useUiStore()

// P1 - the generic authority read resolves the committed pair through
// the catalog (fail closed on a way-less/corrupt pair). BETA SCOPE
// LOCK - a carried way_out_of_scope sword save keeps the path flag
// but the entry stays scope-hidden (the panel's editors are
// sword-way machinery).
const showQuanKhiEntry = computed(
  () => isActivePath(player, 'sword') && !isScopeHidden('swordPath'),
)

function openQuanKhi() {
  ui.openStandalonePanel('quan_khi')
}
</script>

<template>
  <footer class="character-action-rail">
    <button
      type="button"
      class="character-panel__details-btn"
      :class="{ 'character-panel__details-btn--open': ui.characterDetailOpen }"
      @click="ui.toggleCharacterDetail()"
    >{{ t('panels.character.actions.details') }}</button>

    <button
      v-if="showQuanKhiEntry"
      type="button"
      class="character-panel__quan-khi-btn"
      @click="openQuanKhi"
    >
      {{ t('panels.character.actions.quanKhi') }}
    </button>
  </footer>
</template>

<style scoped>
.character-action-rail {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--hk-space-3, 8px);
  padding: var(--hk-space-2, 4px) var(--hk-space-3, 8px) 0;
  border-top: 1px solid color-mix(in srgb, var(--paper-line) 70%, transparent);
}

.character-panel__details-btn {
  flex: 0 0 auto;
  padding: 4px 14px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: var(--paper-100);
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
  font-family: var(--font-body);
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.character-panel__details-btn:hover {
  color: var(--hk-gold-bright);
  border-color: var(--hk-gold-muted);
}

.character-panel__details-btn--open {
  color: var(--hk-gold-bright);
  border-color: var(--hk-gold);
  background: color-mix(in srgb, var(--hk-gold) 12%, var(--paper-100));
}

.character-panel__quan-khi-btn {
  align-self: flex-start;
  padding: 3px 10px;
  background: color-mix(in srgb, var(--hk-gold) 12%, var(--paper-100));
  color: var(--hk-gold-bright);
  border: 1px solid var(--hk-gold-muted);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-body);
  font-weight: 600;
  cursor: pointer;
}

.character-panel__quan-khi-btn:hover {
  border-color: var(--hk-gold);
  color: var(--hk-gold-radiant);
}
</style>
