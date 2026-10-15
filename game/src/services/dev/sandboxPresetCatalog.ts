import { isBetaWay } from '@/core/betaScope'

export type SandboxPreset = 'mortal' | 'spell' | 'body'

export function isSandboxPresetAvailable(preset: SandboxPreset): boolean {
  return preset === 'mortal' || isBetaWay(preset === 'spell' ? 'spell_pathway' : 'body_pathway')
}
