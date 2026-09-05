// combat-vfx-spawner (ui-discoverability-refactor-plan.md §3.2) — tách từ
// CombatScene.ts: Spawn VFX theo preset (action impact, spawn telegraph,
// teleport, hit-flash, lunge/recoil, status icon). Module nhận dependency
// tường minh qua `scene` — mọi cross-call đi qua scene delegate để giữ
// nguyên seam test (flashColor bị spy trong CombatScene.playerMotion.test.ts;
// applyPendingPositions đếm add/Graphics qua proxy trong spawnVfx test).
import Phaser from 'phaser'

import type { ActionImpactEvent, BattlePositionsEvent } from '@/core/battle/BattleEvents'
import type { GridPosition } from '@/core/battle/BattleGrid'
import {
  spawnActionImpactVfx,
  type ActionImpactVfxHandle,
} from '@/game/support/ActionImpactVfx'
import { spawnEnemySpawnVfx } from '@/game/support/EnemySpawnVfx'
import { getCombatVfxPreset } from '@/data/vfx/CombatVfxPresets'
import { getStatusVfxPreset } from '@/data/vfx/StatusVfxPresets'
import type { PlayerBodyAnchorId } from '@/game/support/PlayerVisualProfiles'
import {
  DEPTH_OVERLAY_UI,
  DEPTH_UPRIGHT_VFX,
  uprightVfxDepth,
} from '@/game/support/BattleLayers'

import type { CombatScene } from '../CombatScene'
import {
  PLAYER_ID,
  SHADOW_ALPHA,
  STATUS_ICON_SIZE,
  STATUS_ICON_SPACING,
  STATUS_ROW_GAP,
  STATUS_MAX_PER_ROW,
  STATUS_FOOT_ROW_OFFSET_Y,
  STATUS_PLAYER_ROW_OFFSET_Y,
} from './combatConstants'
import { HUD_MARGIN, HUD_HP_HEIGHT, HUD_SUB_HEIGHT, HUD_GAP } from './PlayerHudLayer'
import { StatusTooltip } from './combat-status-tooltip'
import type { EntitySprite } from './combatTypes'

interface StatusEntry {
  targetId: string
  buffId: string
  polarity: 'buff' | 'debuff'
  permanent: boolean
  stacks: number
  buffName?: string
  remainingTime?: number
  icon: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc
  stackLabel: Phaser.GameObjects.Text
}

export class CombatVfxSpawner {
  constructor(private readonly scene: CombatScene) {}

  /**
   * Buff bar (2026-09-02) — tooltip instance (lazy-create tại
   * onStatusAttached/showTooltipFor); onStatusRemoved/cleanup gọi hideFor.
   */
  statusTooltip?: StatusTooltip

  private showTooltipFor(statusInstanceId: string) {
    this.statusTooltip ??= new StatusTooltip(this.scene)

    const entry = this.scene.statuses.get(statusInstanceId) as StatusEntry | undefined

    if (!entry) {
      return
    }

    const anchor = this.scene.spriteFor(entry.targetId)

    if (!anchor) {
      return
    }

    this.statusTooltip.show(
      entry.icon.x,
      entry.icon.y - STATUS_ICON_SIZE,
      statusInstanceId,
      {
        name: entry.buffName ?? entry.buffId,
        polarity: entry.polarity,
        stacks: entry.stacks,
        remainingTime: entry.remainingTime,
        permanent: entry.permanent,
      },
    )
  }

