// T6.4 bundle code-split contract — chạy `vite build` thật và assert:
// (1) KHÔNG còn 1 bundle khổng lồ duy nhất (index < 900KB),
// (2) Phaser tách chunk riêng (>= 900KB — thư viện ~1.2MB),
// (3) tổng số file JS > 2 (có thêm ít nhất 1 chunk dynamic).
// Chậm (~6s build) — thuộc suite nhưng chịu timeout riêng.
// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: dongFuBuildingPipeline.test.ts); Vitest supplies at runtime.
import { execFileSync } from 'node:child_process'
// @ts-expect-error see above
import { rmSync, readdirSync, statSync } from 'node:fs'
// @ts-expect-error see above
import { join } from 'node:path'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const gameRoot = fileURLToPath(new URL('../', import.meta.url))

function buildAndListChunks(): Array<{ file: string; kb: number }> {
  const outDirName = `dist-split-test-${Date.now()}`

  try {
    // Gọi vite binary TRỰC TIẾP từ node_modules — npx có thể resolve cache
    // khác (rolldown version sai, build 87ms fail).
    const viteBin = join(gameRoot, 'node_modules', 'vite', 'bin', 'vite.js')

    // @ts-expect-error process supplied by Node runtime; project omits ambient types by design.
    execFileSync(process.execPath, [viteBin, 'build', '--outDir', outDirName, '--emptyOutDir', '--logLevel', 'error', '--mode', 'production'], {
      cwd: gameRoot,
      stdio: 'pipe',
      // Vitest chạy với NODE_ENV=test và child kế thừa — vite build mode
      // production phải thấy NODE_ENV=production để output khớp bản
      // build thật (khác 200KB giữa 2 mode).
      // @ts-expect-error process supplied by Node runtime; project omits ambient types by design.
      env: { ...process.env, NODE_ENV: 'production' },
    })

    const assets = join(gameRoot, outDirName, 'assets')

    return readdirSync(assets)
      .filter((f: string) => f.endsWith('.js'))
      .map((file: string) => ({ file, kb: Math.round(statSync(join(assets, file)).size / 1024) }))
  } finally {
    rmSync(join(gameRoot, outDirName), { recursive: true, force: true })
  }
}

describe('bundle code-split (T6.4)', () => {
  it(
    'splits phaser vendor + dynamic game chunk out of the entry bundle',
    () => {
      const chunks = buildAndListChunks()

      const entry = chunks.find((c) => c.file.startsWith('index-'))

      expect(entry, 'entry chunk index-*.js phải tồn tại').toBeDefined()

      const phaser = chunks.find((c) => c.kb >= 900 && !c.file.startsWith('index-'))

      expect(
        phaser,
        `phaser chunk >= 900KB phải tách riêng — các chunk: ${JSON.stringify(chunks)}`,
      ).toBeDefined()

      expect(
        entry!.kb,
        `entry bundle phải < 900KB (trước rework: 2231KB) — thực tế ${entry!.kb}KB`,
      ).toBeLessThan(900)

      expect(chunks.length).toBeGreaterThan(2)
    },
    120_000,
  )
})
