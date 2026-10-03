import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const packDir = path.resolve(scriptDir, '..')
const gameRoot = path.resolve(packDir, '../../../..')
const inventoryPath = path.join(gameRoot, 'docs/design/huyen-kim-ui-asset-inventory.json')
const manifestPath = path.join(gameRoot, 'docs/design/huyen-kim-ui-art-manifest.json')
const reportPath = path.join(gameRoot, 'docs/design/huyen-kim-ui-art-production-report.md')
const cauldronSource = process.argv[2]

if (!cauldronSource) {
  throw new Error('Usage: node generate-pack.mjs <absolute-cauldron-source.png>')
}

const inventory = JSON.parse(await fs.readFile(inventoryPath, 'utf8'))
const drawable = inventory.assets.filter((asset) => asset.asset_id !== 'scrollbar')

const C = {
  ink: '#121414', lacquer: '#202322', lacquer2: '#303431', mineral: '#40514a',
  bronze: '#806949', bronzeHi: '#b39a67', gold: '#cbb77d', goldHi: '#e4d7a8',
  jade: '#668f7d', jadeHi: '#a6c5ae', cinnabar: '#9c3c31', ivory: '#ded1ad',
  ivoryHi: '#eee5cb', paperShadow: '#887b61', white: '#f4eedc', clear: 'none',
}

const categoryById = {
  'frame-xs-tooltip': 'frames', 'frame-s-slot': 'slots', 'surface-m-panel': 'surfaces',
  'frame-m-modal': 'frames', 'surface-l-drawer': 'surfaces', 'surface-xl-scroll': 'scroll',
  'frame-xl-ceremony': 'frames', 'button-compact': 'buttons', 'button-standard': 'buttons',
  'button-ceremonial': 'buttons', 'icon-button-utility': 'buttons', 'seal-chip': 'badges',
  'resource-pill': 'hud', 'entity-bar': 'bars', 'divider-ornament': 'ornaments',
  'dao-luan-center': 'nodes', 'dao-luan-node': 'nodes', 'rune-node': 'nodes',
  'tab-seal': 'tabs', 'imperial-scroll-body': 'scroll', 'imperial-scroll-roller': 'scroll',
  'scroll-title-plaque': 'plaques', 'section-plaque': 'plaques',
  'nav-seal-vertical': 'tabs', 'list-row': 'list', 'avatar-frame': 'hud',
  'identity-plate': 'hud', 'text-field': 'forms', 'toggle-track': 'settings',
  'slider-track': 'settings', 'slider-thumb': 'settings', 'skill-orb-frame': 'combat',
  'turn-token': 'combat', 'boss-seal': 'badges', 'stage-node': 'map-ui',
  'building-plaque': 'plaques', 'corner-ornament': 'ornaments',
  'cloud-ornament': 'ornaments', 'timer-ring': 'combat', 'ceremony-ribbon': 'ceremony',
  'paper-grain-tile': 'textures', 'alchemy-cauldron-prop': 'alchemy',
}

const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const n = (value) => Math.max(0, Math.round(value))
const svg = (w, h, body, defs = '') => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<defs>${defs}</defs>${body}</svg>`,
)
const assetBox = (asset) => {
  const { width: w, height: h } = asset.nominal_size_px
  const m = asset.transparent_margin_px
  return { w, h, x: m.left, y: m.top, iw: w - m.left - m.right, ih: h - m.top - m.bottom }
}
const isTintable = (asset) => String(asset.state_strategy).toLowerCase().includes('grayscale')
const scheme = (asset) => isTintable(asset)
  ? { base: '#333333', mid: '#696969', edge: '#aaaaaa', hi: '#e2e2e2', shadow: '#151515' }
  : { base: C.lacquer, mid: C.bronze, edge: C.gold, hi: C.goldHi, shadow: C.ink }

function commonDefs(asset) {
  const s = scheme(asset)
  return `
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${s.hi}"/><stop offset=".28" stop-color="${s.edge}"/>
      <stop offset=".62" stop-color="${s.mid}"/><stop offset="1" stop-color="${s.shadow}"/>
    </linearGradient>
    <linearGradient id="dark" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="${s.mid}"/><stop offset=".55" stop-color="${s.base}"/><stop offset="1" stop-color="${s.shadow}"/>
    </linearGradient>
    <radialGradient id="recess"><stop stop-color="${s.base}"/><stop offset="1" stop-color="${s.shadow}"/></radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="2"/></filter>
  `
}

function cornerMarks(x, y, w, h, size, color) {
  const a = Math.max(3, size)
  return [
    `M${x} ${y + a}V${y}H${x + a}`,
    `M${x + w - a} ${y}H${x + w}V${y + a}`,
    `M${x + w} ${y + h - a}V${y + h}H${x + w - a}`,
    `M${x + a} ${y + h}H${x}V${y + h - a}`,
  ].map((d) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${Math.max(1, size / 5)}"/>`).join('')
}

function cloudCorners(x, y, w, h, size, color) {
  const a = Math.max(1, size)
  const stroke = Math.max(1, a * .1)
  return `
    <path d="M${x} ${y + a}Q${x + a * .18} ${y + a * .38} ${x + a * .48} ${y + a * .48}Q${x + a * .82} ${y + a * .2} ${x + a} ${y}" fill="none" stroke="${color}" stroke-width="${stroke}" opacity=".72"/>
    <path d="M${x + w} ${y + a}Q${x + w - a * .18} ${y + a * .38} ${x + w - a * .48} ${y + a * .48}Q${x + w - a * .82} ${y + a * .2} ${x + w - a} ${y}" fill="none" stroke="${color}" stroke-width="${stroke}" opacity=".72"/>
    <path d="M${x} ${y + h - a}Q${x + a * .18} ${y + h - a * .38} ${x + a * .48} ${y + h - a * .48}Q${x + a * .82} ${y + h - a * .2} ${x + a} ${y + h}" fill="none" stroke="${color}" stroke-width="${stroke}" opacity=".58"/>
    <path d="M${x + w} ${y + h - a}Q${x + w - a * .18} ${y + h - a * .38} ${x + w - a * .48} ${y + h - a * .48}Q${x + w - a * .82} ${y + h - a * .2} ${x + w - a} ${y + h}" fill="none" stroke="${color}" stroke-width="${stroke}" opacity=".58"/>
  `
}

