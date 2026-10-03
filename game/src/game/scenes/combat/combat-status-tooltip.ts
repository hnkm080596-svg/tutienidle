// Buff bar (2026-09-02) - tooltip canvas cho status icon: hover/tap icon
// -> panel 2 dong (ten - mau polarity; stacks * thoi gian). Mot active
// duy nhat; hideFor gan theo statusInstanceId de onStatusRemoved dong dung.
// Flexible rule: vi tri clamp trong viewport moi lan show.
// Limitation da chot (spec sec5): remainingTime la snapshot attach/update -
// decay giua 2 update khong reflect vao tooltip dang mo. Phase A6 (9.5 #7):
// gia tri gio la so LUOT (turn engine feed), render "N luot".
import Phaser from 'phaser'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'

const TOOLTIP_BG = 0x241b1b
const TOOLTIP_STROKE = 0xf4f4f0
const TOOLTIP_WIDTH = 120
const TOOLTIP_HEIGHT = 30
const TOOLTIP_MARGIN = 8
/** Phap Tu Reimagine (F13) -- extra readout row (e.g. live Ho The DR).
 * The panel grows one row taller when extraLine is present. */
const TOOLTIP_EXTRA_LINE_HEIGHT = 12

const POLARITY_HEX = { buff: '#7bd88f', debuff: '#ff6b6b' } as const

export interface StatusTooltipData {
  name: string
  polarity: 'buff' | 'debuff'
  stacks: number
  remainingTime?: number
  permanent?: boolean
  /** Optional live readout line rendered under the detail row -- the
   *  caller resolves the value per show() (nothing is snapshotted). */
  extraLine?: string
}

interface TooltipParts {
  container: Phaser.GameObjects.Container
  anchorStatusId: string
}

export class StatusTooltip {
  private active?: TooltipParts

  constructor(private readonly scene: Phaser.Scene) {}

  show(screenX: number, screenY: number, statusInstanceId: string, data: StatusTooltipData) {
    this.hide()

    const height = TOOLTIP_HEIGHT + (data.extraLine ? TOOLTIP_EXTRA_LINE_HEIGHT : 0)

    const clampedX = Math.max(
      TOOLTIP_MARGIN,
      Math.min(screenX, this.scene.scale.width - TOOLTIP_WIDTH - TOOLTIP_MARGIN),
    )
    const clampedY = Math.max(screenY, height + TOOLTIP_MARGIN)

    const bg = this.scene.add.graphics()
    bg.fillStyle(TOOLTIP_BG, 0.92)
    bg.fillRoundedRect(0, 0, TOOLTIP_WIDTH, height, 4)
    bg.lineStyle(1, TOOLTIP_STROKE, 0.4)
    bg.strokeRoundedRect(0, 0, TOOLTIP_WIDTH, height, 4)

    const polarityHex = data.polarity === 'buff' ? POLARITY_HEX.buff : POLARITY_HEX.debuff

    const nameText = this.scene.add.text(6, 4, data.name, {
      fontSize: '11px',
      fontStyle: 'bold',
      color: polarityHex,
    })

    const detailText = this.scene.add.text(6, 16, this.formatDetail(data), {
      fontSize: '10px',
      color: '#f4f4f0',
    })

    const children: Phaser.GameObjects.GameObject[] = [bg, nameText, detailText]

    if (data.extraLine) {
      children.push(
        this.scene.add.text(6, TOOLTIP_HEIGHT - 2, data.extraLine, {
          fontSize: '10px',
          color: '#7ec8a9',
        }),
      )
    }

    const container = this.scene.add.container(clampedX, clampedY, children)
    container.setDepth(DEPTH_OVERLAY_UI + 8)

    this.active = { container, anchorStatusId: statusInstanceId }
  }

  hide() {
    this.active?.container.destroy()
    this.active = undefined
  }

  hideFor(statusInstanceId: string) {
    if (this.active?.anchorStatusId === statusInstanceId) {
      this.hide()
    }
  }

  isOpenFor(statusInstanceId: string): boolean {
    return this.active?.anchorStatusId === statusInstanceId
  }

  private formatDetail(data: StatusTooltipData): string {
    if (data.permanent) {
      return `×${data.stacks} · vĩnh viễn`
    }

    return `×${data.stacks} · ${Math.max(0, Math.ceil(data.remainingTime ?? 0))} lượt`
  }
}
