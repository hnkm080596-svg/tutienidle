// B1.8 electron suite setup: the specs drive the REAL packaged wiring
// (dist-electron/main.js + preload + file:// renderer), so the suite
// builds once before the first launch. The backend is stubbed at the
// network layer by each spec (page.route against the supabase origin),
// so this build only needs a parseable supabase config baked in - never
// real credentials (P11).
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default async function electronGlobalSetup(): Promise<void> {
  const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

  execFileSync(process.execPath, [path.join(gameRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
    cwd: gameRoot,
    env: {
      ...process.env,
      ELECTRON: '1',
      VITE_BACKEND_MODE: 'supabase',
      VITE_SUPABASE_URL: 'https://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'stub-anon-key-for-electron-specs',
    },
    stdio: 'inherit',
  })
}
