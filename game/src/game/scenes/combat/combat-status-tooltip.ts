// Buff bar (2026-09-02) — tooltip canvas cho status icon: hover/tap icon
// → panel 2 dòng (tên — màu polarity; stacks · thời gian). Một active
// duy nhất; hideFor gắn theo statusInstanceId để onStatusRemoved đóng đúng.
// Flexible rule: vị trí clamp trong viewport mỗi lần show.
// Limitation đã chốt (spec §5): remainingTime là snapshot attach/update —
// decay giữa 2 update không reflect vào tooltip đang mở (≤ vài giây lệch).
import Phaser from 'phaser'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'

const TOOLTIP_BG = 0x241b1b
const TOOLTIP_STROKE = 0xf4f4f0
const TOOLTIP_WIDTH = 120
const TOOLTIP_HEIGHT = 30
const TOOLTIP_MARGIN = 8

const POLARITY_HEX = { buff: '#7bd88f', debuff: '#ff6b6b' } as const

export interface StatusTooltipData {
  name: string
  polarity: 'buff' | 'debuff'
  stacks: number
  remainingTime?: number
  permanent?: boolean
}

interface TooltipParts {
  container: { destroy(): void }
  anchorStatusId: string
}

export class StatusTooltip {
  private active?: TooltipParts

  constructor(private readonly scene: Phaser.Scene) {}

  show(screenX: number, screenY: number, statusInstanceId: string, data: StatusTooltipData) {
    this.hide()

    const clampedX = Math.max(
      TOOLTIP_MARGIN,
      Math.min(screenX, this.scene.scale.width - TOOLTIP_WIDTH - TOOLTIP_MARGIN),
    )
    const clampedY = Math.max(screenY, TOOLTIP_HEIGHT + TOOLTIP_MARGIN)

    const bg = this.scene.add.graphics()
    bg.fillStyle(TOOLTIP_BG, 0.92)
    bg.fillRoundedRect(0, 0, TOOLTIP_WIDTH, TOOLTIP_HEIGHT, 4)
    bg.lineStyle(1, TOOLTIP_STROKE, 0.4)
    bg.strokeRoundedRect(0, 0, TOOLTIP_WIDTH, TOOLTIP_HEIGHT, 4)

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

    const container = this.scene.add.container(clampedX, clampedY, [bg, nameText, detailText])
    container.setDepth(DEPTH_OVERLAY_UI + 8)

    this.active = { container: container as unknown as { destroy(): void }, anchorStatusId: statusInstanceId }
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

    return `×${data.stacks} · ${Math.max(0, Math.ceil(data.remainingTime ?? 0))}s`
  }
}
