export interface StatusVfxPreset {
  color: number
}

export function getStatusVfxPreset(dotType: string): StatusVfxPreset {
  if (/burn|fire|hot/.test(dotType)) return { color: 0xff7a45 }
  if (/poison|toxic|wood/.test(dotType)) return { color: 0x58e878 }
  if (/bleed|huyet|blood/.test(dotType)) return { color: 0xe5484d }
  if (/chill|frost|water/.test(dotType)) return { color: 0x58c8ff }
  return { color: 0xffd54f }
}
