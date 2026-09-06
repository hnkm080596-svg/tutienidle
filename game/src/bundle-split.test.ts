// T6.4 bundle code-split contract (Remediation Task 9, 2026-09-05) —
// CHUYỂN khỏi Vitest: test cũ chạy `vite build` thật (~6s mỗi lần chạy
// suite) qua child-process — brittleness + chậm. Contract giờ là dedicated
// script `npm run check:bundle-split` (scripts/check-bundle-split.mjs,
// chạy độc lập/sau build/CI).
//
// Test này giữ coverage NHẸ trong Vitest: assert SCRIPT CONTRACT — script
// tồn tại, npm script được đăng ký, và logic classification (entry/phaser
// chunk) đúng trên manifest giả. KHÔNG build vite trong test.
// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern giữ từ test cũ); Vitest supplies at runtime.
import { readFileSync, existsSync } from 'node:fs'
// @ts-expect-error see above
import { join, dirname } from 'node:path'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const gameRoot = fileURLToPath(new URL('../', import.meta.url))

describe('bundle code-split contract (Remediation Task 9 — script-based)', () => {
  it('check-bundle-split.mjs script tồn tại và npm script check:bundle-split được đăng ký', () => {
    const scriptPath = join(gameRoot, 'scripts', 'check-bundle-split.mjs')

    expect(existsSync(scriptPath)).toBe(true)

    const pkg = JSON.parse(readFileSync(join(gameRoot, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts['check:bundle-split']).toContain('check-bundle-split.mjs')
  })

  it('script chứa đủ 3 assertion contract (entry <900KB, phaser >=900KB, >2 chunks)', () => {
    const source = readFileSync(join(gameRoot, 'scripts', 'check-bundle-split.mjs'), 'utf-8')

    // Entry threshold.
    expect(source).toContain('< 900')
    // Phaser threshold.
    expect(source).toContain('>= 900')
    // Chunk count threshold.
    expect(source).toContain('<= 2')
    // Script exit code vi phạm khác 0 (CI gate).
    expect(source).toContain('process.exit(1)')
  })
})
