// T6.4 bundle code-split contract (Remediation Task 9, 2026-09-05) — CHUYỂN
// khỏi Vitest (`src/bundle-split.test.ts` cũ): chạy `vite build` thật trong
// một test làm suite chậm ~6s và phụ thuộc child-process env. Bây giờ là
// dedicated script — chạy độc lập hoặc sau build qua npm script:
//   node scripts/check-bundle-split.mjs [--dist <dir>]
// Mặc định BUILD MỚI vào thư mục tạm rồi xoá; --dist tái dùng build có sẵn
// (CI: `check-bundle-split dist` sau `npm run build-only`).
//
// Assert (giữ nguyên contract cũ):
// (1) KHÔNG còn 1 bundle khổng lồ duy nhất (entry index-*.js < 900KB),
// (2) Phaser tách chunk riêng (>= 900KB — thư viện ~1.2MB),
// (3) tổng số file JS > 2 (có thêm ít nhất 1 chunk dynamic).

import { execFileSync } from 'node:child_process'
import { rmSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const args = process.argv.slice(2)
const distIndex = args.indexOf('--dist')
const reuseDist = distIndex >= 0 ? args[distIndex + 1] : undefined

const outDir = reuseDist
  ? join(ROOT, reuseDist)
  : join(ROOT, `dist-bundle-check-${Date.now()}`)

function listChunks(dir) {
  const assets = join(dir, 'assets')

  if (!existsSync(assets)) {
    console.error(`check-bundle-split: không thấy ${assets} — dist không hợp lệ.`)
    process.exit(2)
  }

  return readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((file) => ({ file, kb: Math.round(statSync(join(assets, file)).size / 1024) }))
}

let chunks

try {
  if (!reuseDist) {
    const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

    // NODE_ENV=production — child kế thừa env của shell; vite build mode
    // production phải thấy NODE_ENV=production để output khớp bản build
    // thật (khác ~200KB giữa 2 mode — bình luận cũ của test giữ nguyên).
    execFileSync(
      process.execPath,
      [viteBin, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error', '--mode', 'production'],
      {
        cwd: ROOT,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production' },
      },
    )
  }

  chunks = listChunks(outDir)

  const entry = chunks.find((c) => c.file.startsWith('index-'))

  if (!entry) {
    console.error(`FAIL: entry chunk index-*.js phải tồn tại — chunks: ${JSON.stringify(chunks)}`)
    process.exit(1)
  }

  const phaser = chunks.find((c) => c.kb >= 900 && !c.file.startsWith('index-'))

  if (!phaser) {
    console.error(`FAIL: phaser chunk >= 900KB phải tách riêng — chunks: ${JSON.stringify(chunks)}`)
    process.exit(1)
  }

  if (entry.kb >= 900) {
    console.error(`FAIL: entry bundle phải < 900KB (trước rework: 2231KB) — thực tế ${entry.kb}KB`)
    process.exit(1)
  }

  if (chunks.length <= 2) {
    console.error(`FAIL: tổng số file JS phải > 2 (ít nhất 1 chunk dynamic) — thực tế ${chunks.length}`)
    process.exit(1)
  }

  console.log(
    `bundle-split OK: entry ${entry.kb}KB (<900), phaser ${phaser.kb}KB tách riêng, tổng ${chunks.length} chunks`,
  )
} finally {
  if (!reuseDist) {
    rmSync(outDir, { recursive: true, force: true })
  }
}
