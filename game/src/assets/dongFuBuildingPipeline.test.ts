// @vitest-environment node
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { execFileSync } from 'node:child_process'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { tmpdir } from 'node:os'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { join } from 'node:path'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const buildingIds = [
  'spirit_spring',
  'equipment_hall',
  'pill_room',
  'teleport_array',
  'gathering_outpost',
  'vendor',
] as const

const temporaryRoots: string[] = []
const script = fileURLToPath(new URL('../../scripts/build-dong-fu-building-layers.ps1', import.meta.url))

function magick(...args: string[]): string {
  return execFileSync('magick', args, { encoding: 'utf8' }).trim()
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('Dong Fu building layer pipeline', () => {
  it('rebuilds six aligned RGBA stacks from the approved white redesign masters', () => {
    const root = mkdtempSync(join(tmpdir(), 'dong-fu-building-pipeline-'))
    temporaryRoots.push(root)
    const masterRoot = join(root, 'art-source/buildings/dong-fu/v2/masters-redesign')
    const sharedRoot = join(root, 'art-source/buildings/dong-fu/v2/shared')
    mkdirSync(masterRoot, { recursive: true })
    mkdirSync(sharedRoot, { recursive: true })

    for (const id of buildingIds) {
      magick(
        '-size', '64x64', 'xc:white',
        '-fill', '#51493e', '-draw', 'rectangle 16,16 47,55',
        join(masterRoot, `${id}-white.png`),
      )
    }
    magick(
      '-size', '32x32', 'xc:none',
      '-fill', '#b54432', '-draw', 'circle 16,16 16,4',
      join(sharedRoot, 'locked-seal-source.png'),
    )

    expect(() => execFileSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ProjectRoot', root],
      { encoding: 'utf8' },
    )).not.toThrow()

    for (const id of buildingIds) {
      const directory = join(root, 'public/assets/buildings/dong-fu/v2', id)
      for (const name of ['base.png', 'ground-shadow.png', 'locked-overlay.png', 'silhouette-mask.png']) {
        const file = join(directory, name)
        expect(magick('identify', '-format', '%w,%h,%[channels]', file), `${id}/${name}`).toBe(
          '1254,1254,srgba 4.0',
        )
      }
    }
  }, 180_000)
})
