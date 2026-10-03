// combatTestHarness (Remediation Task 8, 2026-09-05) - typed adapter thay
// the `as any` lap lai trong 12+ CombatScene test file.CombatScene private
// fields khong test duoc qua public type - mot assertion boundary CUC BO
// tai day expose Record-typed scene view; test consume interface nay thay
// vi cast any tung file. KHONG dung trong production code.
import { CombatScene } from '../CombatScene'

/**
 * Typed view cua CombatScene cho test: private/readonly fields cua scene
 * la chi tiet test phai stub/ghi de bang PARTIAL stubs (graphics/tweens/
 * time... chi can vai method) - mapping sau keyof CombatScene ep stubs du
 * full interface la vo ich. Boundary DUY NHAT: scene coi nhu record
 * dynamic; MOI `as any` cu o 12+ file test nay di qua mot cho nay, duoc
 * ghi chep + audit duoc. Production KHONG dung type nay.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CombatSceneTestView = Record<string, any>

/**
 * Tao scene instance cho test. `new CombatScene()` (constructor that) khi
 * can class fields co identity that (lifecycle tests); `Object.create`
 * (khong chay constructor) khi test method thuan.
 */
export function createTestScene(
  mode: 'construct' | 'bare' = 'construct',
): CombatSceneTestView {
  const scene =
    mode === 'construct'
      ? new CombatScene()
      : Object.create(CombatScene.prototype)

  return scene as CombatSceneTestView
}

/**
 * Gan nhieu stub fields mot lan - ghi qua boundary duy nhat nay thay vi
 *cast tung field.
 */
export function patchScene(
  scene: CombatSceneTestView,
  patches: Record<string, unknown>,
): CombatSceneTestView {
  Object.assign(scene, patches)

  return scene
}
