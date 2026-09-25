# Novel attack proofs between clean rounds (round A -> B) @ ca14a92f

## INT-B novel attacks (devin-9898b441)
- mid-fight save/load => battle slice dropped; momentum stacks cannot leak across save boundary (GameSave has no battle state)
- respec mid-battle => blocked by resolver guard; stack leak unreachable
- forged KiemY => persisted on swordPath; next cast reads live count via kiemBarBridge each frame
- sealed phong_an ('???', effect:{}) cannot poison name resolver: requires effect.evolutionId
- crafted cross-way node levels stay inert: isOwnedEvolutionNode requires nodeWayApplies
- old saves with dead node ids: shape validation tolerates non-core nodeLevels + string-only purchasedNodeIds -> loads clean AND inert
- RESPEC_PRESERVED_NODE_IDS covers all 3 spine nodes; devReset wipes lien; khoi re-heals on load

## AUT-B novel attacks (devin-c7e361aa)
- ownership seam traced at domain op level (canPurchaseNode->purchaseNode); reconcileWayGrants idempotent re-heal ngu_kiem_khoi for pre-v84 saves
- Roll Cascade / guaranteedHit / Cuu Cung: no live caller dispatching; negative-pin tests cover retired ids
- BalanceMatrix re-baseline rows match new mechanics; no unrelated recipe row edited to force green

## COR-B novel attacks (devin-83cb8c0e? see REV-NK-COR-B)
- cast-local momentum: per-op-block accumulator in plan lane and per-impact landedPriorInstances in engine lane; verified parity vs T3-22b mid-lane alive-break on both lanes
