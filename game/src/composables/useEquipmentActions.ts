import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import { useActionFeedbackStore } from '../stores/actionFeedback'
import { actionFailureKey, ACTION_FAILURE_FALLBACK_KEY } from '../core/presentation/ActionAvailability'
import type { EquipmentSlot } from '../core/equipment/EquipmentTypes'
import type { RolledAffix } from '../core/equipment/RolledAffix'
import type { RefineValueEntry } from '../core/equipment/EquipmentSystem'

/**
 * Modifier equipment la "tinh" (xem ghi chu trong Player.ts/
 * EquipmentSystem.ts) - chi doi khi co hanh dong ro rang, KHONG tu
 * gop moi tick. Moi noi trong UI goi equip/unequip/enhance/Tay/Tinh/
 * Hoa deu phai qua day de dong bo player.modifiers ngay sau do.
 *
 * (2026-08-25, resource-professions-rework plan sec7) - Khi Duong chi con
 * bon operation: Cuong Hoa (slot), Tay Luyen (identity), Tinh Luyen
 * (dong du dieu kien tang 5-20%, clamp tran tier + khoa), Hoa Luyen
 * (destructive -> Tinh Hoa).
 */
export function useEquipmentActions() {
  const gameManager = useGameManager()

  const player = usePlayerStore()

  const { bumpState } = useStateVersion()

  const feedback = useActionFeedbackStore()

  // i18n (task 2.2 lo 1) - composable KHONG import i18n: chi day locale key
  // vao feedback store, ActionFeedbackLog t() tai diem render. successKey/
  // errorKey gui messageKey + params (gia tri param cung la locale key).
  const OP_LABEL_KEYS = {
    equip: 'actionFeedback.ops.equip.label',
    enhance: 'actionFeedback.ops.enhance.label',
    wash: 'actionFeedback.ops.wash.label',
    refine: 'actionFeedback.ops.refine.label',
    dissolve: 'actionFeedback.ops.dissolve.label',
  } as const

  type OpId = keyof typeof OP_LABEL_KEYS

  function reportFailure(op: OpId, reason: string | undefined) {
    feedback.errorKey('actionFeedback.failed', {
      label: OP_LABEL_KEYS[op],
      reason: actionFailureKey(reason) ?? ACTION_FAILURE_FALLBACK_KEY,
    })
  }

  function syncEquipmentModifiers() {
    player.setEquipmentModifiers(gameManager.equipmentOps.getEquipmentModifiers())
  }

  function withSync(ok: boolean): boolean {
    if (ok) {
      syncEquipmentModifiers()

      bumpState()
    }

    return ok
  }

  // Workstream A sec3.3 - that bai KHONG mutate state, thanh cong/that bai
  // deu bao qua "Nhat ky thao tac" voi ly do da dich cu the (key + t()).
  function withSyncAndResult(result: { ok: boolean; reason?: string }, op: OpId): boolean {
    if (withSync(result.ok)) {
      feedback.successKey('actionFeedback.success', { label: OP_LABEL_KEYS[op] })
    } else {
      reportFailure(op, result.reason)
    }

    return result.ok
  }

  function dissolve(instanceIds: readonly string[]): boolean {
    const result = gameManager.equipmentOps.dissolveItems(instanceIds)

    if (result.ok && result.rewards) {
      for (const reward of result.rewards) {
        const material = gameManager.materialRegistry.has(reward.materialId)
          ? gameManager.materialRegistry.get(reward.materialId)
          : undefined

        // Ten nguyen lieu la data-layer (loat 2.7) - day chuoi thuong.
        feedback.success(`Hóa Luyện: ${material?.name ?? 'Nguyên liệu không xác định'} ×${reward.amount}`)
      }

      syncEquipmentModifiers()

      bumpState()
    } else if (!result.ok) {
      reportFailure('dissolve', result.reason)
    }

    return result.ok
  }

  return {
    equip: (instanceId: string) =>
      withSyncAndResult(gameManager.equipmentOps.equipItem(instanceId, player.$state), 'equip'),

    unequip: (instanceId: string) => withSync(gameManager.equipmentOps.unequipItem(instanceId)),

    // Cuong Hoa gan SLOT (slot-level rework) - slot trong van nang duoc.
    enhance: (slot: EquipmentSlot) =>
      withSyncAndResult(gameManager.equipmentOps.enhanceSlot(slot, player.$state), 'enhance'),

    // wash() one-shot removed (owner ruling 2026-10-08): it bypassed the
    // preview-then-commit ticket flow and had zero callers. The domain
    // method equipmentSystem.washAffixes stays - it is the scope-hidden
    // dormant implementation covered by EquipmentSystem.wash.test.ts.

    // refine() one-shot removed (owner ruling 2026-10-08): same bypass
    // pattern as the deleted wash() - zero callers, the live path goes
    // through refinePreview -> refineCommit tickets.

    /**
     * Xem truoc Tay Luyen (2026-08-30, UI "giu/bo") - roll + TRU COST NGAY
     * nhung KHONG ghi vao instance. R9 (AR-21): tra mot-use TICKET -
     * affixes hien thi doc qua washPreviewAffixes(ticketId); UI giu
     * ticketId o state tam roi goi washCommit(ticketId) khi bam "Giu".
     * That bai (thieu nguyen lieu...) bao qua Nhat ky thao tac giong moi
     * action khac - KHONG bumpState vi chua mutate gi neu fail, co
     * bumpState neu thanh cong (cost da tru).
     */
    washPreview: (instanceId: string): string | null => {
      const result = gameManager.equipmentOps.previewWashItem(instanceId)

      if (!result.ok || !result.ticketId) {
        reportFailure('wash', result.reason)

        return null
      }

      syncEquipmentModifiers()

      bumpState()

      return result.ticketId
    },

    /** R9 (AR-21) - display copy of the pending wash roll by ticket. */
    washPreviewAffixes: (ticketId: string): RolledAffix[] | null =>
      gameManager.equipmentOps.getWashPreviewAffixes(ticketId)?.affixes ?? null,

    /** R9 (AR-21) - drop the pending wash ticket (UI re-roll/cancel). */
    washDiscard: (ticketId: string): void => {
      gameManager.equipmentOps.discardWashTicket(ticketId)
    },

    /**
     * Chot ket qua da washPreview() - khong tru cost lan nua. R9 (AR-21):
     * commit nhan TICKET ID; affixes ap la ban domain-owned.
     */
    washCommit: (instanceId: string, ticketId: string) =>
      withSyncAndResult(gameManager.equipmentOps.commitWashItem(instanceId, ticketId), 'wash'),

    /** Xem truoc Tinh Luyen (2026-08-30, UI "giu/bo") - cung co che washPreview. */
    refinePreview: (instanceId: string, lockedIndices: readonly number[]): RefineValueEntry[] | null => {
      const result = gameManager.equipmentOps.previewRefineItem(instanceId, lockedIndices)

      if (!result.ok || !result.values) {
        reportFailure('refine', result.reason)

        return null
      }

      syncEquipmentModifiers()

      bumpState()

      return result.values
    },

    /** Chot values da refinePreview() - khong tru cost lan nua. */
    refineCommit: (instanceId: string, values: RefineValueEntry[]) =>
      withSyncAndResult(gameManager.equipmentOps.commitRefineItem(instanceId, values), 'refine'),

    /** Bo preview Refine o ca UI lan capability core; khong hoan lai cost da roll. */
    refineDiscard: (instanceId?: string) => gameManager.equipmentOps.discardRefinePreview(instanceId),

    /** Hoa Luyen batch all-or-nothing (sec7.5). */
    dissolve,
  }
}
