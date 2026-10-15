import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AUDIO_CUES } from '../../src/core/audio/AudioCueManifest'

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url))

describe('UI soundpack asset wiring', () => {
  it('every installed cue references a real, nonempty WAV', () => {
    const sources = new Set<string>()
    let wiredCues = 0
    for (const [id, def] of Object.entries(AUDIO_CUES)) {
      const urls = typeof def.src === 'string' ? [def.src] : def.src
      const soundpackPaths = urls.filter((src) => src.startsWith('/assets/audio/ui/'))
      if (soundpackPaths.length === 0) continue
      wiredCues++
      for (const src of soundpackPaths) {
        sources.add(src)
        const path = join(PUBLIC_DIR, src.slice(1))
        expect(existsSync(path), `${id} references missing ${src}`).toBe(true)
        const wav = readFileSync(path)
        expect(wav.length, `${id} references an empty WAV`).toBeGreaterThan(44)
        expect(wav.toString('ascii', 0, 4), `${id} is not RIFF`).toBe('RIFF')
        expect(wav.toString('ascii', 8, 12), `${id} is not WAVE`).toBe('WAVE')
      }
    }
    expect(wiredCues).toBe(37)
    expect(sources.size).toBe(43)
  })
})