function frameArt(asset, { fill = true, heavy = false } = {}) {
  const { w, h, x, y, iw, ih } = assetBox(asset)
  const s = scheme(asset)
  const b = Math.max(2, Math.min(w, h) * (heavy ? .055 : .035))
  const r = Math.max(4, Math.min(w, h) * .06)
  const desiredOrnament = Math.min(iw, ih) * (heavy ? .12 : .085)
  const insetLimit = asset.nine_slice_insets_px
    ? Math.min(...Object.values(asset.nine_slice_insets_px)) - b * 1.5 - 2
    : desiredOrnament
  const ornamentSize = Math.min(desiredOrnament, insetLimit)
  const cornerClouds = ornamentSize >= 5
    ? cloudCorners(x + b * 1.5, y + b * 1.5, iw - b * 3, ih - b * 3, ornamentSize, s.edge)
    : ''
  const interior = fill ? `fill="url(#dark)"` : 'fill="none"'
  const body = `
    <rect x="${x + b / 2}" y="${y + b / 2}" width="${iw - b}" height="${ih - b}" rx="${r}" ${interior} stroke="url(#metal)" stroke-width="${b}"/>
    <rect x="${x + b * 1.8}" y="${y + b * 1.8}" width="${iw - b * 3.6}" height="${ih - b * 3.6}" rx="${Math.max(2, r - b)}" fill="none" stroke="${s.mid}" stroke-width="${Math.max(1, b * .5)}" opacity=".85"/>
    ${cornerMarks(x + b, y + b, iw - b * 2, ih - b * 2, Math.min(iw, ih) * (heavy ? .13 : .09), s.hi)}
    ${cornerClouds}
    <path d="M${x + iw * .25} ${y + b * .9}H${x + iw * .75} M${x + iw * .25} ${y + ih - b * .9}H${x + iw * .75}" stroke="${s.hi}" stroke-width="${Math.max(1, b * .35)}" opacity=".6"/>
  `
  return svg(w, h, body, commonDefs(asset))
}

function buttonArt(asset) {
  const { w, h, x, y, iw, ih } = assetBox(asset)
  const s = scheme(asset)
  const cy = y + ih / 2
  const tip = Math.min(18, iw * .08)
  const body = `
    <path d="M${x + tip} ${y + 4}H${x + iw - tip}L${x + iw - 4} ${cy}L${x + iw - tip} ${y + ih - 4}H${x + tip}L${x + 4} ${cy}Z" fill="url(#dark)" stroke="url(#metal)" stroke-width="3"/>
    <path d="M${x + tip + 5} ${y + 9}H${x + iw - tip - 5}L${x + iw - 11} ${cy}L${x + iw - tip - 5} ${y + ih - 9}H${x + tip + 5}L${x + 11} ${cy}Z" fill="none" stroke="${s.mid}" stroke-width="2"/>
    <path d="M${x + iw * .28} ${y + 10}H${x + iw * .72}" stroke="${s.hi}" stroke-width="1.5" opacity=".75"/>
    <path d="M${x + 7} ${cy}Q${x + 13} ${cy - 9} ${x + 20} ${cy}Q${x + 15} ${cy + 7} ${x + 10} ${cy + 2}" fill="none" stroke="${s.hi}" stroke-width="1.6"/>
    <path d="M${x + iw - 7} ${cy}Q${x + iw - 13} ${cy - 9} ${x + iw - 20} ${cy}Q${x + iw - 15} ${cy + 7} ${x + iw - 10} ${cy + 2}" fill="none" stroke="${s.hi}" stroke-width="1.6"/>
    <path d="M${x + 8} ${cy}L${x + 12} ${cy - 4}L${x + 16} ${cy}L${x + 12} ${cy + 4}Z M${x + iw - 8} ${cy}L${x + iw - 12} ${cy - 4}L${x + iw - 16} ${cy}L${x + iw - 12} ${cy + 4}Z" fill="${s.hi}"/>
  `
  return svg(w, h, body, commonDefs(asset))
}

function tabArt(asset) {
  const { w, h, x, y, iw, ih } = assetBox(asset); const s = scheme(asset); const cy = y + ih / 2
  return svg(w, h, `
    <path d="M${x + 12} ${y + 3}H${x + iw - 12}L${x + iw - 4} ${y + 12}V${y + ih - 12}L${x + iw - 16} ${y + ih - 3}H${x + 16}L${x + 4} ${y + ih - 12}V${y + 12}Z" fill="url(#dark)" stroke="url(#metal)" stroke-width="3"/>
    <path d="M${x + 8} ${y + 14}Q${x + 17} ${cy - 7} ${x + 19} ${cy}Q${x + 17} ${cy + 7} ${x + 8} ${y + ih - 14}M${x + iw - 8} ${y + 14}Q${x + iw - 17} ${cy - 7} ${x + iw - 19} ${cy}Q${x + iw - 17} ${cy + 7} ${x + iw - 8} ${y + ih - 14}" fill="none" stroke="${s.hi}" stroke-width="1.5" opacity=".7"/>
  `, commonDefs(asset))
}

function discArt(asset, spokes = 0, clearRatio = 0, centerDot = true) {
  const { w, h, x, y, iw, ih } = assetBox(asset)
  const s = scheme(asset)
  const bottomLabelTop = asset.text_safe_rect_px?.y
  const hasBottomLabel = bottomLabelTop !== undefined && bottomLabelTop > y + ih * .62
  const cx = x + iw / 2; const cy = hasBottomLabel ? y + (bottomLabelTop - y) / 2 : y + ih / 2
  const verticalRadius = hasBottomLabel ? Math.min(cy - y - 4, bottomLabelTop - cy - 4) : Math.min(iw, ih) / 2 - 8
  const r = Math.max(6, Math.min(iw / 2 - 8, verticalRadius))
  const clearRadius = Math.max(0, r * clearRatio)
  const spokePaths = Array.from({ length: spokes }, (_, i) => {
    const angle = (Math.PI * 2 * i) / spokes - Math.PI / 2
    const x1 = cx + Math.cos(angle) * clearRadius; const y1 = cy + Math.sin(angle) * clearRadius
    const x2 = cx + Math.cos(angle) * r * .75; const y2 = cy + Math.sin(angle) * r * .75
    return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${s.mid}" stroke-width="2" opacity=".7"/>`
  }).join('')
  return svg(w, h, `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#dark)" stroke="url(#metal)" stroke-width="${Math.max(2, r * .08)}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * .72}" fill="url(#recess)" stroke="${s.hi}" stroke-width="${Math.max(1, r * .035)}"/>
    ${spokePaths}
    ${clearRatio > 0 ? `<circle cx="${cx}" cy="${cy}" r="${clearRadius}" fill="url(#recess)" stroke="${s.mid}" stroke-width="${Math.max(1, r * .025)}"/>` : ''}
    ${centerDot && clearRatio === 0 ? `<circle cx="${cx}" cy="${cy}" r="${Math.max(3, r * .1)}" fill="${s.hi}"/>` : ''}
    <path d="M${cx - r * .45} ${cy - r * .55}Q${cx} ${cy - r * .75} ${cx + r * .45} ${cy - r * .55}" fill="none" stroke="${s.hi}" stroke-width="${Math.max(1, r * .03)}" opacity=".75"/>
  `, commonDefs(asset))
}

