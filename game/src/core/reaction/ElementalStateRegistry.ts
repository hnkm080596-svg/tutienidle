// ElementalStateRegistry.ts -- reaction-local import site for the shared
// element <-> definitionId authority (contract sec.19).
//
// The INTERFACE lives in battle/contracts/elemental.ts; the VALIDATING
// FACTORY lives in battle/runtime/elemental/ -- both landed with the
// contract foundation. This barrel re-exports them so core/reaction
// code has one import site and can never grow a parallel registry
// (megaplan: "do not create parallel contract types").

export type { ElementalStateRegistry } from '../battle/contracts/elemental'
export { createElementalStateRegistry } from '../battle/runtime/elemental/ElementalStateRegistryImpl'
