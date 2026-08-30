param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$sourceRoot = Join-Path $ProjectRoot 'art-source/buildings/dong-fu/v2'
$runtimeRoot = Join-Path $ProjectRoot 'public/assets/buildings/dong-fu/v2'
$buildingIds = @(
  'spirit_spring',
  'equipment_hall',
  'pill_room',
  'teleport_array',
  'gathering_outpost'
)
# Keep these entrance anchors aligned with DongFuBuildingArt.ts. The locked
# seal belongs at each building's actual threshold, not at a generic center.
$entranceAnchors = @{
  spirit_spring = @{ X = 627; Y = 920 }
  equipment_hall = @{ X = 650; Y = 875 }
  pill_room = @{ X = 627; Y = 900 }
  teleport_array = @{ X = 627; Y = 1010 }
  gathering_outpost = @{ X = 627; Y = 830 }
}

foreach ($buildingId in $buildingIds) {
  $plate = Join-Path $sourceRoot "extraction-plates/$buildingId-chroma.png"
  $destination = Join-Path $runtimeRoot $buildingId
  $base = Join-Path $destination 'base.png'
  $silhouette = Join-Path $destination 'silhouette-mask.png'
  $shadow = Join-Path $destination 'ground-shadow.png'
  $lockedOverlay = Join-Path $destination 'locked-overlay.png'
  $maskTemp = Join-Path $env:TEMP "dong-fu-$buildingId-mask.png"
  $sealTemp = Join-Path $env:TEMP "dong-fu-$buildingId-seal.png"

  New-Item -ItemType Directory -Force -Path $destination | Out-Null

  magick $plate -alpha set -channel RGBA -fuzz 22% -transparent '#ff00ff' `
    -channel RGB -fx 'r>g*1.18&&b>g*1.18?g:u' +channel PNG32:$base

  $geometry = magick $base -trim -format '%w %h %X %Y' info:
  $parts = $geometry -split ' '
  $width = [int]$parts[0]
  $height = [int]$parts[1]
  $x = [int]($parts[2] -replace '^\+', '')
  $y = [int]($parts[3] -replace '^\+', '')
  $baseline = $y + $height
  $centerX = [int]($x + $width / 2)
  $shadowRx = [int]($width * 0.42)
  $shadowRy = [Math]::Max(18, [int]($height * 0.035))

  magick $base -alpha extract -threshold 1% $maskTemp
  magick -size 1254x1254 xc:white $maskTemp -alpha off `
    -compose CopyOpacity -composite "PNG32:$silhouette"

  magick -size 1254x1254 xc:none -fill 'rgba(23,23,19,0.38)' `
    -draw "ellipse $centerX,$($baseline - 8) $shadowRx,$shadowRy 0,360" `
    -blur 0x12 "PNG32:$shadow"

  $sealWidth = [Math]::Max(104, [int]($width * 0.13))
  $seal = Join-Path $sourceRoot 'shared/locked-seal-source.png'
  magick $seal -resize "${sealWidth}x" "PNG32:$sealTemp"
  $sealGeometry = (magick identify -format '%w %h' $sealTemp) -split ' '
  $sealX = [int]($entranceAnchors[$buildingId].X - [int]$sealGeometry[0] / 2)
  $sealY = [int]($entranceAnchors[$buildingId].Y - [int]$sealGeometry[1] / 2)
  magick $base -colorspace Gray -fill '#40382e' -colorize 38% `
    -channel A -evaluate multiply 0.72 +channel -write mpr:locked +delete `
    mpr:locked $sealTemp -gravity northwest `
    -geometry "+$sealX+$sealY" `
    -compose over -composite "PNG32:$lockedOverlay"

  Remove-Item -LiteralPath $maskTemp, $sealTemp
}
