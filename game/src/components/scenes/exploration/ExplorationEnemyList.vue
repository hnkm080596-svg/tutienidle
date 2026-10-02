<script setup lang="ts">
// Scene 09 scaffold - "Dich Xuat Hien" enemy section of the detail
// panel. Contract: render ONLY model.displayEnemy (the roster-filtered
// dominant species, or the boss on boss floors) - never the raw pool.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Stage } from '@/core/stage/Stage'
import type { StageSurfaceModel } from '@/core/game/GameManagerStageOps'

const props = defineProps<{
  stage: Stage
  model: StageSurfaceModel | undefined
}>()

const { t } = useI18n()

const ARCHETYPE_LABEL_KEYS: Record<string, string> = {
  melee: 'panels.stageSelect.archetypes.melee',
  ranged: 'panels.stageSelect.archetypes.ranged',
  caster: 'panels.stageSelect.archetypes.caster',
  tank: 'panels.stageSelect.archetypes.tank',
}

const enemy = computed(() => props.model?.displayEnemy)
</script>

<template>
  <section class="exploration-enemies">
    <h5 class="exploration-section-label">{{ t('panels.stageSelect.sections.enemies') }}</h5>

    <div class="stage-select__encounter-summary">
      <span><strong>{{ props.stage.totalEnemyCount }}</strong> {{ t('panels.stageSelect.labels.enemiesSuffix') }}</span>
      <span v-if="props.model?.isBossFloor && enemy" class="is-boss">{{ t('panels.stageSelect.labels.bossNamePrefix') }} <strong>{{ enemy.name }}</strong></span>
    </div>

    <div v-if="enemy" class="stage-select__enemy-list">
      <article class="stage-select__enemy">
        <span class="stage-select__enemy-sigil art-needed" data-art-id="exploration-enemy-portrait">{{ enemy.name.charAt(0) }}</span>
        <span>
          <strong>{{ enemy.name }}</strong>
          <small>
            <template v-if="enemy.level">{{ t('panels.stageSelect.labels.levelPrefix', { level: enemy.level }) }} · </template>{{ t(ARCHETYPE_LABEL_KEYS[enemy.archetype ?? 'melee'] ?? 'panels.stageSelect.archetypes.melee') }}
          </small>
        </span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.exploration-enemies { display: flex; flex-direction: column; gap: 6px; }

.exploration-section-label {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-muted);
  letter-spacing: .1em;
  text-transform: uppercase;
}

.stage-select__encounter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.stage-select__encounter-summary span {
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--scene-portal-glow) 28%, var(--paper-line));
  border-radius: 999px;
  background: color-mix(in srgb, var(--scene-portal-glow) 8%, var(--paper-100));
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}
.stage-select__encounter-summary .is-boss { border-color: color-mix(in srgb, var(--crimson) 45%, transparent); color: var(--crimson); }

.stage-select__enemy-list { display: flex; flex-direction: column; gap: 5px; }
.stage-select__enemy {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--scene-portal-glow) 5%, var(--paper-100));
}
.stage-select__enemy-sigil {
  display: grid;
  flex: 0 0 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--paper-50) 24%, transparent), transparent 62%),
    color-mix(in srgb, var(--scene-portal-accent) 45%, var(--brush-950));
  color: var(--paper-50);
  font-family: var(--font-display);
}
.stage-select__enemy > span:last-child { min-width: 0; display: flex; flex-direction: column; }
.stage-select__enemy strong { font-size: var(--text-sm); }
.stage-select__enemy small { color: var(--paper-text-muted); font-size: var(--text-xs); }
</style>
