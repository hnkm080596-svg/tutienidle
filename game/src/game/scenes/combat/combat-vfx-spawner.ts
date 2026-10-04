// combat-vfx-spawner (ui-discoverability-refactor-plan.md sec3.2) - tach tu
// CombatScene.ts: Spawn VFX theo preset (action impact, spawn telegraph,
// teleport, hit-flash, lunge/recoil, status icon). Module nhan dependency
// tuong minh qua `scene` - moi cross-call di qua scene delegate de giu
// nguyen seam test (flashColor bi spy trong CombatScene.playerMotion.test.ts;
// applyPendingPositions dem add/Graphics qua proxy trong spawnVfx test).
import Phaser from 'phaser'

import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'
import type { GridPosition, LaneIndex } from '@/core/battle/BattleGrid'
import type { EnemySpawnVfxPresetId } from '@/core/battle/CombatAction'
import { spawnEnemySpawnVfx } from '@/game/support/EnemySpawnVfx'
import { getStatusVfxPreset } from '@/data/vfx/StatusVfxPresets'
import type { BodyAnchorId } from '@/presentation/geometry/combatBodyAnchors'
import { readHoThe } from '@/presentation/bridges/hoTheBridge'
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

// Turn-Based Wave Redesign (2026-09-06) - subset cua BattlePositionsEvent
// ma reconcileSpawnVfx() thuc su doc. BattlePositionsEvent thoa man cau
// truc nay (TypeScript structural typing) - legacy call site hien co
// (CombatScene.reconcileSpawnVfx()) KHONG can thay doi gi. Turn-based
// combat tu dung object shape nay tu TurnBattleEntitySnapshotEvent
// (CombatScene.onTurnBattleEntitySnapshot(), Task 7).
export interface SpawnVfxSnapshot {
  spawningEnemies?: {
    id: string
    row: LaneIndex
    column: number
    progress: number
    isBoss: boolean
    presetId: EnemySpawnVfxPresetId
  }[]
}

export class CombatVfxSpawner {
  constructor(private readonly scene: CombatScene) {}

  /**
   * Buff bar (2026-09-02) - tooltip instance (lazy-create tai
   * onStatusAttached/showTooltipFor); onStatusRemoved/cleanup goi hideFor.
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
        // Phap Tu Reimagine (F13) -- player-owned statuses carry the live
        // Ho The DR line (cap * currentMp/maxMp read at show time).
        extraLine: entry.targetId === PLAYER_ID ? this.hoTheLine() : undefined,
      },
    )
  }

  /** F13 -- live Ho The DR readout; null/0 DR hides the row. */
  private hoTheLine(): string | undefined {
    const ho = this.scene.registry ? readHoThe(this.scene.registry) : null

    if (!ho || ho.dr <= 0) {
      return undefined
    }

    return `Hộ Thể -${Math.round(ho.dr * 100)}%`
  }

  /**
   * Depth lop upright cho impact tai anchorCell: cung he voi entity sprite
   * (foot Y) + bias nho -> effect de dung target cua no nhung van bi
   * entity hang GAN camera che (occlusion 2.5D). Flat mode giu lop
   * upright co dinh nhu renderer cu.
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

    // Buff bar (2026-09-02) - shape taxonomy: circle=buff, diamond=CC/DoT
    // (ke thua hinh cu), square=statModifier debuff. Icon tao tai (0,0) -
    // updateStatusIconPositions() dat vi tri row moi frame.
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

    // Buff bar - tooltip wire (Task 5): hover/tap. Scene input mac dinh
    // enabled; icon nho nen dung hitArea mo rong nhe qua square size.
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
   * Buff bar (2026-09-02) - vi tri icon THEO ROW moi frame (flexible rule:
   * tinh tu sprite/viewport hien hanh, khong hardcode man hinh dev).
   * Enemy: hang duoi foot (temporary tier 0, permanent tier 1 - xa hon).
   * Player: hang tren cum sub-bar HUD (temporary tier 0, permanent tier 1 -
   * cao hon). >8 icon: icon cuoi mang counter "+N", icon du an.
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
      // Row anchored bottom-LEFT, independent, hugging the reward gourd
      // edge - no longer mirrors PlayerHudLayer (HUD moved top-left per spec 13).
      const statusRowBaseY =
        height - HUD_MARGIN - HUD_HP_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT
      const temporaryRowY = statusRowBaseY - STATUS_PLAYER_ROW_OFFSET_Y - STATUS_ICON_SIZE

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

      // FILL tint: uniform silhouette flash - the multiply tint left dark
      // pixels dark, so the hit read as patchy red blocks on the art.
      // clearTint() restores MULTIPLY.
      gameSprite.setTint(color).setTintMode(Phaser.TintModes.FILL)

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

  /** Fade-in + scale 0.7->1 cho enemy vua materialize (mot lan duy nhat). */
  playMaterializeFadeIn(sprite: EntitySprite) {
    sprite.boost.value = 0.7

    this.scene.tweens.add({
      targets: sprite.boost,
      value: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    })

    // Chi can kha nang setAlpha - structural typing thay vi component
    // interface cua Phaser 4 (gom alphaTopLeft... khong khop GameObject).
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
   * Reconcile telegraph spawn VFX theo SNAPSHOT (khong event tuc thoi):
   * id moi -> tao handle; id con -> cap nhat progress; id MAT -> materialize
   * (flash ngan + fade-in sprite) va don handle. Flat mode bo qua (renderer
   * legacy giu hanh vi cu).
   */
  reconcileSpawnVfx(event: SpawnVfxSnapshot) {
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
      this.scene.entityVisual.markMaterializing(id)
      entry.handle.complete()
    }
  }

  /**
   * Reconcile telegraph spawn cua PLAYER theo SNAPSHOT (plan sec12.2).
   * Flat mode van chay visibility (an/hien sprite) nhung bo VFX telegraph
   * nhu enemy spawn.
   */
  reconcilePlayerSpawn(event: BattlePositionsEvent) {
    const sprite = this.scene.sprites.get(PLAYER_ID)

    if (!event.playerMaterialized) {
      this.scene.entityVisual.hidePlayer(sprite)

      // Telegraph tai projected cell (4,1) - chi perspective ve VFX.
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

    // Materialize: ket thuc telegraph roi hien sprite (loai tru nhau).
    this.scene.playerSpawnHandle?.complete()
    this.scene.playerSpawnHandle = undefined

    this.scene.entityVisual.materializePlayer(sprite)
  }

  /**
   * Debug mode (plan sec5.4) - dev-only, bat qua
   * localStorage['debug.playerBodyAnchors']='1'; ve cham mau tai tung
   * body anchor moi frame. Khong co UI production nao dung toi.
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

    const colors: Record<BodyAnchorId, number> = {
      top: 0xffffff,
      centre: 0x00ffff,
      front: 0xff8800,
      back: 0x0088ff,
      bottom: 0xff00ff,
    }

    for (const id of Object.keys(colors) as BodyAnchorId[]) {
      const point = this.scene.bodyAnchorScreen(PLAYER_ID, id)

      if (!point) {
        continue
      }

      graphics.fillStyle(colors[id]!, 0.9)

      graphics.fillCircle(point.x, point.y, 3)
    }
  }
}
