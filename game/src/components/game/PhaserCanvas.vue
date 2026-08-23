<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Phaser from 'phaser'
import { MainScene } from '@/game/scenes/MainScene'
import { CombatScene } from '@/game/scenes/CombatScene'
import { TribulationScene } from '@/game/scenes/TribulationScene'
import { useGameManager } from '@/composables/useGameState'

const gameManager = useGameManager()

const containerRef = ref<HTMLDivElement | null>(null)

let game: Phaser.Game | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!containerRef.value) {
    return
  }

  // GameRoot.vue là 1 frame 16:9 cố định, CSS transform:scale() để
  // vừa cửa sổ — nhưng containerRef.value.clientWidth/Height đọc lúc
  // mount() này ĐÔI KHI vẫn là 0 (race giữa lúc Vue mount component
  // con này và lúc trình duyệt thật sự layout xong style của tổ tiên,
  // ví dụ v-bind() CSS var từ GameRoot.vue) — canvas Phaser tạo với
  // width/height 0 thì kẹt luôn 0 vĩnh viễn vì Phaser chỉ đọc config
  // này 1 lần lúc khởi tạo. ResizeObserver ở đây vừa fix race đó (lần
  // gọi đầu tiên luôn có, báo kích thước THẬT ngay sau khi layout xong)
  // vừa là lưới an toàn chung nếu container đổi kích thước vì lý do
  // khác sau này.
  // Combat UI Redesign — 2 scene ĐĂNG KÝ cùng lúc, chỉ MainScene (đầu
  // mảng) tự động active — CombatScene nằm sẵn nhưng dormant tới khi
  // MainScene tự gọi this.scene.start('CombatScene') lúc 'battle_start'
  // (xem MainScene.ts/CombatScene.ts). Chỉ 1 Phaser.Game/canvas DUY
  // NHẤT cho cả 2 — scene chuyển qua lại KHÔNG destroy/tạo lại Game.
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: containerRef.value,
    width: containerRef.value.clientWidth,
    height: containerRef.value.clientHeight,
    transparent: true,
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [MainScene, CombatScene, TribulationScene],
  })

  // MainScene.ts/CombatScene.ts CHỈ giao tiếp với core qua EventBus
  // này (không cầm tham chiếu GameManager trực tiếp) — mọi thứ chúng
  // cần (vị trí player/quái, animation attack/critical/hit/dodge/cast/
  // death/battle_start/battle_end/combat_scene_exit) đều tới qua đây.
  game.registry.set('eventBus', gameManager.eventBus)

  resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0]

    if (!entry || !game) {
      return
    }

    const { width, height } = entry.contentRect

    if (width > 0 && height > 0) {
      game.scale.resize(width, height)
    }
  })

  resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null

  game?.destroy(true)

  game = null
})
</script>

<template>
  <div ref="containerRef" class="phaser-canvas" />
</template>

<style scoped>
.phaser-canvas {
  width: 100%;
  height: 100%;
}
</style>
