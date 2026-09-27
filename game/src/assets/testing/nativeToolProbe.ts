// Test-only probe for optional external toolchain binaries (ImageMagick,
// PowerShell) so asset tests can skip cleanly instead of crashing on ENOENT.
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { spawnSync } from 'node:child_process'
// @ts-expect-error see above
import { platform } from 'node:os'

export const IS_WINDOWS = platform() === 'win32'

/** True when `command args` exits 0 within the probe budget. */
export function probeBinary(command: string, args: string[]): boolean {
  try {
    const result = spawnSync(command, args, { stdio: 'ignore', timeout: 15_000 })
    return result.error === undefined && result.status === 0
  } catch {
    return false
  }
}

/** Resolve ImageMagick: IM7 `magick`, else IM6 `convert`. `convert` is never
 *  probed on Windows -- System32 ships an unrelated filesystem tool under
 *  that name which would hijack the probe. */
export function resolveMagick(): string | null {
  if (probeBinary('magick', ['-version'])) return 'magick'
  if (!IS_WINDOWS && probeBinary('convert', ['-version'])) return 'convert'
  return null
}

/** Resolve a PowerShell host capable of running the asset .ps1 scripts. */
export function resolvePowerShell(): 'powershell.exe' | 'pwsh' | null {
  if (IS_WINDOWS && probeBinary('powershell.exe', ['-NoProfile', '-Command', '1'])) {
    return 'powershell.exe'
  }
  return probeBinary('pwsh', ['-NoProfile', '-Command', '1']) ? 'pwsh' : null
}