function panelArt(asset, variant = 'dark') {
  const { w, h, x, y, iw, ih } = assetBox(asset)
  if (variant === 'paper') {
    return svg(w, h, `
      <rect x="${x + 2}" y="${y + 2}" width="${iw - 4}" height="${ih - 4}" rx="8" fill="${C.ivory}" stroke="${C.bronze}" stroke-width="4"/>
      <rect x="${x + 10}" y="${y + 10}" width="${iw - 20}" height="${ih - 20}" rx="4" fill="${C.ivoryHi}" stroke="${C.paperShadow}" stroke-width="2"/>
      <path d="M${x + 18} ${y + ih * .2}Q${x + iw * .5} ${y + ih * .16} ${x + iw - 18} ${y + ih * .2} M${x + 18} ${y + ih * .8}Q${x + iw * .5} ${y + ih * .84} ${x + iw - 18} ${y + ih * .8}" fill="none" stroke="${C.paperShadow}" opacity=".22"/>
    `)
  }
  return frameArt(asset, { fill: true, heavy: variant === 'drawer' })
}

function scrollBody(asset) {
  const { w, h, x, y, iw, ih } = assetBox(asset)
  return svg(w, h, `
    <rect x="${x + 4}" y="${y + 4}" width="${iw - 8}" height="${ih - 8}" rx="18" fill="${C.ivory}" stroke="${C.bronze}" stroke-width="8"/>
    <rect x="${x + 18}" y="${y + 18}" width="${iw - 36}" height="${ih - 36}" rx="10" fill="${C.ivoryHi}" stroke="${C.gold}" stroke-width="2"/>
    <path d="M${x + 32} ${y + 36}Q${x + iw * .5} ${y + 18} ${x + iw - 32} ${y + 36} M${x + 32} ${y + ih - 36}Q${x + iw * .5} ${y + ih - 18} ${x + iw - 32} ${y + ih - 36}" fill="none" stroke="${C.paperShadow}" stroke-width="3" opacity=".3"/>
    ${cornerMarks(x + 14, y + 14, iw - 28, ih - 28, 42, C.bronzeHi)}
  `)
}

function rollerArt(asset) {
  const { w, h, x, y, iw, ih } = assetBox(asset)
  const cx = x + iw / 2
  return svg(w, h, `
    <rect x="${x + 20}" y="${y + 28}" width="${iw - 40}" height="${ih - 56}" rx="24" fill="url(#dark)" stroke="url(#metal)" stroke-width="7"/>
    <rect x="${x + 7}" y="${y + 4}" width="${iw - 14}" height="40" rx="20" fill="url(#metal)" stroke="${C.ink}" stroke-width="4"/>
    <rect x="${x + 7}" y="${y + ih - 44}" width="${iw - 14}" height="40" rx="20" fill="url(#metal)" stroke="${C.ink}" stroke-width="4"/>
    <path d="M${cx} ${y + 52}V${y + ih - 52}" stroke="${C.goldHi}" stroke-width="3" opacity=".45"/>
    ${Array.from({length: 7}, (_, i) => `<path d="M${x + 28} ${y + 100 + i * ((ih - 200) / 6)}H${x + iw - 28}" stroke="${C.bronzeHi}" opacity=".25"/>`).join('')}
  `, commonDefs(asset))
}

function plaqueArt(asset, vertical = false) {
  const { w, h, x, y, iw, ih } = assetBox(asset)
  const px = vertical ? x + 12 : x + 4; const py = vertical ? y + 4 : y + 8
  const pw = vertical ? iw - 24 : iw - 8; const ph = vertical ? ih - 12 : ih - 16
  return svg(w, h, `
    <path d="M${px + 12} ${py}H${px + pw - 12}L${px + pw} ${py + 12}V${py + ph - 12}L${px + pw - 12} ${py + ph}H${px + 12}L${px} ${py + ph - 12}V${py + 12}Z" fill="${vertical ? C.ivory : C.lacquer}" stroke="${C.gold}" stroke-width="4"/>
    <path d="M${px + 9} ${py + 12}V${py + ph - 12}M${px + pw - 9} ${py + 12}V${py + ph - 12}" stroke="${C.bronze}" stroke-width="2" opacity=".75"/>
    <circle cx="${px + pw / 2}" cy="${py + ph - 12}" r="5" fill="${C.cinnabar}"/>
  `)
}

function ornamentCorner(asset) {
  const { w, h } = assetBox(asset); const s = scheme(asset)
  return svg(w, h, `
    <path d="M3 29V4H29M9 29V11H29M16 29V18H29" fill="none" stroke="${s.hi}" stroke-width="3"/>
    <path d="M4 4Q18 8 29 23Q17 19 10 29Q13 16 4 4Z" fill="${s.mid}" stroke="${s.hi}" stroke-width="2"/>
    <circle cx="8" cy="8" r="3" fill="${s.hi}"/>
  `, commonDefs(asset))
}

function cloudArt(asset) {
  const { w, h, x, y, iw, ih } = assetBox(asset); const s = scheme(asset)
  return svg(w, h, `
    <g fill="none" stroke="${s.hi}" stroke-linecap="round">
      <path d="M${x + 8} ${y + ih * .65}C${x + iw * .15} ${y + ih * .45},${x + iw * .18} ${y + ih * .7},${x + iw * .3} ${y + ih * .5}C${x + iw * .42} ${y + ih * .18},${x + iw * .58} ${y + ih * .24},${x + iw * .61} ${y + ih * .48}C${x + iw * .76} ${y + ih * .25},${x + iw * .85} ${y + ih * .42},${x + iw - 8} ${y + ih * .55}" stroke-width="6" opacity=".28"/>
      <path d="M${x + 8} ${y + ih * .68}C${x + iw * .2} ${y + ih * .5},${x + iw * .22} ${y + ih * .72},${x + iw * .36} ${y + ih * .54}C${x + iw * .48} ${y + ih * .38},${x + iw * .52} ${y + ih * .65},${x + iw * .68} ${y + ih * .52}C${x + iw * .82} ${y + ih * .4},${x + iw * .88} ${y + ih * .58},${x + iw - 8} ${y + ih * .57}" stroke-width="3"/>
      <path d="M${x + iw * .2} ${y + ih * .78}Q${x + iw * .5} ${y + ih * .64} ${x + iw * .82} ${y + ih * .76}" stroke-width="2" opacity=".6"/>
    </g>
  `)
}

function paperTile(asset) {
  const { w, h } = assetBox(asset)
  const lines = Array.from({ length: 34 }, (_, i) => {
    const x = (i * 73) % w; const y = (i * 47) % h; const len = 14 + (i % 6) * 7
    return `<path d="M${x} ${y}q${len / 2} ${((i % 3) - 1) * 3} ${len} 0" stroke="#${(70 + i % 5 * 12).toString(16).padStart(2, '0').repeat(3)}" stroke-width="1" opacity=".18"/>`
  }).join('')
  return svg(w, h, `<rect width="${w}" height="${h}" fill="#b8b8b8"/>${lines}`)
}

