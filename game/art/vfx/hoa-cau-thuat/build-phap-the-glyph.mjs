import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// The four authored brush shapes match fire-character-calligraphy.svg.
// Stack five changes the heat of the entire glyph; it does not invent a fifth stroke.
const strokes = [
  'M82 76 C84 88 72 99 68 111 C66 119 70 125 76 126 C91 119 99 105 97 96 C95 86 88 79 82 76 Z',
  'M169 74 C167 92 177 106 191 115 C197 113 198 107 192 101 C183 93 177 83 169 74 Z',
  'M127 53 C136 70 137 90 132 111 C126 141 108 167 79 190 C70 197 63 199 55 205 C77 204 95 197 111 185 C139 165 151 135 149 108 C148 84 139 64 127 53 Z',
  // Begin inside the main descending stroke so the right sweep grows from it.
  'M128 108 C140 108 147 118 151 132 C162 161 181 190 210 203 C192 207 181 199 168 185 C150 166 139 145 135 126 C133 117 130 111 128 108 Z',
]

export function phapTheGlyphSvg(stack) {
  if (!Number.isInteger(stack) || stack < 0 || stack > 5) throw new RangeError('stack must be 0–5')
  const hot = stack === 5
  const paths = strokes.map((d, index) => {
    const lit = hot || index < stack
    const halo = lit ? `<path d="${d}" fill="none" stroke="${hot ? '#fff0bd' : '#ff4b16'}" stroke-width="13" opacity="${hot ? '.48' : '.32'}" filter="url(#glow)"/>` : ''
    const fill = lit ? (hot ? 'url(#whiteHot)' : 'url(#fire)') : 'url(#silver)'
    const outline = lit ? '#a52712' : '#303b43'
    return `${halo}<path d="${d}" fill="${fill}" stroke="${outline}" stroke-width="${lit ? 2 : 2.5}" stroke-linejoin="round"/>`
  })
  // Paint the central brush over the right sweep to hide their overlap seam.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="silver" x2=".25" y2="1"><stop stop-color="#c0c9cc"/><stop offset="1" stop-color="#788790"/></linearGradient><linearGradient id="fire" x2=".2" y2="1"><stop stop-color="#fff3aa"/><stop offset=".42" stop-color="#ffb13f"/><stop offset="1" stop-color="#f0441e"/></linearGradient><linearGradient id="whiteHot" x2=".2" y2="1"><stop stop-color="#ffffff"/><stop offset=".55" stop-color="#ffe6a8"/><stop offset="1" stop-color="#ff8b39"/></linearGradient><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter></defs>${[paths[0], paths[1], paths[3], paths[2]].join('')}</svg>`
}

const sourcePath = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === sourcePath) {
  const out = path.resolve(path.dirname(sourcePath), '../../../public/assets/vfx/hoa-cau-thuat/phap-the')
  await mkdir(out, { recursive: true })
  for (let stack = 0; stack <= 5; stack++)
    await writeFile(path.join(out, `phap-the-${stack}.svg`), phapTheGlyphSvg(stack))
}
