// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('archived UI authoring producers', () => {
  for (const script of ['migrate-tien-hiep-surfaces.mjs', 'scope-tien-hiep-skin.mjs']) {
    it(`${script} refuses before mutating its consumers`, () => {
      const parent = resolve('scripts')
      const sandbox = mkdtempSync(join(parent, '.archived-ui-proof-'))
      try {
        mkdirSync(join(sandbox, 'src/components'), { recursive: true })
        mkdirSync(join(sandbox, 'src/assets'), { recursive: true })
        mkdirSync(join(sandbox, 'docs/design/tien-hiep-ui-redesign-2026-10-05'), { recursive: true })
        const component = join(sandbox, 'src/components/Example.vue')
        const stylesheet = join(sandbox, 'src/assets/tien-hiep-ui.css')
        const manifest = join(sandbox, 'docs/design/tien-hiep-ui-redesign-2026-10-05/MIGRATED-DIRECT-CONSUMERS.json')
        const content = '<img src="/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png">'
        const css = '.example { color: gold; }'
        const sentinel = '["preserved"]'
        writeFileSync(component, content)
        writeFileSync(stylesheet, css)
        writeFileSync(manifest, sentinel)
        const execution = spawnSync(process.execPath, [join(parent, script)], { cwd: sandbox, encoding: 'utf8' })
        expect(execution.error).toBeUndefined()
        expect(execution.status).toBe(1)
        expect(execution.stderr).toContain('Archived one-time')
        expect(readFileSync(component, 'utf8')).toBe(content)
        expect(readFileSync(stylesheet, 'utf8')).toBe(css)
        expect(readFileSync(manifest, 'utf8')).toBe(sentinel)
      } finally {
        // The absolute target was created directly under this checkout's scripts folder.
        rmSync(sandbox, { recursive: true, force: true })
      }
    })
  }
})