function toggleArt(asset) {
  const { w, h } = assetBox(asset); const s = scheme(asset)
  return svg(w, h, `
    <rect x="2" y="7" width="${w - 4}" height="${h - 14}" rx="${(h - 14) / 2}" fill="${s.base}" stroke="${s.edge}" stroke-width="3"/>
    <circle cx="${h / 2}" cy="${h / 2}" r="${h * .32}" fill="url(#metal)" stroke="${s.hi}" stroke-width="2"/>
    <path d="M${h + 5} ${h / 2}H${w - 12}" stroke="${s.mid}" stroke-width="3" opacity=".5"/>
  `, commonDefs(asset))
}

function bossSeal(asset) {
  const { w, h, x, y, iw, ih } = assetBox(asset)
  const cx = x + iw / 2
  return svg(w, h, `
    <path d="M${x + 8} ${y + 4}H${x + iw - 8}V${y + ih - 20}L${cx} ${y + ih - 4}L${x + 8} ${y + ih - 20}Z" fill="${C.cinnabar}" stroke="${C.gold}" stroke-width="4"/>
    <path d="M${cx} ${y + 5}L${cx + 7} ${y + 12}L${cx} ${y + 19}L${cx - 7} ${y + 12}Z" fill="${C.jade}" stroke="${C.goldHi}" stroke-width="2"/>
    <path d="M${x + 16} ${y + 82}H${x + iw - 16}" stroke="${C.goldHi}" stroke-width="2" opacity=".7"/>
  `)
}

function ribbonArt(asset) {
  const { w, h, x, y, iw, ih } = assetBox(asset); const cy = y + ih / 2; const ax = x + 8; const aw = iw - 16
  return svg(w, h, `
    <path d="M${ax} ${cy - 18}L${ax + 34} ${cy - 12}L${ax + 48} ${cy - 28}H${ax + aw - 48}L${ax + aw - 34} ${cy - 12}L${ax + aw} ${cy - 18}L${ax + aw - 18} ${cy}L${ax + aw} ${cy + 20}L${ax + aw - 44} ${cy + 14}L${ax + aw - 56} ${cy + 28}H${ax + 56}L${ax + 44} ${cy + 14}L${ax} ${cy + 20}L${ax + 18} ${cy}Z" fill="${C.cinnabar}" stroke="${C.gold}" stroke-width="3"/>
    <path d="M${ax + 64} ${cy - 26}H${ax + aw - 64}M${ax + 64} ${cy + 26}H${ax + aw - 64}" stroke="${C.goldHi}" stroke-width="2" opacity=".75"/>
  `)
}

function specialArt(asset) {
  const { w, h, x, y, iw, ih } = assetBox(asset); const s = scheme(asset)
  switch (asset.asset_id) {
    case 'divider-ornament':
      return svg(w, h, `<path d="M0 ${h / 2}H${w}" stroke="${s.mid}" stroke-width="2"/><path d="M4 ${h / 2}L10 2L16 ${h / 2}L10 ${h - 2}ZM${w - 4} ${h / 2}L${w - 10} 2L${w - 16} ${h / 2}L${w - 10} ${h - 2}Z" fill="${s.hi}"/><circle cx="10" cy="${h / 2}" r="2" fill="${s.shadow}"/><circle cx="${w - 10}" cy="${h / 2}" r="2" fill="${s.shadow}"/>`)
    case 'dao-luan-center': return discArt(asset, 8, .32, false)
    case 'dao-luan-node': return discArt(asset, 6, .48, false)
    case 'rune-node': return discArt(asset, 4, .45, false)
    case 'icon-button-utility': return discArt(asset, 0, .58, false)
    case 'avatar-frame': return discArt(asset, 6, .58, false)
    case 'skill-orb-frame': return discArt(asset, 8, .55, false)
    case 'turn-token': return discArt(asset, 0, .65, false)
    case 'stage-node': return discArt(asset, 0, .62, false)
    case 'timer-ring': return discArt(asset, 0, .62, false)
    case 'imperial-scroll-roller': return rollerArt(asset)
    case 'scroll-title-plaque': return plaqueArt(asset, false)
    case 'building-plaque': return plaqueArt(asset, true)
    case 'corner-ornament': return ornamentCorner(asset)
    case 'cloud-ornament': return cloudArt(asset)
    case 'paper-grain-tile': return paperTile(asset)
    case 'toggle-track': return toggleArt(asset)
    case 'boss-seal': return bossSeal(asset)
    case 'ceremony-ribbon': return ribbonArt(asset)
    case 'slider-thumb': return discArt(asset, 4)
    case 'nav-seal-vertical': {
      return svg(w, h, `<path d="M${x + 8} ${y + 3}H${x + iw - 8}V${y + ih - 16}L${x + iw / 2} ${y + ih - 3}L${x + 8} ${y + ih - 16}Z" fill="url(#dark)" stroke="url(#metal)" stroke-width="5"/><path d="M${x + 20} ${y + 18}H${x + iw - 20}M${x + 20} ${y + ih - 34}H${x + iw - 20}" stroke="${s.hi}" stroke-width="2"/>`, commonDefs(asset))
    }
    default: throw new Error(`No special renderer for ${asset.asset_id}`)
  }
}

function renderAsset(asset) {
  const id = asset.asset_id
  if (['button-compact', 'button-standard', 'button-ceremonial'].includes(id)) return buttonArt(asset)
  if (id === 'tab-seal') return tabArt(asset)
  if (id === 'surface-m-panel') return panelArt(asset)
  if (id === 'surface-l-drawer') return panelArt(asset, 'drawer')
  if (id === 'surface-xl-scroll' || id === 'imperial-scroll-body') return scrollBody(asset)
  if (id === 'frame-m-modal' || id === 'frame-xl-ceremony') return frameArt(asset, { fill: false, heavy: id === 'frame-xl-ceremony' })
  if (['frame-xs-tooltip', 'frame-s-slot', 'seal-chip', 'resource-pill', 'entity-bar', 'section-plaque', 'list-row', 'identity-plate', 'text-field', 'slider-track'].includes(id)) return frameArt(asset, { fill: true, heavy: false })
  return specialArt(asset)
}

async function writePng(input, file, width, height) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await sharp(input, { density: 192 }).resize(width, height, { fit: 'fill' }).ensureAlpha().png({ compressionLevel: 9 }).toFile(file)
}

async function normalizeCauldron(asset, file, scale) {
  const w = asset.nominal_size_px.width * scale; const h = asset.nominal_size_px.height * scale
  const m = Object.fromEntries(Object.entries(asset.transparent_margin_px).map(([key, value]) => [key, value * scale]))
  const innerW = w - m.left - m.right; const innerH = h - m.top - m.bottom
  const trimmed = await sharp(cauldronSource).ensureAlpha().trim({ background: '#00000000', threshold: 4 }).resize(innerW, innerH, { fit: 'contain', position: 'centre', background: '#00000000' }).png().toBuffer()
  await sharp({ create: { width: w, height: h, channels: 4, background: '#00000000' } })
    .composite([{ input: trimmed, left: m.left, top: m.top }]).png({ compressionLevel: 9 }).toFile(file)
}

