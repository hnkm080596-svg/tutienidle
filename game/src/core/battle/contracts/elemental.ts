// contracts/elemental.ts -- ElementalStateRegistry interface (contract
// sec.19). Reaction does not treat every elemental buff as canonical
// reaction state -- this registry is the shared element <-> definitionId
// authority. Interface only; the validating factory lives in
// runtime/elemental/.
//
// Locked baseline (contract sec.19):
//   fire  -> hoa_an
//   water -> han_tuc
//   wood  -> doc_can
//   metal -> liet_thuong
//   earth -> tran_an

import type { ElementType } from '../../element/ElementType'

import type { BuffDefinitionId } from './ids'

export interface ElementalStateRegistry {
  getDefinitionId(element: ElementType): BuffDefinitionId
  getElement(definitionId: BuffDefinitionId): ElementType | null
}
