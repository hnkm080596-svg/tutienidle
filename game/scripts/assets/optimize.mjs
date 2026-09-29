// Asset optimizer for the CDN upload set (asset-cdn plan, phase 0).
//
// Walks public/assets and produces a byte-optimized mirror at cdn-assets/.
// Filenames and directory layout are preserved exactly - atlas JSONs, the
// asset catalog and CSS urls all reference the same paths, so a drop-in
// upload can never desync references.
//
// PNGs are palette-quantized via sharp (`png({palette:true})`), which is
// the dominant win for sprite sheets (typically -60..80%). JPEGs are
// re-encoded at quality 82. WebP is emitted optionally with --webp
// (same basename, .webp extension) for manual migration experiments.
// Everything else (json, ogg, mp3, svg, already-small files) is copied.
//
// Usage:
//   node scripts/assets/optimize.mjs [--webp] [--min-kb N] [--src DIR] [--out DIR]
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const get = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : fallback
}
const SRC = path.resolve(get('--src', 'public/assets'))
const OUT = path.resolve(get('--out', 'cdn-assets'))
const WEBP = args.includes('--webp')
const MIN_KB = Number(get('--min-kb', '0'))

const COPY_EXTENSIONS = new Set(['.json', '.ogg', '.mp3', '.svg', '.webm', '.txt'])

const walk = function* (dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else {
      yield full
    }
  }
}

const stats = { files: 0, optimized: 0, copied: 0, skippedSmall: 0, srcBytes: 0, outBytes: 0 }
const failures = []

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file)
  const dest = path.join(OUT, rel)
  mkdirSync(path.dirname(dest), { recursive: true })
  const srcSize = statSync(file).size
  stats.files += 1
  stats.srcBytes += srcSize

  const ext = path.extname(file).toLowerCase()

  try {
    if (srcSize < MIN_KB * 1024) {
      copyFileSync(file, dest)
      stats.skippedSmall += 1
      stats.outBytes += srcSize
      continue
    }

    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      let image = sharp(file, { limitInputPixels: false })
      if (ext === '.png') {
        image = image.png({ palette: true, quality: 85, compressionLevel: 9 })
      } else {
        image = image.jpeg({ quality: 82, mozjpeg: true })
      }
      const buffer = await image.toBuffer()

      if (buffer.length < srcSize) {
        writeFileSync(dest, buffer)
        stats.optimized += 1
        stats.outBytes += buffer.length
      } else {
        // Quantization can lose on tiny palettes - never ship a regression.
        copyFileSync(file, dest)
        stats.copied += 1
        stats.outBytes += srcSize
      }

      if (WEBP) {
        const webpDest = dest.replace(/\.(png|jpe?g)$/i, '.webp')
        const webpBuffer = await sharp(file, { limitInputPixels: false })
          .webp({ quality: 82, effort: 6 })
          .toBuffer()
        writeFileSync(webpDest, webpBuffer)
      }
      continue
    }

    copyFileSync(file, dest)
    stats.copied += 1
    stats.outBytes += srcSize
  } catch (err) {
    failures.push({ rel, error: String(err?.message ?? err) })
    copyFileSync(file, dest) // never drop an asset: fall back to the source bytes
    stats.copied += 1
    stats.outBytes += srcSize
  }
}

const mb = (n) => (n / 1024 / 1024).toFixed(1)
console.log(
  `optimized ${stats.optimized}/${stats.files} files ` +
    `(${stats.copied} copied, ${stats.skippedSmall} below threshold): ` +
    `${mb(stats.srcBytes)}MB -> ${mb(stats.outBytes)}MB ` +
    `(${stats.srcBytes ? ((1 - stats.outBytes / stats.srcBytes) * 100).toFixed(1) : 0}% saved)`,
)
if (failures.length > 0) {
  console.error(`${failures.length} file(s) failed to optimize (source bytes copied):`)
  for (const f of failures) console.error(`  ${f.rel}: ${f.error}`)
  process.exitCode = 1
}