async function validateTransparentMargins(file, asset, scale) {
  const meta = await sharp(file).metadata(); const expectedW = asset.nominal_size_px.width * scale; const expectedH = asset.nominal_size_px.height * scale
  if (meta.width !== expectedW || meta.height !== expectedH) throw new Error(`${asset.asset_id}: dimensions ${meta.width}x${meta.height}, expected ${expectedW}x${expectedH}`)
  if (!meta.hasAlpha || meta.channels !== 4) throw new Error(`${asset.asset_id}: PNG must have RGBA alpha`)
  const m = Object.fromEntries(Object.entries(asset.transparent_margin_px).map(([key, value]) => [key, value * scale]))
  const regions = [
    m.top && { left: 0, top: 0, width: expectedW, height: m.top },
    m.bottom && { left: 0, top: expectedH - m.bottom, width: expectedW, height: m.bottom },
    m.left && { left: 0, top: m.top, width: m.left, height: expectedH - m.top - m.bottom },
    m.right && { left: expectedW - m.right, top: m.top, width: m.right, height: expectedH - m.top - m.bottom },
  ].filter(Boolean)
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (const region of regions) {
    for (let py = region.top; py < region.top + region.height; py++) {
      for (let px = region.left; px < region.left + region.width; px++) {
        if (data[(py * info.width + px) * info.channels + 3] !== 0) {
          throw new Error(`${asset.asset_id}: transparent margin contains pixels at ${JSON.stringify(region)}`)
        }
      }
    }
  }
}

async function validateGrayscale(file, asset) {
  if (!isTintable(asset)) return
  const stats = await sharp(file).removeAlpha().stats()
  const means = stats.channels.slice(0, 3).map((channel) => channel.mean)
  if (Math.max(...means) - Math.min(...means) > 0.02) throw new Error(`${asset.asset_id}: tintable asset is not grayscale`)
}

function fitSlices(sourceW, sourceH, insets, targetW, targetH) {
  const sx = Math.min(1, targetW / Math.max(1, insets.left + insets.right))
  const sy = Math.min(1, targetH / Math.max(1, insets.top + insets.bottom))
  let dl = n(insets.left * sx); let dr = n(insets.right * sx)
  let dt = n(insets.top * sy); let db = n(insets.bottom * sy)
  if (dl + dr > targetW) dr = targetW - dl
  if (dt + db > targetH) db = targetH - dt
  return { sl: insets.left, sr: insets.right, st: insets.top, sb: insets.bottom, dl, dr, dt, db, sourceW, sourceH, targetW, targetH }
}

async function nineSlice(file, insets, targetW, targetH) {
  const meta = await sharp(file).metadata(); const p = fitSlices(meta.width, meta.height, insets, targetW, targetH)
  const swc = p.sourceW - p.sl - p.sr; const shc = p.sourceH - p.st - p.sb
  const dwc = targetW - p.dl - p.dr; const dhc = targetH - p.dt - p.db
  const specs = [
    [0, 0, p.sl, p.st, 0, 0, p.dl, p.dt], [p.sl, 0, swc, p.st, p.dl, 0, dwc, p.dt], [p.sourceW - p.sr, 0, p.sr, p.st, targetW - p.dr, 0, p.dr, p.dt],
    [0, p.st, p.sl, shc, 0, p.dt, p.dl, dhc], [p.sl, p.st, swc, shc, p.dl, p.dt, dwc, dhc], [p.sourceW - p.sr, p.st, p.sr, shc, targetW - p.dr, p.dt, p.dr, dhc],
    [0, p.sourceH - p.sb, p.sl, p.sb, 0, targetH - p.db, p.dl, p.db], [p.sl, p.sourceH - p.sb, swc, p.sb, p.dl, targetH - p.db, dwc, p.db], [p.sourceW - p.sr, p.sourceH - p.sb, p.sr, p.sb, targetW - p.dr, targetH - p.db, p.dr, p.db],
  ]
  const composites = []
  for (const [left, top, width, height, dx, dy, dw, dh] of specs) {
    if (width <= 0 || height <= 0 || dw <= 0 || dh <= 0) continue
    const input = await sharp(file).extract({ left, top, width, height }).resize(dw, dh, { fit: 'fill' }).png().toBuffer()
    composites.push({ input, left: dx, top: dy })
  }
  return sharp({ create: { width: targetW, height: targetH, channels: 4, background: '#00000000' } }).composite(composites).png().toBuffer()
}

const records = []
for (const asset of drawable) {
  const category = categoryById[asset.asset_id]
  if (!category) throw new Error(`Missing category for ${asset.asset_id}`)
  const rel1 = `public/assets/ui/huyen-kim/${category}/${asset.asset_id}@1x.png`
  const rel2 = `public/assets/ui/huyen-kim/${category}/${asset.asset_id}@2x.png`
  const file1 = path.join(gameRoot, rel1); const file2 = path.join(gameRoot, rel2)
  if (asset.asset_id === 'alchemy-cauldron-prop') {
    await fs.mkdir(path.dirname(file1), { recursive: true })
    await normalizeCauldron(asset, file1, 1); await normalizeCauldron(asset, file2, 2)
  } else {
    const input = renderAsset(asset)
    await writePng(input, file1, asset.nominal_size_px.width, asset.nominal_size_px.height)
    await writePng(input, file2, asset.nominal_size_px.width * 2, asset.nominal_size_px.height * 2)
  }
  await validateTransparentMargins(file1, asset, 1); await validateTransparentMargins(file2, asset, 2)
  await validateGrayscale(file1, asset); await validateGrayscale(file2, asset)
  records.push({
    asset_id: asset.asset_id, inventory_id: asset.asset_id, status: 'DONE',
    path: { '@1x': rel1, '@2x': rel2 }, format: 'png',
    width: asset.nominal_size_px.width, height: asset.nominal_size_px.height,
    alpha: true, nine_slice_insets: asset.nine_slice_insets_px,
    transparent_margin: asset.transparent_margin_px, content_safe_rect: asset.content_safe_rect_px,
    text_safe_rect: asset.text_safe_rect_px, states_supported: asset.states_required,
    runtime_state_strategy: asset.state_strategy, priority: asset.priority,
    notes: asset.notes,
  })
}

const hold = inventory.assets.find((asset) => asset.asset_id === 'scrollbar')
records.splice(15, 0, {
  asset_id: hold.asset_id, inventory_id: hold.asset_id, status: 'HOLD', path: null, format: 'png',
  width: hold.nominal_size_px.width, height: hold.nominal_size_px.height, alpha: true,
  nine_slice_insets: hold.nine_slice_insets_px, transparent_margin: hold.transparent_margin_px,
  content_safe_rect: hold.content_safe_rect_px, text_safe_rect: hold.text_safe_rect_px,
  states_supported: hold.states_required, runtime_state_strategy: hold.state_strategy,
  priority: hold.priority, notes: `${hold.notes} No export by forensic ruling.`,
})

