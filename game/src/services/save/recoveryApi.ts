import { CURRENT_SAVE_VERSION } from './saveVersion'
import type { GameSave } from './saveTypes'
import { validateGameSaveShape } from './saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from './saveAcceptance'

// Beta-final B1.9a - recovery-surface semantics under the remote
// authority. In remote-authoritative mode a manual import is VALIDATION
// ONLY: the file is classified and, when consumable, exported back as a
// canonical normalized copy for manual recovery - it never overwrites
// localStorage and never touches the cloud row. The same pipeline the
// boot load runs (parse -> version -> shape -> acceptance) decides what
// "valid recovery data" means, so a file the server gate would reject is
// rejected here too.
export type RecoveryDataValidation =
  | {
      status: 'valid'
      /** Normalized bytes - the canonical consumable form. */
      normalizedRaw: string
      version: number
    }
  | {
      /** Parses but belongs to another schema version - still exportable
       *  raw bytes for the incompatible surface. */
      status: 'incompatible'
      raw: string
      foundVersion: number | undefined
    }
  | { status: 'invalid' }

export function validateRecoveryData(raw: string): RecoveryDataValidation {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'invalid' }
  }

  if (
    typeof parsed !== 'object'
    || parsed === null
    || !('version' in parsed)
    || !('player' in parsed)
  ) {
    return { status: 'invalid' }
  }

  const foundVersion = (parsed as { version?: unknown }).version

  if (typeof foundVersion !== 'number' || foundVersion !== CURRENT_SAVE_VERSION) {
    return {
      status: 'incompatible',
      raw,
      foundVersion: typeof foundVersion === 'number' ? foundVersion : undefined,
    }
  }

  const shape = validateGameSaveShape(parsed)

  if (!shape.ok) {
    return { status: 'invalid' }
  }

  const normalized = shape.normalizedSave as GameSave

  if (!isSaveAcceptable(normalized, staticSaveAcceptanceCatalogs())) {
    return { status: 'invalid' }
  }

  return { status: 'valid', normalizedRaw: JSON.stringify(normalized), version: foundVersion }
}

/** Provenance stamped onto the export filename so a downloaded artifact
 *  identifies WHERE the bytes came from (cloud-acked vs local slot vs a
 *  validated import) and which revision they carry (B1.9a). */
export interface ExportProvenance {
  source: 'local' | 'cloud' | 'recovery-import'
  revision?: number
}

export function exportFilename(provenance: ExportProvenance | undefined, timestamp: number): string {
  if (!provenance) {
    return `tien-hiep-idle-save-${timestamp}.json`
  }

  const revision = provenance.revision !== undefined ? `-r${provenance.revision}` : ''
  return `tien-hiep-idle-save-${provenance.source}${revision}-${timestamp}.json`
}
