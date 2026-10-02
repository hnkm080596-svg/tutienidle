<script setup lang="ts">
// One Dao Luan wheel slot (scene 03 wheel region): the circular node
// disc + stable-art glyph + hanging caption + state accents (ring tint,
// upgrade dot, lock badge, breakthrough notification, ignition flash).
// All domain state is resolved by the wheel layer and passed in; this
// file owns only the node presentation.
import type { CommandWheelSlot } from '@/data/ui/commandWheelCatalog'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import NotificationBadge from '@/components/common/NotificationBadge.vue'

defineProps<{
  slot: CommandWheelSlot
  label: string
  symbol: StableSymbolId
  orbitIndex: number
  active: boolean
  upgradeable: boolean
  /** Disabled reason text; null when the slot is actionable. */
  disabledReason: string | null
  ignited: boolean
  breakthroughBadge: boolean
  /** Orbit transform vars from the layer (radius + start/end angles). */
  orbitStyle: Record<string, string>
  /** `dao-luan-node` chrome background-image style when the slot resolves. */
  nodeArt?: Record<string, string>
}>()

const emit = defineEmits<{
  activate: [slot: CommandWheelSlot]
}>()
</script>

<template>
  <button
    type="button"
    class="command-wheel__slot"
    :class="[
      `command-wheel__slot--ring${slot.ring}`,
      {
        'is-active': active,
        'is-upgradeable': upgradeable,
        'is-disabled': disabledReason,
        'is-ignited': ignited,
      },
    ]"
    :style="[orbitStyle, nodeArt]"
    :data-wheel-orbit="orbitIndex"
    :aria-label="label"
    :data-wheel-slot="slot.id"
    :aria-disabled="Boolean(disabledReason)"
    :art-needed="!nodeArt"
    data-art-id="dao-luan-node"
    v-tooltip="disabledReason ?? undefined"
    @click="emit('activate', slot)"
  >
    <HuyenKimSymbol :name="symbol" class="command-wheel__glyph" />
    <span class="command-wheel__label">{{ label }}</span>

    <span v-if="upgradeable" class="command-wheel__upgrade-dot" aria-hidden="true" />

    <!-- 2026-08-30 frontend-design pass - a locked slot used to differ
         only by dimmed opacity, easy to misread as "just darker" instead
         of "cannot be clicked yet". The bottom-right lock icon fills the
         only free corner (upgrade-dot/notification-badge own the top). -->
    <span v-if="disabledReason" class="command-wheel__lock-badge" aria-hidden="true"><HuyenKimSymbol name="lock" /></span>

    <NotificationBadge
      v-if="breakthroughBadge"
      variant="dot"
      class="command-wheel__notification-badge"
    />
  </button>
</template>

<style scoped>
.command-wheel__slot {
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  padding: 0;
  border: 1px solid var(--hk-border-muted, var(--frame-outer));
  border-radius: 999px;
  /* dao-luan-node chrome art lands via inline background-image when the
     slot is ready; this radial ink disc stays as the fallback. */
  background:
    radial-gradient(120% 120% at 50% 16%, var(--hk-surface-overlay, var(--ink-800)) 0%, var(--hk-surface-raised, var(--ink-900)) 72%);
  background-size: cover;
  box-shadow: 0 3px 10px var(--hk-shadow-low, rgba(0, 0, 0, 0.4));
  color: var(--hk-text-primary, var(--paper-text));
  font-family: var(--hk-font-ui, var(--font-body));
  font-size: var(--text-xs);
  line-height: var(--lh-tight);
  text-align: center;
  cursor: pointer;
  transform: rotate(var(--start-angle)) translateY(0) rotate(var(--start-counter-angle))
    translate(-50%, -50%);
  opacity: 0;
  transition:
    opacity 0.32s ease-out,
    transform 0.32s cubic-bezier(0.2, 0.75, 0.3, 1),
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: transform, opacity;
  -webkit-tap-highlight-color: transparent;
}

/* Huyen Kim S03: the label hangs BELOW the node disc (ref: node +
   caption), never wraps inside it - fixes the multi-line clip seen in
   the pre-fidelity state. */
.command-wheel__label {
  position: absolute;
  left: 50%;
  top: calc(100% + 4px);
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--hk-surface-base, var(--ink-950)) 78%, transparent);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  color: var(--hk-text-primary, var(--paper-text));
  font-size: 10px;
  line-height: 1.25;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}

.command-wheel__glyph {
  width: 24px;
  height: 24px;
  color: var(--hk-gold-bright, var(--mineral-gold));
}

.command-wheel__slot:hover,
.command-wheel__slot:focus-visible {
  border-color: var(--hk-gold, var(--cinnabar));
  color: var(--hk-gold-bright, var(--cinnabar));
}

.command-wheel__slot:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--hk-glow-gold, color-mix(in srgb, var(--cinnabar) 55%, transparent));
}

/* Ban Menh Phap Bao (2026-08-27) - the slot renders but cannot be
   clicked yet (disabledReason), completely different from "does not
   exist" (available=false renders no button at all). */
.command-wheel__slot.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.command-wheel__slot.is-disabled:hover,
.command-wheel__slot.is-disabled:focus-visible {
  border-color: var(--hk-border-muted, var(--frame-outer));
  color: var(--hk-ink, var(--paper-text));
}

/* Active state derives from uiStore (panel/popover currently open). */
.command-wheel__slot.is-active {
  border-color: var(--hk-gold, var(--mineral-gold));
  box-shadow: inset 0 0 0 2px var(--hk-border-active, var(--mineral-gold));
  color: var(--hk-text-primary, var(--paper-text));
}

/* Rune ignition (spec SS10.1) - one-shot gold flash when a slot's lock
   cleared since the previous wheel open. */
@keyframes dao-luan-ignite {
  0% {
    box-shadow:
      0 0 22px 4px var(--hk-glow-gold, rgba(232, 195, 90, 0.35)),
      inset 0 0 0 2px var(--hk-gold-bright, var(--mineral-gold));
    filter: brightness(1.6);
  }
  100% {
    box-shadow: 0 3px 10px var(--hk-shadow-low, rgba(0, 0, 0, 0.4));
    filter: none;
  }
}

.command-wheel__slot.is-ignited {
  animation: dao-luan-ignite 700ms var(--hk-ease-standard, ease-out) both;
}

/* Faint per-ring identity tint. */
.command-wheel__slot--ring1 {
  border-left: 3px solid var(--hk-jade, var(--chrome-500));
}
.command-wheel__slot--ring2 {
  border-left: 3px solid var(--hk-gold, var(--azure));
}
.command-wheel__slot--ring3 {
  border-left: 3px solid var(--hk-jade-deep, var(--jade));
}
.command-wheel__slot--ring4 {
  border-left: 3px solid var(--hk-ink, var(--el-primordial));
}

/* Same upgrade indicator as the hotspot (Workstream C) - slow breath,
   not rapid blink (spec SS10.1 unread/ready cue). */
.command-wheel__upgrade-dot {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--hk-gold-bright, var(--chrome-500));
  animation: hk-breath var(--hk-motion-breath, 2400ms) var(--hk-ease-standard, ease-in-out) infinite;
}

.command-wheel__notification-badge {
  position: absolute;
  left: 6px;
  top: 6px;
  border-radius: 50%;
  animation: hk-breath var(--hk-motion-breath, 2400ms) var(--hk-ease-standard, ease-in-out) infinite;
}

.command-wheel__lock-badge {
  position: absolute;
  right: 6px;
  bottom: 4px;
  font-size: 10px;
  line-height: 1;
  opacity: 0.85;
}
</style>