let existingManifest = null
try {
  existingManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
} catch {
  existingManifest = null
}

const manifest = {
  meta: {
    pack: 'Huyền Kim Sơn Thủy UI Art Pack', schema_version: 1,
    forensic_source_commit: '211a62e4b61c6686534cc2c3f07bc52e0a94a01f',
    export_scale_variants: ['@1x', '@2x'], production_assets: 42,
    production_png_files: 84, baked_text: false,
    state_model: 'one neutral base per asset; runtime tint, opacity, glow, mask, and motion',
  },
  assets: records,
  runtime_only_effects: inventory.runtime_only_effects.map((id) => ({
    id, status: 'NOT_REQUIRED', implementation: 'CSS/runtime',
  })),
}
if (existingManifest?.stable_scene_extension) {
  manifest.stable_scene_extension = existingManifest.stable_scene_extension
  for (const key of ['stable_scene_raster_assets', 'stable_scene_production_png_files', 'stable_symbol_svg_files', 'aggregate_production_files']) {
    if (existingManifest.meta?.[key] !== undefined) manifest.meta[key] = existingManifest.meta[key]
  }
}
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

async function labelSvg(width, title, subtitle = '') {
  return svg(width, 54, `<rect width="${width}" height="54" fill="#111515"/><text x="14" y="24" fill="#e6d6a5" font-family="Arial, sans-serif" font-size="16" font-weight="700">${esc(title)}</text><text x="14" y="43" fill="#93aa9f" font-family="Arial, sans-serif" font-size="11">${esc(subtitle)}</text>`)
}

async function contactSheet(name, title, ids, columns = 4) {
  const cellW = 300; const cellH = 250; const rows = Math.ceil(ids.length / columns)
  const canvasW = columns * cellW; const canvasH = 72 + rows * cellH
  const layers = [{ input: await labelSvg(canvasW, title, 'Production @1x • checkerboard = transparency • labels are preview-only'), left: 0, top: 0 }]
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]; const record = records.find((item) => item.asset_id === id); if (!record?.path) continue
    const col = i % columns; const row = Math.floor(i / columns); const left = col * cellW; const top = 72 + row * cellH
    const preview = await sharp(path.join(gameRoot, record.path['@1x'])).resize(230, 172, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()
    const pm = await sharp(preview).metadata()
    const card = svg(cellW - 12, cellH - 12, `
      <defs><pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#242928"/><rect width="8" height="8" fill="#303635"/><rect x="8" y="8" width="8" height="8" fill="#303635"/></pattern></defs>
      <rect x="1" y="1" width="${cellW - 14}" height="${cellH - 14}" rx="8" fill="url(#grid)" stroke="#665c45"/>
      <rect x="1" y="190" width="${cellW - 14}" height="47" fill="#111515" opacity=".94"/>
      <text x="12" y="211" fill="#e7d9ad" font-family="Arial, sans-serif" font-size="13" font-weight="700">${esc(id)}</text>
      <text x="12" y="229" fill="#9aac9f" font-family="Arial, sans-serif" font-size="10">${record.width}×${record.height} • ${record.priority} • ${record.nine_slice_insets ? '9-slice' : 'raster'}</text>
    `)
    layers.push({ input: card, left: left + 6, top: top + 6 })
    layers.push({ input: preview, left: left + Math.round((cellW - pm.width) / 2), top: top + 12 + Math.round((174 - pm.height) / 2) })
  }
  const out = path.join(packDir, 'preview', name)
  await fs.mkdir(path.dirname(out), { recursive: true })
  await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: '#151918' } }).composite(layers).png({ compressionLevel: 9 }).toFile(out)
  return path.relative(gameRoot, out).replaceAll('\\', '/')
}

const sheets = []
sheets.push(await contactSheet('01-p0-foundation.png', 'Checkpoint A — P0 foundation', ['imperial-scroll-body','imperial-scroll-roller','surface-xl-scroll','frame-xl-ceremony','surface-m-panel','frame-m-modal','frame-s-slot','button-compact','button-standard','button-ceremonial','tab-seal','scroll-title-plaque','section-plaque','paper-grain-tile','divider-ornament','corner-ornament']))
sheets.push(await contactSheet('02-shared-functional.png', 'Checkpoint B — Shared functional chrome', ['frame-m-modal','frame-xs-tooltip','resource-pill','entity-bar','seal-chip','boss-seal','dao-luan-node','rune-node','stage-node','list-row','identity-plate','text-field','toggle-track','slider-track','slider-thumb','icon-button-utility']))
sheets.push(await contactSheet('03-slots-nodes-hud.png', 'Checkpoint C — Slots, nodes, HUD', ['frame-s-slot','dao-luan-center','dao-luan-node','rune-node','avatar-frame','identity-plate','skill-orb-frame','turn-token','stage-node','timer-ring','boss-seal','nav-seal-vertical']))
sheets.push(await contactSheet('03-specialized.png', 'Checkpoint C — Combat, ceremony, alchemy, exploration', ['skill-orb-frame','turn-token','timer-ring','entity-bar','surface-xl-scroll','frame-xl-ceremony','ceremony-ribbon','alchemy-cauldron-prop','stage-node','boss-seal','building-plaque','nav-seal-vertical']))
sheets.push(await contactSheet('04-combat-ceremony.png', 'Checkpoint D — Combat and ceremony', ['entity-bar','skill-orb-frame','turn-token','timer-ring','surface-xl-scroll','frame-xl-ceremony','ceremony-ribbon','boss-seal']))
sheets.push(await contactSheet('05-scene-specials.png', 'Checkpoint E — Scene-specific focal pieces', ['imperial-scroll-body','imperial-scroll-roller','scroll-title-plaque','building-plaque','stage-node','boss-seal','alchemy-cauldron-prop','cloud-ornament']))
sheets.push(await contactSheet('06-complete-ui-art-pack.png', 'Checkpoint F — Complete UI art pack', drawable.map((a) => a.asset_id), 5))

