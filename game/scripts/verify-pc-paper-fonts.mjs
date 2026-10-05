import { readFileSync } from 'node:fs'

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ĐđĂăÂâÊêÔôƠơƯưÀÁẢÃẠàáảãạẦẤẨẪẬầấẩẫậẰẮẲẴẶằắẳẵặÈÉẺẼẸèéẻẽẹỀẾỂỄỆềếểễệÌÍỈĨỊìíỉĩịÒÓỎÕỌòóỏõọỒỐỔỖỘồốổỗộỜỚỞỠỢờớởỡợÙÚỦŨỤùúủũụỪỨỬỮỰừứửữựỲÝỶỸỴỳýỷỹỵ'
for (const name of ['regular', 'bold']) {
  const bytes = readFileSync(`public/assets/fonts/source-serif-4/${name}.ttf`)
  let cmapOffset
  for (let index = 0; index < bytes.readUInt16BE(4); index++) {
    const offset = 12 + index * 16
    if (bytes.toString('ascii', offset, offset + 4) === 'cmap') cmapOffset = bytes.readUInt32BE(offset + 8)
  }
  if (cmapOffset === undefined) throw new Error(`${name}: missing cmap`)
  let map
  for (let index = 0; index < bytes.readUInt16BE(cmapOffset + 2); index++) {
    const entry = cmapOffset + 4 + index * 8
    const offset = cmapOffset + bytes.readUInt32BE(entry + 4)
    if (bytes.readUInt16BE(offset) === 4) map = offset
  }
  if (map === undefined) throw new Error(`${name}: missing Unicode BMP map`)
  const segments = bytes.readUInt16BE(map + 6) / 2
  const glyph = code => {
    for (let index = 0; index < segments; index++) {
      const end = bytes.readUInt16BE(map + 14 + index * 2)
      const start = bytes.readUInt16BE(map + 16 + segments * 2 + index * 2)
      if (code < start || code > end) continue
      const delta = bytes.readInt16BE(map + 16 + segments * 4 + index * 2)
      const rangePosition = map + 16 + segments * 6 + index * 2
      const range = bytes.readUInt16BE(rangePosition)
      if (!range) return (code + delta) & 65535
      const value = bytes.readUInt16BE(rangePosition + range + 2 * (code - start))
      return value ? (value + delta) & 65535 : 0
    }
    return 0
  }
  const missing = [...characters].filter(character => !glyph(character.codePointAt(0)))
  if (missing.length) throw new Error(`${name}: missing glyphs ${missing.join('')}`)
  console.log(`${name}: all Vietnamese precomposed letters and Latin/digits present`)
}
