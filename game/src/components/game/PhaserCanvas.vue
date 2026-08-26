<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Phaser from 'phaser'
import { MainScene } from '@/game/scenes/MainScene'
import { CombatScene } from '@/game/scenes/CombatScene'
import { TribulationScene } from '@/game/scenes/TribulationScene'
import { useGameManager } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'
import {
  resolvePlayerVisualProfileId,
  type PlayerVisualProfileId,
} from '@/game/support/PlayerVisualProfiles'

const gameManager = useGameManager()
const player = usePlayerStore()

const containerRef = ref<HTMLDivElement | null>(null)

let game: Phaser.Game | null = null
let resizeObserver: ResizeObserver | null = null
let positionsCleanup: (() => void) | null = null

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
    // roundPixels (fix "nhân vật đôi khi bị blur", 2026-08-26): sprite
    // đứng giữa pixel lẻ (projection tọa độ thập phân + walk sway/bob)
    // bị sample mờ; snap vị trí vẽ về lưới nguyên pixel cho cạnh nét.
    render: { roundPixels: true },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [MainScene, CombatScene, TribulationScene],
  })

  // Expose cho e2e/visual gate — đọc battlefieldGeometry qua registry
  // mà không cần chạm canvas pixel. Không có code gameplay dùng nó.
  ;(window as unknown as { __tutienPhaserGame?: Phaser.Game }).__tutienPhaserGame = game

  // MainScene.ts/CombatScene.ts CHỈ giao tiếp với core qua EventBus
  // này (không cầm tham chiếu GameManager trực tiếp) — mọi thứ chúng
  // cần (vị trí player/quái, animation attack/critical/hit/dodge/cast/
  // death/battle_start/battle_end/combat_scene_exit) đều tới qua đây.
  game.registry.set('eventBus', gameManager.eventBus)

  // Late-join replay (fix spawn animation lần đầu, lớp bảo hiểm thứ 2
  // bên cạnh eager preload) — giữ snapshot 'positions' MỚI NHẤT trong
  // registry để CombatScene.create() start muộn có thể fast-forward thay
  // vì đứng ngoài phase spawn telegraph. Clear khi trận kết thúc/thoát
  // để không phát lại snapshot STALE của trận cũ.
  let lastPositionsSnapshot: { event: BattlePositionsEvent; at: number } | null = null

  const clearPositionsSnapshot = () => {
    lastPositionsSnapshot = null

    game?.registry.set('lastBattlePositionsSnapshot', undefined)
  }

  const positionsHandler = (event: BattlePositionsEvent) => {
    lastPositionsSnapshot = { event, at: performance.now() }

    game?.registry.set('lastBattlePositionsSnapshot', lastPositionsSnapshot)
  }

  gameManager.eventBus.on<BattlePositionsEvent>('positions', positionsHandler)

  gameManager.eventBus.on<void>('battle_end', clearPositionsSnapshot)

  gameManager.eventBus.on<void>('combat_scene_exit', clearPositionsSnapshot)

  positionsCleanup = () => {
    gameManager.eventBus.off<BattlePositionsEvent>('positions', positionsHandler)
    gameManager.eventBus.off<void>('battle_end', clearPositionsSnapshot)
    gameManager.eventBus.off<void>('combat_scene_exit', clearPositionsSnapshot)
  }

  // Player visual profile bridge (player-body-anchor-reward-gourd-plan
  // §4.2) — snapshot ID vào registry để scene đọc lúc create() (không
  // bỏ lỡ trạng thái khi scene khởi động muộn), và phát event qua EventBus
  // mỗi khi realm/path đổi. Scenes chỉ nhận PROFILE ID.
  const publishProfile = () => {
    const profileId: PlayerVisualProfileId = resolvePlayerVisualProfileId({
      realmId: player.realmId,

      cultivationPath: player.cultivationPath,
    })

    if (game) {
      game.registry.set('playerVisualProfileId', profileId)
    }

    gameManager.eventBus.emit('player_visual_profile_changed', {
      type: 'player_visual_profile_changed',

      profileId,
    })
  }

  publishProfile()

  watch(
    () => [player.realmId, player.cultivationPath] as const,

    () => publishProfile(),
  )

  resizeObserver = new ResizeObserver((entries) => {
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
  positionsCleanup?.()

  positionsCleanup = null

  resizeObserver?.disconnect()
  resizeObserver = null

  ;(window as unknown as { __tutienPhaserGame?: Phaser.Game }).__tutienPhaserGame = undefined

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