  /**
   * Remediation Task 2 — nhận sẵn `onComplete` (đã capture token từ
   * CombatScene) rồi truyền thẳng vào spawnActionImpactVfx: ack engine từ
   * completion TỰ THỰC của tween, không tự tính duration trùng lặp.
   * Trả ActionImpactVfxHandle; undefined khi không spawn được (projection
   * miss) — caller phải complete ngay theo fallback path.
   */
  onActionImpact(
    event: ActionImpactEvent,
    onComplete?: () => void,
  ): ActionImpactVfxHandle | undefined {
    const projection = this.scene.projection

    if (!projection) {
      return undefined
    }

    const preset = getCombatVfxPreset(event.presetId)
    // MỘT action = MỘT VFX chính; multi-hit chỉ thêm pulse (spec mục 8).
    const pulses = Math.max(1, Math.min(6, event.hitCount))

    const handle = spawnActionImpactVfx(
      {
        scene: this.scene,
        projection,
        area: event.affectedArea,
        anchorCell: event.anchorCell,
        preset,
        pulses,
        uprightDepth: this.resolveUprightVfxDepth(event.anchorCell),
      },
      onComplete,
    )

    if (preset.screenShake) {
      this.scene.cameras.main.shake(preset.screenShake.durationMs, preset.screenShake.intensity)
    }

    // affectedTargetIds chỉ phục vụ hit-flash — KHÔNG spawn effect sao.
    for (const targetId of event.landedTargetIds) {
      const sprite = this.scene.spriteFor(targetId)

      if (sprite) {
        this.flashColor(sprite, preset.color, 90)
      }
    }

    return handle
  }

  /**
   * Depth lớp upright cho impact tại anchorCell: cùng hệ với entity sprite
   * (foot Y) + bias nhỏ → effect đè đúng target của nó nhưng vẫn bị
   * entity hàng GẦN camera che (occlusion 2.5D). Flat mode giữ lớp
   * upright cố định như renderer cũ.
   */
  resolveUprightVfxDepth(anchorCell: GridPosition): number {
    if (!this.scene.isPerspective || !this.scene.projection) {
      return DEPTH_UPRIGHT_VFX
    }

    const anchor = this.scene.projection.gridToScreen(anchorCell.row, anchorCell.column)

    return uprightVfxDepth(
      anchor.y,
      this.scene.entityFootMinY,
      this.scene.entityFootMaxY,
      anchorCell.column,
    )
  }

  onStatusAttached(event: {
    statusInstanceId: string
    targetId: string
    dotType: string
    stacks: number
    buffName?: string
    polarity?: 'buff' | 'debuff'
    permanent?: boolean
    durationSeconds?: number
  }) {
    if (this.scene.statuses.has(event.statusInstanceId)) {
      return
    }

    const target = this.scene.spriteFor(event.targetId)

    if (!target) {
      return
    }

    const preset = getStatusVfxPreset(event.dotType, event.polarity)

    // Buff bar (2026-09-02) — shape taxonomy: circle=buff, diamond=CC/DoT
    // (kế thừa hình cũ), square=statModifier debuff. Icon tạo tại (0,0) —
    // updateStatusIconPositions() đặt vị trí row mỗi frame.
    const icon =
      preset.shape === 'circle'
        ? this.scene.add.circle(0, 0, STATUS_ICON_SIZE / 2, preset.color)
        : this.scene.add.rectangle(0, 0, STATUS_ICON_SIZE, STATUS_ICON_SIZE, preset.color)

    if (preset.shape === 'diamond') {
      icon.setAngle(45)
    }

    icon.setDepth(DEPTH_OVERLAY_UI + 4)

    const stacks = event.stacks ?? 1
    const stackLabel = this.scene.add.text(0, 0, String(stacks), {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#ffd54f',
    })

    stackLabel.setOrigin(0.5, 0.5)
    stackLabel.setDepth(DEPTH_OVERLAY_UI + 5)
    stackLabel.setVisible(stacks > 1)

    this.scene.statuses.set(event.statusInstanceId, {
      targetId: event.targetId,
      buffId: event.dotType,
      polarity: event.polarity ?? 'debuff',
      permanent: event.permanent ?? false,
      stacks,
      buffName: event.buffName,
      remainingTime: event.durationSeconds,
      icon,
      stackLabel,
    })

    // Buff bar — tooltip wire (Task 5): hover/tap. Scene input mặc định
    // enabled; icon nhỏ nên dùng hitArea mở rộng nhẹ qua square size.
    this.statusTooltip ??= new StatusTooltip(this.scene)

    icon.setInteractive({ useHandCursor: true })
    icon.on('pointerover', () => this.showTooltipFor(event.statusInstanceId))
    icon.on('pointerout', () => this.statusTooltip?.hide())
    icon.on('pointerdown', () => {
      if (this.statusTooltip?.isOpenFor(event.statusInstanceId)) {
        this.statusTooltip.hide()

        return
      }

      this.showTooltipFor(event.statusInstanceId)
    })
  }

