// 6A-T4 (2026-09-01, spec docs/superpowers/specs/2026-09-01-combat-scene-
// ui-redesign-design.md §3) — HP/MP/Kiếm player vẽ TRONG canvas Phaser,
// thay 3 DOM bars (Status/Event/Control). Minimalism/Swiss: không khung
// nền, bar mảnh 2 lớp Rectangle theo pattern enemy HP bar, ink tokens.
//
// Flexible rule (AGENTS.md): mọi vị trí tính từ viewport width/height
// qua layout() — resize gọi lại layout, KHÔNG hardcode px màn hình dev.
import Phaser from 'phaser'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'
import { formatNumber } from '@/core/format/NumberFormatter'

import {
  PLAYER_HUD_BG_COLOR,
  PLAYER_HUD_HP_COLOR,
  PLAYER_HUD_MP_COLOR,
  PLAYER_HUD_KIEM_COLOR,
  PLAYER_HUD_THE_COLOR,
  PLAYER_HUD_THE_ARMED_COLOR,
  PLAYER_HUD_WARD_COLOR,
  PLAYER_HUD_LABEL_COLOR,
  PLAYER_HUD_LABEL_COLOR_INT,
  PLAYER_HUD_STROKE_COLOR,
  ENEMY_HP_BAR_HEIGHT,
} from './combatConstants'

export const HUD_MARGIN = 16
export const HUD_HP_WIDTH = 180
export const HUD_HP_HEIGHT = 6
export const HUD_SUB_WIDTH = 140
export const HUD_SUB_HEIGHT = 4
export const HUD_GAP = 8

const HUD_LABEL_FONT_SIZE = '12px'
const HUD_SUB_LABEL_FONT_SIZE = '10px'
const LABEL_ABOVE_BAR = 4

interface HudRectGroup {
  background: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  width: number
  height: number
  visible: boolean
}

// Phap Tu Reimagined (Task 16) — the The bar is the one group carrying
// a threshold marker (a tick at the fixed 100 empowerment point vs a
// truong_the-raised cap) so it gets an optional marker member.
interface TheBarGroup extends HudRectGroup {
  marker: Phaser.GameObjects.Rectangle
}

export class PlayerHudLayer {
  private readonly scene: Phaser.Scene

  private viewport = { width: 0, height: 0 }

  private hpGroup!: HudRectGroup

  private mpGroup!: HudRectGroup

  private kiemGroup!: HudRectGroup

  private theGroup!: TheBarGroup

  // The Tu Reimagined (T22) — Son Nhac Ho The external-ward layer: its
  // own bar above the resource bar, never merged into the ward/resource
  // pools (protection-only, not spendable).
  private wardGroup!: HudRectGroup

  private destroyed = false

  constructor(scene: Phaser.Scene, viewport: { width: number; height: number }) {
    this.scene = scene
    this.viewport = viewport

    this.hpGroup = this.createGroup(HUD_HP_WIDTH, HUD_HP_HEIGHT, `${HUD_LABEL_FONT_SIZE}`, true)
    this.mpGroup = this.createGroup(HUD_SUB_WIDTH, HUD_SUB_HEIGHT, HUD_SUB_LABEL_FONT_SIZE, false, PLAYER_HUD_MP_COLOR)
    this.kiemGroup = this.createGroup(HUD_SUB_WIDTH, HUD_SUB_HEIGHT, HUD_SUB_LABEL_FONT_SIZE, false, PLAYER_HUD_KIEM_COLOR)
    this.theGroup = this.createTheGroup(HUD_SUB_WIDTH, HUD_SUB_HEIGHT, HUD_SUB_LABEL_FONT_SIZE)
    this.wardGroup = this.createGroup(HUD_SUB_WIDTH, HUD_SUB_HEIGHT, HUD_SUB_LABEL_FONT_SIZE, false, PLAYER_HUD_WARD_COLOR)

    this.layout(viewport.width, viewport.height)
  }

  /** Test accessors — vị trí/kích thước hiện tại (flexible assertions). */
  get hpFill(): Phaser.GameObjects.Rectangle {
    return this.hpGroup.fill
  }

  get hpLabel(): Phaser.GameObjects.Text {
    return this.hpGroup.label
  }

  get mpFill(): Phaser.GameObjects.Rectangle {
    return this.mpGroup.fill
  }

  get mpGroupVisible(): boolean {
    return this.mpGroup.visible
  }

  get kiemFill(): Phaser.GameObjects.Rectangle {
    return this.kiemGroup.fill
  }

