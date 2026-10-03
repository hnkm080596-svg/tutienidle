<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

// identity-header region: avatar + name/seal + realm line on the left,
// the "Chien Luc" plaque on the right. Mon Phai / Danh Hieu rows in the
// reference are INVALID (no sect/title domain) so they are not built.
const { t } = useI18n()
const player = usePlayerStore()

const realm = computed(() => getCurrentRealm(player.realmId))
const avatarFrameUrl = hkChromeUrl('avatar-frame')

// Display-only aggregate (same illustrative formula the panel carried).
const combatPower = computed(() => {
  const stats = player.finalStats
  return Math.round(
    stats.might * 2 +
    stats.defense * 1.5 +
    stats.maxHp * 0.1 +
    stats.maxMp * 0.05 +
    stats.criticalRate * 500 +
    stats.criticalDamage * 300 +
    stats.speed * 200,
  )
})
</script>

<template>
  <header class="identity-header" data-hk-region="identity-header">
    <div class="identity-header__avatar">
      <img
        v-if="avatarFrameUrl"
        class="identity-header__avatar-frame"
        :src="avatarFrameUrl"
        alt=""
        aria-hidden="true"
      />
      <PlayerPortrait
        class="identity-header__portrait"
        variant="portrait"
        :height="52"
      />
    </div>

    <div class="identity-header__text">
      <div class="identity-header__name-row">
        <h3 class="identity-header__name" data-testid="character-name">{{ player.name }}</h3>
        <span
          class="identity-header__seal art-needed"
          data-art-id="character-name-seal"
          aria-hidden="true"
        />
      </div>
      <p class="identity-header__realm" data-testid="character-realm-line">
        {{ realm.name }} · {{ t('panels.character.labels.realmFloor') }} {{ player.realmLevel }}
      </p>
    </div>

    <div class="identity-header__power art-needed" data-art-id="combat-power-plaque">
      <span class="identity-header__power-emblem art-needed" data-art-id="combat-power-emblem" aria-hidden="true">
        <span class="identity-header__power-sword" />
        <span class="identity-header__power-sword identity-header__power-sword--r" />
      </span>
      <span class="identity-header__power-text">
        <span class="identity-header__power-label">{{ t('panels.character.labels.combatPower') }}</span>
        <span class="identity-header__power-value">{{ formatNumber(combatPower) }}</span>
      </span>
    </div>
  </header>
</template>

<style scoped>
.identity-header {
  display: flex;
  align-items: center;
  gap: var(--hk-space-4, 12px);
  min-height: 0;
  padding: var(--hk-space-2, 4px) var(--hk-space-3, 8px);
}

.identity-header__avatar {
  position: relative;
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
}

.identity-header__avatar-frame {
  position: absolute;
  inset: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  object-fit: contain;
  pointer-events: none;
  z-index: 1;
}

.identity-header__portrait {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: end center;
  background: radial-gradient(circle at 50% 40%, #43584f, #1c2624 78%);
}

.identity-header__portrait :deep(img) {
  height: 52px;
}

.identity-header__text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.identity-header__name-row {
  display: flex;
  align-items: center;
  gap: var(--hk-space-3, 8px);
  min-width: 0;
}

.identity-header__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-title);
  font-weight: 700;
  color: var(--paper-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Temp art: cinnabar name seal stamp (carved ivory glyph square). */
.identity-header__seal {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  background: linear-gradient(160deg, #c25a44, #8e3226 70%);
  box-shadow:
    inset 0 0 0 1.5px rgba(237, 230, 214, 0.55),
    inset 0 0 4px rgba(0, 0, 0, 0.45),
    0 1px 2px rgba(0, 0, 0, 0.4);
}

.identity-header__realm {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--jade);
}

/* Temp art: the ornate dark power plaque + crossed-swords emblem. */
.identity-header__power {
  margin-left: auto;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--hk-space-3, 8px);
  padding: 6px 16px;
  border: 1px solid var(--hk-gold-muted, #7a6234);
  border-radius: var(--hk-radius-md, 8px);
  background:
    linear-gradient(170deg, rgba(185, 154, 85, 0.16), transparent 45%),
    linear-gradient(180deg, #1b2422, #101718 80%);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.55),
    inset 0 0 14px rgba(185, 154, 85, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.35);
}

.identity-header__power-emblem {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--hk-gold-muted, #7a6234);
  background: radial-gradient(circle at 40% 35%, #2c3a36, #101718 75%);
}

.identity-header__power-sword,
.identity-header__power-sword--r {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2.5px;
  height: 20px;
  border-radius: 2px;
  background: linear-gradient(var(--hk-gold-radiant, #f4d98b), #b99a55);
}
.identity-header__power-sword { transform: translate(-50%, -50%) rotate(42deg); }
.identity-header__power-sword--r { transform: translate(-50%, -50%) rotate(-42deg); }

.identity-header__power-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.05;
}

.identity-header__power-label {
  font-size: var(--text-xs);
  color: var(--paper-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.identity-header__power-value {
  font-family: var(--sys-font-display, var(--font-display));
  font-variant-numeric: tabular-nums;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--hk-gold-bright, #e8c35a);
  text-shadow: 0 0 10px rgba(185, 154, 85, 0.45);
}
</style>
