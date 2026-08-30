param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$runtimeRoot = Join-Path $ProjectRoot 'public/assets/buildings/dong-fu/v2'
$backgroundRoot = Join-Path $ProjectRoot 'public/assets/backgrounds/dong-fu/modular/previews'
$previewRoot = Join-Path $runtimeRoot 'previews'
New-Item -ItemType Directory -Force -Path $previewRoot | Out-Null

$placements = @(
  @{ id = 'pill_room'; x = 13; y = 58; scale = 0.10; z = 11; baseline = 1032 },
  @{ id = 'equipment_hall'; x = 25; y = 45; scale = 0.10; z = 20; baseline = 941 },
  @{ id = 'spirit_spring'; x = 40; y = 55; scale = 0.10; z = 22; baseline = 953 },
  @{ id = 'gathering_outpost'; x = 68.5; y = 45.5; scale = 0.05; z = 21; baseline = 902 },
  @{ id = 'vendor'; x = 80; y = 46; scale = 0.05; z = 15; baseline = 1050 },
  @{ id = 'teleport_array'; x = 90; y = 80; scale = 0.20; z = 10; baseline = 1049 }
)

function Add-Buildings([string]$background, [string]$output, [string]$season) {
  magick $background -resize '1672x941!' "PNG32:$output"

  foreach ($placement in ($placements | Sort-Object z)) {
    $size = [int](1254 * $placement.scale)
    $left = [int](1672 * $placement.x / 100 - $size / 2)
    $top = [int](941 * $placement.y / 100 - $placement.baseline * $placement.scale)
    $sprite = Join-Path $env:TEMP "dong-fu-preview-$($placement.id).png"
    $shadow = Join-Path $runtimeRoot "$($placement.id)/ground-shadow.png"
    $base = Join-Path $runtimeRoot "$($placement.id)/base.png"

    magick $shadow $base -compose over -composite -resize "${size}x${size}!" "PNG32:$sprite"
    magick $output $sprite -geometry "+$left+$top" -compose over -composite "PNG32:$output"
    Remove-Item -LiteralPath $sprite
  }

  $seasonOverlay = Join-Path $runtimeRoot "shared/seasons/$season.png"
  magick $output $seasonOverlay -compose over -composite "PNG32:$output"
}

$springScene = Join-Path $previewRoot 'scene-placement.png'
Add-Buildings (Join-Path $backgroundRoot 'spring-morning.png') $springScene 'spring'

$nightScene = Join-Path $previewRoot 'night-readability.png'
Add-Buildings (Join-Path $backgroundRoot 'spring-night.png') $nightScene 'spring'
magick $nightScene -fill '#172039' -colorize 13% -brightness-contrast '-5x-3' "PNG32:$nightScene"

$seasonScenes = @()
foreach ($season in @('spring', 'summer', 'autumn', 'winter')) {
  $seasonScene = Join-Path $env:TEMP "dong-fu-preview-$season.png"
  Add-Buildings (Join-Path $backgroundRoot "$season-morning.png") $seasonScene $season
  $seasonScenes += $seasonScene
}
magick montage $seasonScenes -thumbnail '820x461' -background '#e8dfca' `
  -geometry '820x461+8+8' -tile '2x2' "PNG32:$(Join-Path $previewRoot 'seasons.png')"
$seasonScenes | ForEach-Object { Remove-Item -LiteralPath $_ }

$gameplayCells = @()
foreach ($placement in $placements) {
  $size = [int](1254 * $placement.scale)
  $cell = Join-Path $env:TEMP "dong-fu-scale-$($placement.id).png"
  $base = Join-Path $runtimeRoot "$($placement.id)/base.png"
  magick -size 320x300 xc:'#e8dfca' '(' $base -resize "${size}x${size}!" ')' `
    -gravity south -geometry '+0+14' -compose over -composite "PNG32:$cell"
  $gameplayCells += $cell
}
magick montage $gameplayCells -background '#e8dfca' -geometry '320x300+8+8' `
  -tile '6x1' "PNG32:$(Join-Path $previewRoot 'gameplay-scale.png')"
$gameplayCells | ForEach-Object { Remove-Item -LiteralPath $_ }

$stateCells = @()
foreach ($placement in $placements) {
  $id = $placement.id
  $base = Join-Path $runtimeRoot "$id/base.png"
  $mask = Join-Path $runtimeRoot "$id/silhouette-mask.png"
  $locked = Join-Path $runtimeRoot "$id/locked-overlay.png"

  foreach ($state in @('normal', 'hover', 'selected', 'locked')) {
    $cell = Join-Path $env:TEMP "dong-fu-state-$id-$state.png"
    if ($state -eq 'normal') {
      magick $base -resize '250x250!' "PNG32:$cell"
    } elseif ($state -eq 'locked') {
      magick $locked -resize '250x250!' "PNG32:$cell"
    } else {
      $color = if ($state -eq 'hover') { '#f4ead0' } else { '#b7862d' }
      $radius = if ($state -eq 'hover') { 5 } else { 9 }
      magick $mask -alpha extract -morphology Dilate "Disk:$radius" -write mpr:outline +delete `
        -size 1254x1254 "xc:$color" mpr:outline -alpha off -compose CopyOpacity -composite `
        $base -compose over -composite -resize '250x250!' "PNG32:$cell"
    }
    $stateCells += $cell
  }
}
magick montage $stateCells -background '#e8dfca' -geometry '250x250+7+7' `
  -tile '4x6' "PNG32:$(Join-Path $previewRoot 'states.png')"
$stateCells | ForEach-Object { Remove-Item -LiteralPath $_ }
