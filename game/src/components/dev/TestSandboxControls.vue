<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { testSandboxActive, testSandboxAvailable, setTestSandboxMode } from '@/services/dev/testSandbox'

const props = defineProps<{ entryStage: string; leaveSandbox: () => Promise<void> }>()
const { t } = useI18n()
const busy = ref(false)
const error = ref('')

async function switchMode() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (testSandboxActive) await props.leaveSandbox()
    else {
      setTestSandboxMode(true)
      window.location.reload()
    }
  } catch {
    error.value = t('testSandbox.switchFailed')
    busy.value = false
  }
}
</script>

<template>
  <section
    v-if="testSandboxAvailable && (testSandboxActive || entryStage === 'auth')"
    class="test-sandbox-controls" data-testid="test-sandbox-controls"
    :aria-busy="busy"
  >
    <strong v-if="testSandboxActive">{{ t('testSandbox.badge') }}</strong>
    <button type="button" data-testid="test-sandbox-switch" @click="switchMode">
      {{ busy ? t('testSandbox.saving') : t(testSandboxActive ? 'testSandbox.leave' : 'testSandbox.enter') }}
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.test-sandbox-controls {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 250;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 24px);
  padding: 8px 12px;
  border: 1px solid #c9a66a;
  background: #211b15;
  color: #ffdf8e;
  font-size: 13px;
}
.test-sandbox-controls button {
  min-height: 36px;
  border: 1px solid #c9a66a;
  padding: 4px 12px;
  background: #33291e;
  color: inherit;
  cursor: pointer;
}
.test-sandbox-controls p { flex-basis: 100%; margin: 0; color: #ffb3a5; }
</style>
