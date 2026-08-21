<script setup lang="ts">
// Skill Node unlock animation (2026-08-21, Plans/SkillNode) — SVG layer
// RIÊNG cho các đường nối parent→child trong Node Tree, nằm dưới
// SkillNode (button) nhưng trên background, theo ĐÚNG kiến trúc mục 4
// của plan ("SkillTree > SkillConnections.vue (SVG) + SkillNode
// (button)"). pointer-events:none — không chặn click node. Component
// THUẦN hiển thị: NodeTreePanel.vue đo vị trí node thật (getBoundingClientRect)
// rồi truyền toạ độ xuống đây, component này không tự biết gì về
// unlock logic/skill point.
export interface SkillConnectionRect {
  x: number
  topY: number
  bottomY: number
}

export interface SkillConnectionEntry {
  parentId: string
  childId: string
  state: 'locked' | 'active' | 'unlocking'
}

defineProps<{
  connections: SkillConnectionEntry[]
  rects: Record<string, SkillConnectionRect>
}>()

function pathFor(conn: SkillConnectionEntry, rects: Record<string, SkillConnectionRect>): string {
  const parent = rects[conn.parentId]
  const child = rects[conn.childId]

  if (!parent || !child) {
    return ''
  }

  const midY = (parent.bottomY + child.topY) / 2

  return `M ${parent.x} ${parent.bottomY} C ${parent.x} ${midY}, ${child.x} ${midY}, ${child.x} ${child.topY}`
}
</script>

<template>
  <svg class="skill-connections" aria-hidden="true">
    <path
      v-for="conn in connections"
      :key="`${conn.parentId}->${conn.childId}`"
      :d="pathFor(conn, rects)"
      class="skill-connections__path"
      :class="`is-${conn.state}`"
    />
  </svg>
</template>

<style scoped>
.skill-connections {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

.skill-connections__path {
  fill: none;
  stroke: var(--branch-color, var(--ink-line));
  stroke-width: 1.5px;
  opacity: 0.3;
  transition: opacity 0.3s ease;
}

.skill-connections__path.is-active {
  opacity: 0.75;
}

/* Luồng năng lượng chạy parent -> child (600-900ms, spec mục 1) —
   stroke-dasharray/dashoffset thay vì tween JS từng frame (GPU-friendly,
   spec mục 5). Hướng đi ĐÚNG parent->child vì path được vẽ từ parent
   xuống child (M parent ... đến child) và dashoffset giảm dần về 0. */
.skill-connections__path.is-unlocking {
  opacity: 1;
  stroke: var(--gold-500);
  stroke-width: 2.5px;
  stroke-dasharray: 10 8;
  filter: drop-shadow(0 0 3px var(--gold-500));
  animation: skill-connections-flow 750ms ease-out forwards;
}

@keyframes skill-connections-flow {
  from {
    stroke-dashoffset: 72;
  }

  to {
    stroke-dashoffset: 0;
  }
}
</style>
