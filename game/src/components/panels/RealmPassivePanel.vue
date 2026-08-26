<script setup lang="ts">
// Realm Passive & Pressure System (2026-08-20) — tách khỏi
// CharacterPanel.vue theo đúng yêu cầu ("Realm Passive" giờ có panel
// riêng, cùng pattern SkillPathPanel.vue/TechniquePanel.vue). Gộp 2 nội
// dung vào 1 panel: (1) lưới Passive Cảnh Giới CŨ dời NGUYÊN VẸN từ
// CharacterPanel.vue (skill passive theo tâm pháp, xem
// composables/usePassiveRows.ts), (2) Nhập Đạo/Kiến Cơ MỚI (stat
// modifier theo Breakthrough Grade/Loại Trúc Cơ, xem
// composables/useRealmStatPassives.ts) — "hệ thống đang bỏ trống" mà
// panel này lấp đầy.
import { useUiStore } from '@/stores/ui'
import SlotView from '../common/SlotView.vue'
import { usePassiveRows } from '@/composables/usePassiveRows'
import { useRealmStatPassives } from '@/composables/useRealmStatPassives'

const ui = useUiStore()
const { passiveRows } = usePassiveRows()
const { realmStatPassiveRows } = useRealmStatPassives()

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <div v-if="ui.standalonePanel === 'realm_passive'" class="realm-passive-panel" @click.self="close">
    <div class="realm-passive-panel__card">
      <div class="realm-passive-panel__header">
        <h3 class="realm-passive-panel__title">Realm Passive</h3>

        <button type="button" class="realm-passive-panel__close" @click="close">✕</button>
      </div>

      <div class="realm-passive-panel__section">
        <h5 class="realm-passive-panel__section-title">Nhập Đạo / Kiến Cơ</h5>

        <div v-if="realmStatPassiveRows.length > 0" class="realm-passive-panel__stat-list">
          <div v-for="row in realmStatPassiveRows" :key="row.id" class="realm-passive-panel__stat-card">
            <div class="realm-passive-panel__stat-name">{{ row.name }}</div>
            <div class="realm-passive-panel__stat-desc">{{ row.description }}</div>
            <div v-if="row.effectLines.length > 0" class="realm-passive-panel__stat-effects">
              <span v-for="line in row.effectLines" :key="line">{{ line }}</span>
            </div>
          </div>
        </div>

        <p v-else class="realm-passive-panel__empty">Chưa đột phá đại cảnh giới nào để nhận Realm Passive.</p>
      </div>

      <div class="realm-passive-panel__section">
        <h5 class="realm-passive-panel__section-title">Passive Cảnh Giới</h5>

        <div class="passive-grid">
          <SlotView
            v-for="row in passiveRows"
            :key="row.skillId"
            class="passive-grid__slot"
            :item="row.unlocked ? row : null"
            :label="row.name"
            :description="`${row.realmName} — ${row.description}`"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.realm-passive-panel {
  position: absolute;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 13, 0.72);
}

.realm-passive-panel__card {
  width: min(560px, 90%);
  max-height: 85%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px;
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  color: var(--text-primary);
}

.realm-passive-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.realm-passive-panel__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  color: var(--gold-500);
}

.realm-passive-panel__close {
  width: 24px;
  height: 24px;
  padding: 0;
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.realm-passive-panel__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.realm-passive-panel__section-title {
  margin: 0;
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--gold-500);
}

.realm-passive-panel__stat-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.realm-passive-panel__stat-card {
  padding: 8px 10px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
}

.realm-passive-panel__stat-name {
  font-weight: 600;
  color: var(--gold-500);
  font-size: 0.85rem;
}

.realm-passive-panel__stat-desc {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: 2px;
}

.realm-passive-panel__stat-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 6px;
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.realm-passive-panel__empty {
  color: var(--text-muted);
  font-size: 0.8rem;
  text-align: center;
  padding: 8px 4px;
  margin: 0;
}

.passive-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.passive-grid__slot {
  flex: 0 0 44px;
  width: 44px;
}
</style>
