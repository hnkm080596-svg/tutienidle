<script setup lang="ts">
// Scene 16/17 build-info section (support group) - read-only identity
// rows matching the release manifest.
import { useI18n } from 'vue-i18n'
import { BUILD_IDENTITY, shortGitSha } from '@/shared/build/BuildIdentity'
import SettingsSectionFrame from './SettingsSectionFrame.vue'

// BETA-FINAL PR1 - one read of the injected build identity (frozen; same
// literal the Electron main process logged).
const build = BUILD_IDENTITY
const BUILD_ROWS = [
  { labelKey: 'version', testid: 'build-version', value: build.appVersion },
  { labelKey: 'build', testid: 'build-id', value: build.buildId },
  { labelKey: 'commit', testid: 'build-commit', value: shortGitSha() },
  { labelKey: 'schema', testid: 'build-schema', value: build.saveSchemaVersion },
  { labelKey: 'environment', testid: 'build-environment', value: build.backendEnvironment },
  { labelKey: 'channel', testid: 'build-channel', value: build.releaseChannel },
  { labelKey: 'builtAt', testid: 'build-built-at', value: build.builtAtUtc },
] as const

const { t } = useI18n()
</script>

<template>
  <SettingsSectionFrame
    class="settings-panel__build"
    :title="t('panels.settings.sections.build')"
    :label="t('panels.settings.sections.buildAria')"
    data-hk-region="build"
  >
    <dl class="settings-panel__build-list">
      <div v-for="row in BUILD_ROWS" :key="row.testid" class="settings-panel__build-row">
        <dt>{{ t(`panels.settings.build.${row.labelKey}`) }}</dt>
        <dd :data-testid="row.testid">{{ row.value }}</dd>
      </div>
    </dl>
  </SettingsSectionFrame>
</template>

<style scoped>
.settings-panel__build-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-xs);
}
.settings-panel__build-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}
.settings-panel__build-row dt {
  color: var(--paper-text-soft);
}
.settings-panel__build-row dd {
  margin: 0;
  color: var(--paper-text);
  font-family: var(--font-mono, monospace);
  word-break: break-all;
  text-align: right;
}
</style>