  onStatusUpdated(event: { statusInstanceId: string; stacks: number; durationSeconds?: number }) {
    const status = this.scene.statuses.get(event.statusInstanceId) as StatusEntry | undefined

    if (!status) {
      return
    }

    status.stacks = event.stacks
    status.remainingTime = event.durationSeconds
    status.stackLabel.setText(String(event.stacks))
    status.stackLabel.setVisible(event.stacks > 1)
  }

  onStatusRemoved(event: { statusInstanceId: string }) {
    const status = this.scene.statuses.get(event.statusInstanceId) as StatusEntry | undefined

    if (!status) {
      return
    }

    status.icon.destroy()
    status.stackLabel.destroy()
    this.scene.statuses.delete(event.statusInstanceId)
    this.statusTooltip?.hideFor(event.statusInstanceId)
  }

  /**
   * Buff bar (2026-09-02) — vị trí icon THEO ROW mỗi frame (flexible rule:
   * tính từ sprite/viewport hiện hành, không hardcode màn hình dev).
   * Enemy: hàng dưới foot (temporary tier 0, permanent tier 1 — xa hơn).
   * Player: hàng trên cụm sub-bar HUD (temporary tier 0, permanent tier 1 —
   * cao hơn). >8 icon: icon cuối mang counter "+N", icon dư ẩn.
   */
  updateStatusIconPositions() {
    const byTarget = new Map<string, StatusEntry[]>()

    for (const status of (this.scene.statuses as Map<string, StatusEntry>).values()) {
      const list = byTarget.get(status.targetId) ?? []

      list.push(status)
      byTarget.set(status.targetId, list)
    }

    for (const [targetId, entries] of byTarget) {
      const sprite = this.scene.spriteFor(targetId)

      if (!sprite) {
        continue
      }

      const isPlayer = targetId === PLAYER_ID

      this.layoutStatusRow(
        entries.filter((entry) => !entry.permanent),
        isPlayer,
        sprite,
        0,
      )
      this.layoutStatusRow(
        entries.filter((entry) => entry.permanent),
        isPlayer,
        sprite,
        1,
      )
    }
  }

  private layoutStatusRow(
    entries: StatusEntry[],
    isPlayer: boolean,
    sprite: EntitySprite,
    rowTier: 0 | 1,
  ) {
    if (entries.length === 0) {
      return
    }

    const visibleCount = Math.min(entries.length, STATUS_MAX_PER_ROW)
    const rowWidth = visibleCount * (STATUS_ICON_SIZE + STATUS_ICON_SPACING) - STATUS_ICON_SPACING

    let baseY: number
    let startX: number

    if (isPlayer) {
      const height = this.scene.scale.height
      // sub2Y = Y của sub-bar thấp nhất trong PlayerHudLayer.layout() —
      // công thức mirror (HP bar cụm trái-dưới, MP/Kiếm xếp trên).
      const sub2Y =
        height - HUD_MARGIN - HUD_HP_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT
      const temporaryRowY = sub2Y - STATUS_PLAYER_ROW_OFFSET_Y - STATUS_ICON_SIZE

      baseY = rowTier === 0 ? temporaryRowY : temporaryRowY - STATUS_ROW_GAP - STATUS_ICON_SIZE
      startX = HUD_MARGIN
    } else {
      const footY = this.scene.isPerspective
        ? sprite.rect.y
        : sprite.rect.y + sprite.rect.displayHeight / 2
      const temporaryRowY = footY + STATUS_FOOT_ROW_OFFSET_Y

      baseY = rowTier === 0 ? temporaryRowY : temporaryRowY + STATUS_ROW_GAP + STATUS_ICON_SIZE
      startX = sprite.rect.x - rowWidth / 2 + STATUS_ICON_SIZE / 2
    }

    const overflow = entries.length - STATUS_MAX_PER_ROW

    entries.forEach((entry, index) => {
      const slot = Math.min(index, STATUS_MAX_PER_ROW - 1)
      const x = startX + slot * (STATUS_ICON_SIZE + STATUS_ICON_SPACING)

      entry.icon.setPosition(x, baseY)
      entry.stackLabel.setPosition(x + STATUS_ICON_SIZE / 2 + 2, baseY + STATUS_ICON_SIZE / 2 - 1)

      if (overflow > 0 && index === STATUS_MAX_PER_ROW - 1) {
        entry.stackLabel.setText(`+${overflow}`)
        entry.stackLabel.setVisible(true)
      }

      if (overflow > 0 && index >= STATUS_MAX_PER_ROW) {
        entry.icon.setVisible(false)
        entry.stackLabel.setVisible(false)
      }
    })
  }

