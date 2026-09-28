// String-aware comment strip shared by the audio guards: comment spans
// between tokens (`import /*c*/ Tone`, `import(/*c*/ 'tone')`) must not
// splice a specifier past the regexes; `//` or `/*` INSIDE a quoted
// specifier ('./..//audio/x') must survive - a naive line strip would cut
// the specifier short and smuggle the audio path past AUDIO_SPEC_RE; and
// `/*` inside a `//` comment must not open a phantom block (the naive
// replace-order strip ate all 11 imports of GameManagerCompanionOps.ts).
// HTML comments are stripped so `<!-- import 'tone' -->` template prose
// in .vue files does not produce a phantom specifier.
//
// Known limitation: `${}`-nested template literals and regex literals
// containing quote chars are not modeled - a backtick inside ${} flips
// string parity. Corpus sweep shows no live hit; a guard change that
// trips on a real file is loud, not silent.
export function uncommented(text: string): string {
  let out = ''
  let i = 0
  let quote: string | null = null
  while (i < text.length) {
    const c = text[i]!
    if (quote !== null) {
      out += c
      if (c === '\\') {
        out += text[i + 1] ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
      i++
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
      continue
    }
    // HTML comments (`<!-- ... -->` in .vue templates) - only outside
    // strings, so `'<!--'`/`'-->'` literals cannot pair up to eat code.
    if (c === '<' && text.slice(i, i + 4) === '<!--') {
      const end = text.indexOf('-->', i + 4)
      i = end === -1 ? text.length : end + 3
      continue
    }
    out += c
    i++
  }
  return out
}
