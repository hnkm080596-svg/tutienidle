<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { getTalentDefinition } from '@/data/talent/Talents'
import { TALENT_RARITY_LABELS, type TalentDefinition, type TalentRarity } from '@/core/talent/Talent'
import SysTag from '@/components/common/system/SysTag.vue'
import CharacterSectionPlaque from './CharacterSectionPlaque.vue'

// talent-seals region: the Thien Phu band under the identity header -
// the Dao-direction chosen at creation, rendered as HK seal chips.
const { t } = useI18n()
const player = usePlayerStore()

const selectedTalents = computed(() =>
  player.selectedTalentIds
    .map((talentId) => getTalentDefinition(talentId))
    .filter((talent): talent is TalentDefinition => talent !== undefined),
)

// M-UI-SYSTEM - talent rarity tag -> SysTag tone: the tier is carried by
// the glyph shape + label text (color only reinforces, spec 7.3).
const TALENT_RARITY_TONE: Record<TalentRarity, 'muted' | 'success' | 'cyan' | 'violet' | 'warn'> = {
  pham: 'muted',
  linh: 'success',
  dia: 'cyan',
  thien: 'violet',
  di: 'warn',
}
</script>

<template>
  <section
    v-if="selectedTalents.length > 0"
    class="talent-seals"
    data-hk-region="talent-seals"
  >
    <CharacterSectionPlaque :title="t('panels.character.sections.talents')" />

    <div class="talent-seals__row">
      <span
        v-for="talent in selectedTalents"
        :key="talent.id"
        class="talent-seal"
        :class="`talent-tier-${talent.rarity}`"
        v-tooltip="talent.description"
      >
        <span
          class="talent-seal__icon art-needed"
          :data-art-id="`talent-seal-glyph-${talent.rarity}`"
          aria-hidden="true"
        />
        <span class="talent-seal__body">
          <span class="talent-seal__head">
            <SysTag :tone="TALENT_RARITY_TONE[talent.rarity]" class="talent-seal__rarity">{{ TALENT_RARITY_LABELS[talent.rarity] }}</SysTag>
            <span class="talent-seal__name">{{ talent.name }}</span>
          </span>
          <span class="talent-seal__desc">{{ talent.description }}</span>
        </span>
      </span>
    </div>
  </section>
</template>

<style scoped>
.talent-seals {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.talent-seals__row {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--hk-space-3, 8px);
  min-height: 0;
}

/* Seal chip: tier-tinted border + rarity chip + name + one-line desc.
   Tier colors keep the existing --rank-color-* ladder (creation vocab). */
.talent-seal {
  display: inline-flex;
  align-items: center;
  gap: var(--hk-space-3, 8px);
  padding: 5px 12px 5px 6px;
  border: 1px solid color-mix(in srgb, var(--talent-tier-color, var(--hk-gold-muted)) 70%, transparent);
  border-radius: var(--radius-sm);
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--talent-tier-color, var(--hk-gold-muted)) 14%, transparent), transparent 60%),
    color-mix(in srgb, var(--talent-tier-color, var(--hk-gold-muted)) 8%, var(--paper-100));
  cursor: default;
}

/* Temp art: octagonal seal glyph tinted by tier (one asset per tier). */
.talent-seal__icon {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%);
  background:
    radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--talent-tier-color, #b99a55) 90%, #fff 10%), color-mix(in srgb, var(--talent-tier-color, #b99a55) 55%, #101718) 80%);
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.35);
}

.talent-seal__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.talent-seal__head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.talent-seal__rarity.sys-tag {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--talent-tier-color, var(--hk-gold));
  --sys-tag-line: color-mix(in srgb, var(--talent-tier-color, var(--hk-gold)) 70%, transparent);
}

.talent-seal__name {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--paper-text);
  white-space: nowrap;
}

.talent-seal__desc {
  font-size: var(--text-xs);
  color: var(--paper-text-muted);
  max-width: 34ch;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.talent-tier-pham { --talent-tier-color: var(--rank-color-1); }
.talent-tier-linh { --talent-tier-color: var(--rank-color-3); }
.talent-tier-dia { --talent-tier-color: var(--rank-color-5); }
.talent-tier-thien { --talent-tier-color: var(--rank-color-7); }
.talent-tier-di { --talent-tier-color: var(--rank-color-8); }
</style>