  get kiemLabel(): Phaser.GameObjects.Text {
    return this.kiemGroup.label
  }

  get kiemGroupVisible(): boolean {
    return this.kiemGroup.visible
  }

  get theGroupVisible(): boolean {
    return this.theGroup.visible
  }

  get theLabel(): Phaser.GameObjects.Text {
    return this.theGroup.label
  }

  get theFill(): Phaser.GameObjects.Rectangle {
    return this.theGroup.fill
  }

  get theMarker(): Phaser.GameObjects.Rectangle {
    return this.theGroup.marker
  }

  get hpWidth(): number {
    return this.hpGroup.width
  }

  get subWidth(): number {
    return this.mpGroup.width
  }

  /**
   * Vị trí tính từ viewport: cụm HP neo góc trái-DƯỚI (cách HUD_MARGIN),
   * MP ngay dưới HP (cách HUD_GAP), Kiếm dưới MP. bottom inset = 0 từ
   * 6A-T3 nên không cần chừa chỗ bar DOM nào. Thế (Pháp Tu) shares the
   * Kiếm slot — the two readers are mutually exclusive by path
   * (sword vs spell), so a second slot would just be a gap.
   */
  layout(width: number, height: number): void {
    this.viewport = { width, height }

    const leftX = HUD_MARGIN
    const hpBarY = height - HUD_MARGIN - HUD_HP_HEIGHT
    const sub1Y = hpBarY - HUD_GAP - HUD_SUB_HEIGHT
    const sub2Y = sub1Y - HUD_GAP - HUD_SUB_HEIGHT
    const sub3Y = sub2Y - HUD_GAP - HUD_SUB_HEIGHT

    this.positionGroup(this.hpGroup, leftX, hpBarY, HUD_HP_WIDTH, HUD_HP_HEIGHT)
    this.positionGroup(this.mpGroup, leftX, sub1Y, HUD_SUB_WIDTH, HUD_SUB_HEIGHT)
    this.positionGroup(this.kiemGroup, leftX, sub2Y, HUD_SUB_WIDTH, HUD_SUB_HEIGHT)
    this.positionGroup(this.theGroup, leftX, sub2Y, HUD_SUB_WIDTH, HUD_SUB_HEIGHT)
    this.positionGroup(this.wardGroup, leftX, sub3Y, HUD_SUB_WIDTH, HUD_SUB_HEIGHT)
  }

  updateHp(current: number, max: number): void {
    this.updateGroup(this.hpGroup, current, max, `${formatNumber(Math.ceil(current))} / ${formatNumber(Math.max(0, Math.round(max)))}`)
  }

  updateMp(current: number, max: number): void {
    this.updateGroup(this.mpGroup, current, max, max > 0 ? `Linh Lực ${formatNumber(Math.floor(current))} / ${formatNumber(Math.max(0, Math.round(max)))}` : '')
  }

  updateKiem(current: number, max: number, label: string): void {
    this.updateGroup(this.kiemGroup, current, max, max > 0 ? label : '')
  }

  /**
   * The bar (Task 16) — fill vs the FIXED threshold marker at 100 (a
   * raised cap via truong_the leaves the marker inside the bar);
   * `armed` = the phap-tuong unlock node is owned, so at threshold the
   * ult resolves empowered (label marks the armed state, fill brightens
   * once the pool reaches the marker).
   */
  updateThe(
    current: number,
    max: number,
    threshold: number,
    armed: boolean,
    ungThe?: {
      hasThamFocus?: boolean
      quanTheActive?: boolean
      reactionDebt?: number
      quaThe?: boolean
    },
  ): void {
    const hasPool = Number.isFinite(max) && max > 0

    this.setGroupVisible(this.theGroup, hasPool)
    this.theGroup.marker.setVisible(hasPool && threshold > 0 && max > threshold)

    if (!hasPool) {
      return
    }

    const ratio = Math.min(1, Math.max(0, current / max))

    this.theGroup.fill.scaleX = ratio
    this.theGroup.fill.setFillStyle(armed && current >= threshold ? PLAYER_HUD_THE_ARMED_COLOR : PLAYER_HUD_THE_COLOR)

    // Marker sits at threshold/max along the bar — it only leaves the
    // bar's right edge when the cap is raised past 100.
    const markerRatio = Math.min(1, threshold / max)

    this.theGroup.marker.setPosition(this.theGroup.background.x + this.theGroup.width * markerRatio, this.theGroup.background.y)

    // Ung The beta -- focus/Quan The/Ung Tre state suffix (design Part XV).
    // quaThe arrives computed from the bridge (single predicate authority).
    const quaThe = ungThe?.quaThe === true
    const suffix =
      ungThe === undefined
        ? ''
        : [
            ungThe.hasThamFocus ? 'Thám' : '',
            ungThe.quanTheActive ? 'Quan' : '',
            quaThe ? 'Quá Thế' : ungThe.reactionDebt ? `Trệ ${ungThe.reactionDebt}` : '',
          ]
            .filter(Boolean)
            .join(' · ')

    this.theGroup.label.text = `Thế ${formatNumber(Math.floor(current))} / ${formatNumber(Math.max(0, Math.round(max)))}${armed ? ' ◆' : ''}${suffix ? ` · ${suffix}` : ''}`
  }

