<script setup lang="ts">
// UI redesign (spec mục 3/24 — Top bar) — chỉ Menu/Tài nguyên chính/
// Cảnh giới/Settings, KHÔNG có tiêu đề "Động Phủ" to trên màn hình.
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import IconButton from '../common/IconButton.vue'
import ResourceDisplay from '../common/ResourceDisplay.vue'

const player = usePlayerStore()
const ui = useUiStore()

const realmLabel = computed(() => `${getCurrentRealm(player.realmId).name} · Tầng ${player.realmLevel}`)
</script>

<template>
  <div class="home-topbar">
    <IconButton label="Menu" @click="ui.toggleNavMenu()">
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <line x1="3" y1="5" x2="17" y2="5" />
        <line x1="3" y1="10" x2="17" y2="10" />
        <line x1="3" y1="15" x2="17" y2="15" />
      </svg>
    </IconButton>

    <div class="home-topbar__right">
      <span class="home-topbar__realm">{{ realmLabel }}</span>

      <div class="home-topbar__divider" />

      <ResourceDisplay :amount="player.spiritStone" label="Linh Thạch" />

      <div class="home-topbar__divider" />

      <IconButton label="Cài Đặt" @click="ui.leftPanelMode = 'settings'">
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="10" cy="10" r="2.6" />
          <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1L4.7 4.7" stroke-linecap="round" />
        </svg>
      </IconButton>
    </div>
  </div>
</template>

<style scoped>
.home-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 var(--space-4);
  background: rgba(10, 10, 13, 0.55);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--ink-line-soft);
  font-family: var(--font-body);
}

.home-topbar__right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.home-topbar__realm {
  font-family: var(--font-display);
  font-weight: 700;
  /* WS4 — nhãn cảnh giới là nội dung chính: >= --text-body (14px). */
  font-size: var(--text-body);
  color: var(--gold-300);
  letter-spacing: 0.02em;
}

.home-topbar__divider {
  width: 1px;
  height: 16px;
  background: var(--ink-line);
}
</style>