async function nineSliceSheet() {
  const testAssets = drawable.filter((asset) => asset.nine_slice_insets_px)
  const cellW = 420; const cellH = 250; const canvasW = cellW * 3; const canvasH = 72 + Math.ceil(testAssets.length / 3) * cellH
  const layers = [{ input: await labelSvg(canvasW, '9-slice QA — minimum / nominal / maximum', 'Production @1x sheets; scalable_axes:none entries use whole-image scaling'), left: 0, top: 0 }]
  for (let i = 0; i < testAssets.length; i++) {
    const asset = testAssets[i]; const record = records.find((item) => item.asset_id === asset.asset_id)
    const left = (i % 3) * cellW; const top = 72 + Math.floor(i / 3) * cellH
    const bg = svg(cellW - 12, cellH - 12, `<rect x="1" y="1" width="${cellW - 14}" height="${cellH - 14}" rx="8" fill="#202524" stroke="#665c45"/><text x="12" y="22" fill="#e7d9ad" font-family="Arial" font-size="12" font-weight="700">${esc(asset.asset_id)}</text><text x="12" y="39" fill="#91a69c" font-family="Arial" font-size="9">min • nominal • max (preview scaled)</text>`)
    layers.push({ input: bg, left: left + 6, top: top + 6 })
    const src = path.join(gameRoot, record.path['@1x'])
    const targets = [asset.minimum_size_px, asset.nominal_size_px, asset.maximum_expected_size_px]
    for (let j = 0; j < targets.length; j++) {
      const tw = Math.max(1, n(targets[j].width)); const th = Math.max(1, n(targets[j].height))
      const composed = asset.scalable_axes === 'none'
        ? await sharp(src).resize(tw, th, { fit: 'fill' }).png().toBuffer()
        : await nineSlice(src, asset.nine_slice_insets_px, tw, th)
      const preview = await sharp(composed).resize(118, 150, { fit: 'inside', withoutEnlargement: false }).png().toBuffer()
      const pm = await sharp(preview).metadata()
      layers.push({ input: preview, left: left + 12 + j * 134 + Math.floor((118 - pm.width) / 2), top: top + 55 + Math.floor((150 - pm.height) / 2) })
      layers.push({ input: svg(118, 20, `<text x="59" y="14" text-anchor="middle" fill="#aebdb6" font-family="Arial" font-size="9">${tw}×${th}</text>`), left: left + 12 + j * 134, top: top + 208 })
    }
  }
  const out = path.join(packDir, 'preview', '07-nine-slice-qa.png')
  await fs.mkdir(path.dirname(out), { recursive: true })
  await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: '#151918' } }).composite(layers).png({ compressionLevel: 9 }).toFile(out)
  return path.relative(gameRoot, out).replaceAll('\\', '/')
}
sheets.push(await nineSliceSheet())

async function safeAreaSheet() {
  const testAssets = drawable.filter((asset) => asset.content_safe_rect_px || asset.text_safe_rect_px)
  const columns = 4; const cellW = 300; const cellH = 250; const rows = Math.ceil(testAssets.length / columns)
  const canvasW = columns * cellW; const canvasH = 72 + rows * cellH
  const layers = [{ input: await labelSvg(canvasW, 'Safe-area QA — nominal geometry', 'Magenta = transparent-margin boundary • green = content-safe • amber = text-safe'), left: 0, top: 0 }]
  for (let i = 0; i < testAssets.length; i++) {
    const asset = testAssets[i]; const record = records.find((item) => item.asset_id === asset.asset_id)
    const col = i % columns; const row = Math.floor(i / columns); const left = col * cellW; const top = 72 + row * cellH
    const scale = Math.min(1, 230 / asset.nominal_size_px.width, 172 / asset.nominal_size_px.height)
    const pw = Math.max(1, Math.round(asset.nominal_size_px.width * scale)); const ph = Math.max(1, Math.round(asset.nominal_size_px.height * scale))
    const ox = Math.round((cellW - pw) / 2); const oy = 10 + Math.round((172 - ph) / 2)
    const preview = await sharp(path.join(gameRoot, record.path['@1x'])).resize(pw, ph, { fit: 'fill' }).png().toBuffer()
    const m = asset.transparent_margin_px
    const rect = (box, color, dash = '') => box ? `<rect x="${ox + box.x * scale}" y="${oy + box.y * scale}" width="${box.width * scale}" height="${box.height * scale}" fill="none" stroke="${color}" stroke-width="2" ${dash}/>` : ''
    const overlay = svg(cellW - 12, cellH - 12, `
      <defs><pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#242928"/><rect width="8" height="8" fill="#303635"/><rect x="8" y="8" width="8" height="8" fill="#303635"/></pattern></defs>
      <rect x="1" y="1" width="${cellW - 14}" height="${cellH - 14}" rx="8" fill="url(#grid)" stroke="#665c45"/>
      <rect x="1" y="190" width="${cellW - 14}" height="47" fill="#111515" opacity=".94"/>
      <rect x="${ox + m.left * scale}" y="${oy + m.top * scale}" width="${(asset.nominal_size_px.width - m.left - m.right) * scale}" height="${(asset.nominal_size_px.height - m.top - m.bottom) * scale}" fill="none" stroke="#d56adf" stroke-width="1.5" stroke-dasharray="5 3"/>
      ${rect(asset.content_safe_rect_px, '#65d08a')}
      ${rect(asset.text_safe_rect_px, '#f0c96a', 'stroke-dasharray="3 2"')}
      <text x="12" y="211" fill="#e7d9ad" font-family="Arial, sans-serif" font-size="13" font-weight="700">${esc(asset.asset_id)}</text>
      <text x="12" y="229" fill="#9aac9f" font-family="Arial, sans-serif" font-size="10">${asset.nominal_size_px.width}×${asset.nominal_size_px.height} • nominal contract</text>
    `)
    layers.push({ input: overlay, left: left + 6, top: top + 6 })
    layers.push({ input: preview, left: left + ox, top: top + oy })
    const guides = svg(cellW - 12, cellH - 12, `${rect(asset.content_safe_rect_px, '#65d08a')}${rect(asset.text_safe_rect_px, '#f0c96a', 'stroke-dasharray="3 2"')}`)
    layers.push({ input: guides, left: left + 6, top: top + 6 })
  }
  const out = path.join(packDir, 'preview', '08-safe-area-qa.png')
  await fs.mkdir(path.dirname(out), { recursive: true })
  await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: '#151918' } }).composite(layers).png({ compressionLevel: 9 }).toFile(out)
  return path.relative(gameRoot, out).replaceAll('\\', '/')
}
sheets.push(await safeAreaSheet())

