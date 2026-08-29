export interface SliceDefinitionFacts {
  id: string
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
}

export interface RasterDefinitionFacts {
  id: string
  sourceWidth: number
  sourceHeight: number
  center: 'transparent' | 'fill'
}

export interface RasterImageFacts {
  width: number
  height: number
  /** Alpha lớn nhất tìm thấy trong vùng center, 0..255. */
  centerAlpha: number
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

export function validateAssetDefinitions(
  definitions: readonly SliceDefinitionFacts[],
): string[] {
  const errors: string[] = []
  const ids = new Set<string>()

  for (const definition of definitions) {
    if (ids.has(definition.id)) {
      errors.push(`duplicate asset id: ${definition.id}`)
    }
    ids.add(definition.id)

    if (!isPositiveInteger(definition.width)) {
      errors.push(`${definition.id}: width must be a positive integer`)
    }
    if (!isPositiveInteger(definition.height)) {
      errors.push(`${definition.id}: height must be a positive integer`)
    }

    for (const [side, value] of [
      ['left', definition.left],
      ['right', definition.right],
      ['top', definition.top],
      ['bottom', definition.bottom],
    ] as const) {
      if (!isNonNegativeInteger(value)) {
        errors.push(`${definition.id}: ${side} must be a non-negative integer`)
      }
    }

    if (definition.left + definition.right > definition.width) {
      errors.push(`${definition.id}: left + right exceeds source width`)
    }
    if (definition.top + definition.bottom > definition.height) {
      errors.push(`${definition.id}: top + bottom exceeds source height`)
    }
  }

  return errors
}

export function validateRasterFacts(
  definition: RasterDefinitionFacts,
  raster: RasterImageFacts,
): string[] {
  const errors: string[] = []

  if (raster.width !== definition.sourceWidth || raster.height !== definition.sourceHeight) {
    errors.push(
      `${definition.id}: expected ${definition.sourceWidth}x${definition.sourceHeight}, `
      + `received ${raster.width}x${raster.height}`,
    )
  }

  if (definition.center === 'transparent' && raster.centerAlpha > 0) {
    errors.push(`${definition.id}: transparent center contains opaque pixels`)
  }

  return errors
}