  flashColor(sprite: EntitySprite, color: number, duration: number) {
    if (sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setTint(color)

      this.scene.time.delayedCall(duration, () => gameSprite.clearTint())

      return
    }

    const rect = sprite.rect as Phaser.GameObjects.Rectangle

    rect.setFillStyle(color)

    this.scene.time.delayedCall(duration, () => {
      rect.setFillStyle(sprite.color)
    })
  }

  playHorizontalImpulse(sprite: EntitySprite, distance: number, duration: number) {
    // Attack, recoil and dodge all own the same presentation channel. Resetting
    // before a new impulse prevents rapid events from accumulating a permanent
    // horizontal drift.
    this.scene.tweens.killTweensOf(sprite)
    sprite.offsetX = 0

    this.scene.tweens.add({
      targets: sprite,
      offsetX: distance,
      duration,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        sprite.offsetX = 0
      },
    })
  }

  /** Fade-in + scale 0.7→1 cho enemy vừa materialize (một lần duy nhất). */
  playMaterializeFadeIn(sprite: EntitySprite) {
    sprite.boost.value = 0.7

    this.scene.tweens.add({
      targets: sprite.boost,
      value: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    })

    // Chỉ cần khả năng setAlpha — structural typing thay vì component
    // interface của Phaser 4 (gồm alphaTopLeft... không khớp GameObject).
    const alphaTargets: Array<{ target: { setAlpha(value: number): unknown }; final: number }> = []

    alphaTargets.push({ target: sprite.rect, final: 1 })
    alphaTargets.push({ target: sprite.label, final: 1 })

    if (sprite.shadow) {
      alphaTargets.push({ target: sprite.shadow, final: SHADOW_ALPHA })
    }

    if (sprite.healthBar) {
      alphaTargets.push({ target: sprite.healthBar.background, final: 1 })
      alphaTargets.push({ target: sprite.healthBar.fill, final: 1 })
    }

    for (const entry of alphaTargets) {
      entry.target.setAlpha(0)
    }

    const state = { t: 0 }

    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: 200,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        for (const entry of alphaTargets) {
          entry.target.setAlpha(entry.final * state.t)
        }
      },
      onComplete: () => {
        for (const entry of alphaTargets) {
          entry.target.setAlpha(entry.final)
        }
      },
    })
  }

  /**
   * Reconcile telegraph spawn VFX theo SNAPSHOT (không event tức thời):
   * id mới → tạo handle; id còn → cập nhật progress; id MẤT → materialize
   * (flash ngắn + fade-in sprite) và dọn handle. Flat mode bỏ qua (renderer
   * legacy giữ hành vi cũ).
   */
  reconcileSpawnVfx(event: BattlePositionsEvent) {
    if (!this.scene.isPerspective) {
      return
    }

    const seen = new Set<string>()

    for (const spawning of event.spawningEnemies ?? []) {
      seen.add(spawning.id)

      const existing = this.scene.spawnVfxHandles.get(spawning.id)

      if (existing) {
        existing.progress = spawning.progress

        continue
      }

      if (!this.scene.projection) {
        continue
      }

      const handle = spawnEnemySpawnVfx({
        scene: this.scene,
        projection: this.scene.projection,
        row: spawning.row,
        column: spawning.column,
        presetId: spawning.presetId,
        uprightDepth: this.resolveUprightVfxDepth(spawning),
      })

      this.scene.spawnVfxHandles.set(spawning.id, { handle, progress: spawning.progress })
    }

    for (const [id, entry] of [...this.scene.spawnVfxHandles]) {
      if (seen.has(id)) {
        continue
      }

      this.scene.spawnVfxHandles.delete(id)
      this.scene.materializingIds.add(id)
      entry.handle.complete()
    }
  }

  /**
   * Reconcile telegraph spawn của PLAYER theo SNAPSHOT (plan §12.2).
   * Flat mode vẫn chạy visibility (ẩn/hiện sprite) nhưng bỏ VFX telegraph
   * như enemy spawn.
   */
  reconcilePlayerSpawn(event: BattlePositionsEvent) {
    const sprite = this.scene.sprites.get(PLAYER_ID)

    if (!event.playerMaterialized) {
      this.scene.playerMaterialized = false

      if (sprite) {
        sprite.rect.setVisible(false)
      }

      // Telegraph tại projected cell (4,1) — chỉ perspective vẽ VFX.
      if (this.scene.isPerspective && event.playerSpawn && this.scene.projection) {
        if (!this.scene.playerSpawnHandle) {
          this.scene.playerSpawnHandle = spawnEnemySpawnVfx({
            scene: this.scene,
            projection: this.scene.projection,
            row: event.playerSpawn.row,
            column: event.playerSpawn.column,
            presetId: event.playerSpawn.presetId,
            uprightDepth: this.resolveUprightVfxDepth({
              row: event.playerSpawn.row,
              column: event.playerSpawn.column,
            }),
          })
        } else {
          this.scene.playerSpawnHandle.update(event.playerSpawn.progress)
        }
      } else if (this.scene.playerSpawnHandle) {
        this.scene.playerSpawnHandle.update(event.playerSpawn?.progress ?? 0)
      }

      return
    }

    // Materialize: kết thúc telegraph rồi hiện sprite (loại trừ nhau).
    this.scene.playerSpawnHandle?.complete()
    this.scene.playerSpawnHandle = undefined

    if (!this.scene.playerMaterialized && sprite) {
      sprite.rect.setVisible(true)
      this.playMaterializeFadeIn(sprite)
    }

    this.scene.playerMaterialized = true
  }

  /**
   * Hook placeholder VFX teleport (plan §2.5 — đợt này KHÔNG tự thiết kế
   * VFX): flash alpha ngắn làm tín hiệu trực quan tối thiểu; thay bằng
   * hiệu ứng thật ở đợt sau qua cùng điểm neo from/to này.
   */
  playTeleportVfx(_from: GridPosition, to: GridPosition) {
    const projection = this.scene.projection
    const sprite = this.scene.sprites.get(PLAYER_ID)

    if (!projection || !sprite || !this.scene.isPerspective) {
      return
    }

    void to

    this.scene.tweens.add({
      targets: sprite.rect,
      alpha: { from: 0.35, to: 1 },
      duration: 140,
      ease: 'Quad.easeOut',
    })
  }

  /**
   * Debug mode (plan §5.4) — dev-only, bật qua
   * localStorage['debug.playerBodyAnchors']='1'; vẽ chấm màu tại từng
   * body anchor mỗi frame. Không có UI production nào đụng tới.
   */
  drawDebugBodyAnchors() {
    if (!this.scene.debugBodyAnchorsEnabled) {
      return
    }

    if (!this.scene.debugAnchorGraphics) {
      this.scene.debugAnchorGraphics = this.scene.add.graphics().setDepth(DEPTH_OVERLAY_UI + 7)
    }

    const graphics = this.scene.debugAnchorGraphics

    graphics.clear()

    const colors: Record<PlayerBodyAnchorId, number> = {
      head: 0xffffff,
      chest: 0x00ffff,
      castHand: 0xff8800,
      offHand: 0x0088ff,
      feet: 0xff00ff,
    }

    for (const anchorId of Object.keys(colors) as PlayerBodyAnchorId[]) {
      const point = this.scene.getPlayerBodyAnchorScreen(anchorId)

      if (!point) {
        continue
      }

      graphics.fillStyle(colors[anchorId]!, 0.9)

      graphics.fillCircle(point.x, point.y, 3)
    }
  }
}