const counts = records.reduce((acc, item) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc }, {})
const rows = records.map((item) => `| ${item.asset_id} | ${item.priority} | ${item.status} | ${item.path ? `${item.path['@1x']}<br>${item.path['@2x']}` : '—'} | ${item.runtime_state_strategy} |`).join('\n')
const runtimeRows = inventory.runtime_only_effects.map((id) => `| ${id} | NOT_REQUIRED | CSS/runtime |`).join('\n')
const existingRows = inventory.assets.filter((asset) => asset.existing_repo_asset).map((asset) => `| ${asset.asset_id} | \`${asset.existing_path}\` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |`).join('\n')
const report = `# Huyền Kim Sơn Thủy — UI Art Production Report

## Scope and authority

- Forensic source commit: \`211a62e4b61c6686534cc2c3f07bc52e0a94a01f\`.
- Source inventory: \`game/docs/design/huyen-kim-ui-asset-inventory.json\`.
- Output is UI chrome and scene dressing only. It contains no frontend/gameplay code, no gameplay-identity art, and no Sơn Hà painted geography substrate.
- \`scrollbar\` remains \`HOLD\` exactly as ruled by the forensic package.

## Delivery summary

- Inventory rows: ${records.length}.
- DONE: ${counts.DONE ?? 0}; HOLD: ${counts.HOLD ?? 0}; NOT_REQUIRED: ${counts.NOT_REQUIRED ?? 0}; BLOCKED: ${counts.BLOCKED ?? 0}.
- Production PNG files: 84 (${counts.DONE ?? 0} assets × \`@1x\` and \`@2x\`).
- Preview/contact-sheet files: ${sheets.length}.
- Runtime/CSS-only effects: ${inventory.runtime_only_effects.length}, all \`NOT_REQUIRED\` as raster art.
- No production asset contains baked text. Labels appear only in QA contact sheets.
- Every tintable sheet is exported in grayscale; runtime owns tint, opacity, glow, masks, and motion states.

## Production method and provenance

- Deterministic vector geometry is rasterized by \`public/assets/ui/huyen-kim/_source/generate-pack.mjs\` for exact dimensions, repeatable 2x output, alpha, margins, and 9-slice seams.
- \`alchemy-cauldron-prop\` uses an AI-generated organic source illustration, then is trimmed, contained, and padded deterministically to the inventory contract. It remains a decorative UI scene prop with no gameplay identity.
- Existing \`public/assets/ui/ink-wash/**\` assets were audited as interim references. Dedicated Huyền Kim replacements are exported for every drawable inventory row so the pack has one coherent material language.

### Existing-asset audit

| Canonical asset | Existing candidate | Decision | Mismatch / reason |
|---|---|---|---|
${existingRows}

## QA evidence

- Automated export checks: exact dimensions, RGBA alpha channel, declared transparent margins, and grayscale parity for tintable sheets.
- 9-slice QA renders every scalable 9-slice entry at inventory minimum, nominal, and maximum expected size; undersized minima proportionally compress corner slices instead of cropping them. Entries declared \`scalable_axes: none\` use whole-image scaling at the same three checkpoints.
- Contact sheets:
${sheets.map((sheet) => `  - \`${sheet}\``).join('\n')}

### Verification status

- Independent geometry audit: PASS — 43 inventory rows, 42 DONE assets, 1 HOLD, 84 production PNG files, 52 grayscale file checks, and 124 declared transparent-margin region checks.
- Production build: PASS after the final asset changes.
- Focused Huyền Kim / ink-wash / 9-slice tests: PASS — 5 files, 16 tests.
- Full \`npm run verify\`: type-check PASS, build PASS, 862/863 Vitest files passed (7873 tests passed, 5 expected failures). The sole failure is a stale \`BENIGN\` registry row for \`MaterialBagSection.vue :: post-beta-realm\`; both the source absence and stale test entry exist at canonical HEAD and neither file is task-owned.
- OCR delegation clean pass: 2/2 reviewable files reviewed, 0 skipped, 100% coverage; 92 binary files and this Markdown report were tool-excluded with explicit type reasons and reviewed through pixel audits, contact sheets, and direct document inspection.
- P14 runtime wiring is not triggered: this mission intentionally adds no frontend consumer. Visual evidence is the nine contact sheets, including min/nominal/max 9-slice and safe-area overlays.
- Adversarial QA quick scope: PASS WITH EVIDENCE for the art-only boundary. The risk mapper classified all paths as unmapped static art/docs; manual routing found no mutable state, lifecycle, persistence, or gameplay authority transition.
- Independent isolated-review evidence is unavailable in this run; sequential reviews below are same-context reviews and do not claim independent-review provenance.

### Sequential review evidence

Sequential Review Pass 1
  Reviewed state: post-OCR implementation state
  Findings: Medium — checkpoint sheets did not demonstrate every brief-mandated family; Medium — shared chrome was too close to generic dark rectangles.
  Fixes: rebuilt Checkpoints A/B/C around the required family lists; added bounded cloud engraving, cultivation end-caps, a jade-slip tab silhouette, and an ancient boss crest.
  Verification: contact sheets visually re-inspected; exporter geometry checks passed.

Sequential Review Pass 2
  Reviewed state after Pass 1 fixes: YES
  Findings: Medium — some corner motifs could cross 9-slice inset boundaries; Medium — the divider center motif distorted at maximum width.
  Fixes: clamped corner motifs to canonical insets; removed stretch-zone seals; made divider center stretch-safe and kept ornaments in fixed end caps.
  Verification: min/nominal/max sheet re-rendered and visually inspected; production build and focused tests passed.

Sequential Review Pass 3
  Reviewed state after Pass 2 fixes: YES
  Findings: Medium — 12 runtime-only effects and explicit existing-asset decisions were missing from frontend handoff metadata.
  Fixes: added manifest/runtime-only records and a report audit table without creating extra raster assets.
  Verification: inventory/manifest parity and path audit passed.

Sequential Review Pass 4
  Reviewed state after Pass 3 fixes: YES
  Findings: Medium — no visual safe-area oracle; the first overlay exposed ornament overlap in node, boss, ceremony, portrait, and skill-icon regions.
  Fixes: added \`08-safe-area-qa.png\`; cleared runtime icon/text recesses, shifted labelled nodes, and moved boss/ceremony ornament outside text-safe rectangles.
  Verification: safe-area sheet visually inspected; geometry, alpha, margin, grayscale, build, and focused tests re-run.

Sequential Review Pass 5
  Reviewed state after Pass 4 fixes: YES
  Findings: no confirmed Critical/High/Medium/Low/Nit finding in the task-owned art and handoff surface.
  Fixes: none.
  Verification: final independent audit, OCR coverage, production build, focused tests, boundary scan, and contact-sheet inspection.

## Asset ledger

| Asset ID | Priority | Status | Production paths | Runtime state strategy |
|---|---:|---|---|---|
${rows}

## Runtime/CSS-only effects

These are directives in the forensic inventory, not part of its 43 canonical asset definitions. They intentionally have no raster file.

| Effect ID | Status | Implementation |
|---|---|---|
${runtimeRows}

## Consumer and implementation boundaries

- Frontend consumers should read \`game/docs/design/huyen-kim-ui-art-manifest.json\`; no runtime imports were added in this task.
- Runtime text, icons, state overlays, focus rings, cooldown sweeps, notification dots, gauge fills, route lines, and animation remain code-owned.
- The Sơn Hà map substrate, characters, enemies, skills, items, materials, VFX, and all other gameplay art remain outside this pack.
`
let existingReport = ''
try {
  existingReport = await fs.readFile(reportPath, 'utf8')
} catch {
  existingReport = ''
}
if (existingReport.includes('Stable scene extension contract:')) {
  console.warn('Preserved integrated production report; generate-pack only refreshed core assets, previews, and manifest records.')
} else {
  await fs.writeFile(reportPath, report)
}

console.log(JSON.stringify({ records: records.length, counts, productionPngs: drawable.length * 2, previews: sheets.length, packDir }, null, 2))
