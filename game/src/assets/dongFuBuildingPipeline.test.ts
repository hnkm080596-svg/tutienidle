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
import { IS_WINDOWS, probeBinary, resolvePowerShell } from './testing/nativeToolProbe'

const buildingIds = [
  'chi_hien_quan',
  'equipment_hall',
  'pill_room',
  'teleport_array',
  'gathering_outpost',
  'vendor',
] as const

const temporaryRoots: string[] = []
const script = fileURLToPath(new URL('../../scripts/build-dong-fu-building-layers.ps1', import.meta.url))

// The .ps1 hardcodes `& magick` internally, so an IM6 `convert` shim cannot
// satisfy it -- the IM7 entrypoint plus a PowerShell host (powershell.exe on
// Windows, pwsh elsewhere) are both required, else skip instead of ENOENT.
const powershell = resolvePowerShell()
const pipelineAvailable = powershell !== null && probeBinary('magick', ['-version'])

function magick(...args: string[]): string {
  return execFileSync('magick', args, { encoding: 'utf8' }).trim()
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('Dong Fu building layer pipeline', () => {
  it.skipIf(!pipelineAvailable)('rebuilds six aligned RGBA stacks from the approved white redesign masters', () => {
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

    // -ExecutionPolicy Bypass exists only on Windows PowerShell; pwsh on
    // POSIX runs unsigned local scripts without it.
    const scriptArgs = IS_WINDOWS
      ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ProjectRoot', root]
      : ['-NoProfile', '-File', script, '-ProjectRoot', root]
    expect(() => execFileSync(
      powershell!,
      scriptArgs,
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