  // External ward pool — its own layer label; max is the holder's maxHp
  // (shield fraction of health), NOT a spendable ward cap.
  updateExternalWard(current: number, max: number): void {
    this.updateGroup(
      this.wardGroup,
      current,
      max,
      max > 0 ? `Hộ Thể ${formatNumber(Math.floor(current))}` : '',
    )
  }

  setVisible(visible: boolean): void {
    const groups = [this.hpGroup, this.mpGroup, this.kiemGroup, this.theGroup, this.wardGroup]

    for (const group of groups) {
      this.setGroupVisible(group, visible && (group === this.hpGroup || group.visible))
    }

    this.theGroup.marker.setVisible(visible && this.theGroup.marker.visible)
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.destroyed = true

    for (const group of [this.hpGroup, this.mpGroup, this.kiemGroup, this.theGroup, this.wardGroup]) {
      group.background.destroy()
      group.fill.destroy()
      group.label.destroy()
    }

    this.theGroup.marker.destroy()
  }

  private createGroup(
    width: number,
    height: number,
    fontSize: string,
    initialVisible: boolean,
    fillColor = PLAYER_HUD_HP_COLOR,
  ): HudRectGroup {
    const depth = DEPTH_OVERLAY_UI + 2

    const background = this.scene.add
      .rectangle(0, 0, width, height, PLAYER_HUD_BG_COLOR)
      .setStrokeStyle(1, PLAYER_HUD_STROKE_COLOR)
      .setOrigin(0, 0.5)
      .setDepth(depth)

    const fill = this.scene.add
      .rectangle(0, 0, width, height, fillColor)
      .setOrigin(0, 0.5)
      .setDepth(depth + 1)

    const label = this.scene.add
      .text(0, 0, '', {
        fontSize,
        color: PLAYER_HUD_LABEL_COLOR,
      })
      .setOrigin(0, 1)
      .setDepth(depth)

    const group: HudRectGroup = {
      background,
      fill,
      label,
      width,
      height,
      visible: initialVisible,
    }

    this.setGroupVisible(group, initialVisible)

    return group
  }

  /** The bar carries a threshold marker the other groups don't need. */
  private createTheGroup(width: number, height: number, fontSize: string): TheBarGroup {
    const group = this.createGroup(width, height, fontSize, false, PLAYER_HUD_THE_COLOR) as TheBarGroup

    group.marker = this.scene.add
      .rectangle(0, 0, 2, height + 4, PLAYER_HUD_LABEL_COLOR_INT)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_OVERLAY_UI + 3)
      .setVisible(false)

    return group
  }

  private positionGroup(group: HudRectGroup, x: number, barY: number, width: number, height: number): void {
    group.background.setPosition(x, barY).setDisplaySize(width, height)
    group.fill.setPosition(x, barY).setDisplaySize(width, height)
    group.label.setPosition(x, barY - height / 2 - LABEL_ABOVE_BAR)

    group.width = width
    group.height = height
  }

  private updateGroup(group: HudRectGroup, current: number, max: number, labelText: string): void {
    const hasPool = Number.isFinite(max) && max > 0

    this.setGroupVisible(group, hasPool)

    if (!hasPool) {
      return
    }

    const ratio = Math.min(1, Math.max(0, current / max))

    group.fill.scaleX = ratio
    group.label.text = labelText
  }

  private setGroupVisible(group: HudRectGroup, visible: boolean): void {
    group.visible = visible
    group.background.setVisible(visible)
    group.fill.setVisible(visible)
    group.label.setVisible(visible)
  }
}

// Re-export cho constants import ở test.
export {
  PLAYER_HUD_BG_COLOR,
  PLAYER_HUD_HP_COLOR,
  PLAYER_HUD_MP_COLOR,
  PLAYER_HUD_KIEM_COLOR,
}
