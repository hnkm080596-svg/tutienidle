import type { EventBus } from '../events/EventBus'
import type { EquipmentBag } from '../equipment/EquipmentBag'
import type { EquipmentSlotManager } from '../equipment/EquipmentSlotManager'
import { FormationRegistry } from './FormationRegistry'
import { FormationBag } from './FormationBag'
import { addStack } from '../stats/StatCalculator'
import {
  EVENT_TO_TRIGGER,
  PLAYER_ID,
  TARGET_BASED_TRIGGERS,
} from '../skill/PassiveSystem'
import type { CombatEventPayload } from '../skill/PassiveSystem'

// Chỉ có đúng 1 slot 'weapon' nên accumulator không cần khoá theo
// instanceId — MASTER SPEC Mục XVI (Phase 9), Formation giờ gắn SLOT
// chứ không theo instance vũ khí cụ thể.
const WEAPON_ACCUMULATOR_KEY = 'weapon'

/**
 * Trigger + tích stack dùng chung logic với PassiveSystem (xem
 * EVENT_TO_TRIGGER re-export ở đó) nhưng chỉ xét socketedFormation
 * của SLOT 'weapon' (EquipmentSlotManager, Phase 9) — trận pháp gắn
 * theo slot vũ khí, không theo instance/nhân vật. Đổi vũ khí trong
 * slot đó KHÔNG mất trận pháp đã khảm/stack đã tích.
 */
export class FormationSystem {
  private readonly perSecondAccumulator = new Map<string, number>()

  constructor(
    eventBus: EventBus,
    private readonly equipmentBag: EquipmentBag,
    private readonly slotManager: EquipmentSlotManager,
  ) {
    for (const eventName of Object.keys(EVENT_TO_TRIGGER)) {
      eventBus.on<CombatEventPayload>(eventName, event => this.handleEvent(eventName, event))
    }
  }

  socket(
    formationId: string,
    instanceId: string,
    formationBag: FormationBag,
    registry: FormationRegistry,
  ): boolean {
    if (!formationBag.has(formationId, 1)) {
      return false
    }

    // instanceId chỉ dùng để GATE UX (phải bấm từ 1 item vũ khí trong
    // bag) — state thật ghi vào slot 'weapon', không phải instance
    // này, nên vũ khí không cần đang equipped mới khảm được.
    const instance = this.equipmentBag.get(instanceId)

    const slotState = this.slotManager.get('weapon')

    if (!instance || instance.slot !== 'weapon' || slotState.socketedFormation) {
      return false
    }

    const template = registry.get(formationId)

    slotState.socketedFormation = {
      formationId: template.id,

      trigger: template.trigger,

      // Deep clone, stacks reset về 0 — trận pháp mới khảm chưa
      // tích luỹ gì.
      modifiers: template.modifiers.map(modifier => ({ ...modifier, stacks: 0 })),
    }

    formationBag.remove(formationId, 1)

    return true
  }

  /**
   * Tháo trận pháp trả về bag — mất hết stack đã tích (coi như
   * "nguội" khi tháo ra). Không còn cần instanceId (state ở slot,
   * không ở item cụ thể nào).
   */
  unsocket(formationBag: FormationBag, registry: FormationRegistry): boolean {
    const slotState = this.slotManager.get('weapon')

    if (!slotState.socketedFormation) {
      return false
    }

    const template = registry.get(slotState.socketedFormation.formationId)

    formationBag.add(template, 1)

    slotState.socketedFormation = undefined

    return true
  }

  private handleEvent(eventName: string, event: CombatEventPayload) {
    const trigger = EVENT_TO_TRIGGER[eventName]

    if (!trigger) {
      return
    }

    const relevant = TARGET_BASED_TRIGGERS.includes(trigger)
      ? event.targetId === PLAYER_ID
      : event.sourceId === PLAYER_ID

    if (!relevant) {
      return
    }

    // Formation chỉ có hiệu lực khi CÓ vũ khí đang trang bị (đúng
    // flavor "khảm vào vũ khí") — dù trận pháp thuộc slot chứ không
    // thuộc item, slot trống thì coi như chưa "kích hoạt" được.
    if (!this.equipmentBag.getEquippedInSlot('weapon')) {
      return
    }

    const socketedFormation = this.slotManager.get('weapon').socketedFormation

    if (!socketedFormation || socketedFormation.trigger !== trigger) {
      return
    }

    for (const modifier of socketedFormation.modifiers) {
      addStack(modifier)
    }
  }

  tick(deltaSeconds: number) {
    if (!this.equipmentBag.getEquippedInSlot('weapon')) {
      return
    }

    const socketedFormation = this.slotManager.get('weapon').socketedFormation

    if (!socketedFormation || socketedFormation.trigger !== 'per_second') {
      return
    }

    const accumulated = (this.perSecondAccumulator.get(WEAPON_ACCUMULATOR_KEY) ?? 0) + deltaSeconds

    const wholeSeconds = Math.floor(accumulated)

    if (wholeSeconds <= 0) {
      this.perSecondAccumulator.set(WEAPON_ACCUMULATOR_KEY, accumulated)

      return
    }

    for (const modifier of socketedFormation.modifiers) {
      addStack(modifier, wholeSeconds)
    }

    this.perSecondAccumulator.set(WEAPON_ACCUMULATOR_KEY, accumulated - wholeSeconds)
  }
}
