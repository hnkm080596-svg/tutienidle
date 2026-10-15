// Mode is immutable for one runtime. Switching requires a full reload so
// pending writes and backend singletons never cross a mode boundary.
export const TEST_SANDBOX_ACCOUNT_ID = 'local-test-sandbox-v1'
const MODE_KEY = 'tutienidle-test-sandbox-v1'
export const testSandboxAvailable = import.meta.env.DEV

function readMode(): boolean {
  if (!testSandboxAvailable) return false
  try { return localStorage.getItem(MODE_KEY) === '1' } catch { return false }
}

export const testSandboxActive = readMode()

export function setTestSandboxMode(active: boolean): void {
  if (!testSandboxAvailable) throw new Error('Test sandbox requires a development build')
  // Write errors propagate to the surface; never reload into an unpersisted mode.
  localStorage.setItem(MODE_KEY, active ? '1' : '0')
}
