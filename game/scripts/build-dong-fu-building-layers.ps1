param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$sourceRoot = [IO.Path]::GetFullPath(
  (Join-Path $ProjectRoot 'art-source/buildings/dong-fu/v2')
)
$masterRoot = [IO.Path]::GetFullPath((Join-Path $sourceRoot 'masters-redesign'))
$runtimeRoot = [IO.Path]::GetFullPath(
  (Join-Path $ProjectRoot 'public/assets/buildings/dong-fu/v2')
)

$buildingSpecs = [ordered]@{
  chi_hien_quan = @{ X = 0; Y = 294; Width = 1244; Height = 659; Baseline = 953 }
  equipment_hall = @{ X = 85; Y = 185; Width = 1133; Height = 756; Baseline = 941 }
  pill_room = @{ X = 114; Y = 118; Width = 1028; Height = 914; Baseline = 1032 }
  teleport_array = @{ X = 86; Y = 167; Width = 1075; Height = 882; Baseline = 1049 }
  gathering_outpost = @{ X = 0; Y = 298; Width = 1254; Height = 604; Baseline = 902 }
  vendor = @{ X = 150; Y = 200; Width = 950; Height = 850; Baseline = 1050 }
}

function Invoke-Magick {
  param([Parameter(Mandatory = $true)][string[]]$MagickArgs)

  & magick @MagickArgs
  if ($LASTEXITCODE -ne 0) {
    throw "ImageMagick failed with exit code $LASTEXITCODE"
  }
}

function Get-PixelSignature([string]$Path) {
  $signature = & magick identify -format '%#' $Path
  if ($LASTEXITCODE -ne 0) { throw "Unable to identify image: $Path" }
  return $signature
}

function Copy-IfPixelsChanged([string]$Candidate, [string]$Destination) {
  if (
    (Test-Path -LiteralPath $Destination) -and
    (Get-PixelSignature $Candidate) -eq (Get-PixelSignature $Destination)
  ) {
    return
  }

  Copy-Item -LiteralPath $Candidate -Destination $Destination -Force
}

$tempBase = [IO.Path]::GetFullPath($env:TEMP)
$tempPrefix = $tempBase.TrimEnd(
  [IO.Path]::DirectorySeparatorChar,
  [IO.Path]::AltDirectorySeparatorChar
) + [IO.Path]::DirectorySeparatorChar
$tempRoot = [IO.Path]::GetFullPath(
  (Join-Path $tempBase "dong-fu-building-layers-$([IO.Path]::GetRandomFileName())")
)
if (-not $tempRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use a temporary directory outside the system temp root: $tempRoot"
}

try {
  New-Item -ItemType Directory -Path $tempRoot | Out-Null

  foreach ($buildingId in $buildingSpecs.Keys) {
    $spec = $buildingSpecs[$buildingId]
    $master = Join-Path $masterRoot "$buildingId-white.png"
    $destination = [IO.Path]::GetFullPath((Join-Path $runtimeRoot $buildingId))
    if (-not $destination.StartsWith($runtimeRoot, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to write outside the Dong Fu building root: $destination"
    }
    if (-not (Test-Path -LiteralPath $master)) { throw "Missing redesign master: $master" }

    New-Item -ItemType Directory -Force -Path $destination | Out-Null

    $insetX = $spec.X + 2
    $insetY = $spec.Y + 2
    $insetWidth = $spec.Width - 4
    $insetHeight = $spec.Height - 4
    $box = Join-Path $tempRoot "$buildingId-box.png"
    $normalized = Join-Path $tempRoot "$buildingId-normalized.png"
    $alpha = Join-Path $tempRoot "$buildingId-alpha.png"
    $baseCandidate = Join-Path $tempRoot "$buildingId-base.png"
    $gradedBase = Join-Path $tempRoot "$buildingId-base-graded.png"
    $maskCandidate = Join-Path $tempRoot "$buildingId-mask.png"
    $contact = Join-Path $tempRoot "$buildingId-contact.png"
    $contactCanvas = Join-Path $tempRoot "$buildingId-contact-canvas.png"
    $shadowCandidate = Join-Path $tempRoot "$buildingId-shadow.png"
    $sealTemp = Join-Path $tempRoot "$buildingId-seal.png"
    $lockedCandidate = Join-Path $tempRoot "$buildingId-locked.png"

    Invoke-Magick @(
      $master, '-fuzz', '3%', '-trim', '+repage',
      '-resize', "$($insetWidth)x$($insetHeight)>",
      '-gravity', 'south', '-background', 'white',
      '-extent', "$($insetWidth)x$($insetHeight)", $box
    )
    Invoke-Magick @(
      '-size', '1254x1254', 'xc:white', $box,
      '-geometry', "+$insetX+$insetY", '-compose', 'over', '-composite', $normalized
    )
    Invoke-Magick @(
      $normalized, '-colorspace', 'gray', '-negate',
      '-level', '2%,18%', '-blur', '0x0.45', $alpha
    )
    Invoke-Magick @(
      $normalized, $alpha, '-channel', 'RGB',
      '-fx', 'v.r<=0?0:max(0,min(1,(u-1+v.r)/v.r))', '+channel',
      $alpha, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
      "PNG32:$baseCandidate"
    )

    $finalBase = $baseCandidate
    if ($buildingId -eq 'teleport_array') {
      Invoke-Magick @(
        $baseCandidate, '-brightness-contrast', '-10x6',
        '-fill', '#5d5549', '-colorize', '8%', "PNG32:$gradedBase"
      )
      $finalBase = $gradedBase
    }

    Invoke-Magick @($finalBase, '-alpha', 'extract', '-threshold', '1%', $alpha)
    Invoke-Magick @(
      '-size', '1254x1254', 'xc:white', $alpha,
      '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', "PNG32:$maskCandidate"
    )

    $cropY = $spec.Baseline - 30
    Invoke-Magick @(
      $finalBase, '-alpha', 'extract', '-crop', "1254x28+0+$cropY", '+repage',
      '-threshold', '2%', '-resize', '1254x14!', '-blur', '0x5', $contact
    )
    Invoke-Magick @(
      '-size', '1254x1254', 'xc:black', $contact,
      '-geometry', "+0+$($spec.Baseline - 10)",
      '-compose', 'Lighten', '-composite', $contactCanvas
    )
    Invoke-Magick @(
      '-size', '1254x1254', 'xc:#171713', $contactCanvas,
      '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
      '-channel', 'A', '-evaluate', 'multiply', '0.34', '+channel',
      "PNG32:$shadowCandidate"
    )

    $sealSource = Join-Path $sourceRoot 'shared/locked-seal-source.png'
    Invoke-Magick @($sealSource, '-resize', '118x', "PNG32:$sealTemp")
    $sealGeometry = (& magick identify -format '%w %h' $sealTemp) -split ' '
    if ($LASTEXITCODE -ne 0) { throw "Unable to identify locked seal: $sealTemp" }
    $sealX = [int](627 - [int]$sealGeometry[0] / 2)
    $sealY = [int]($spec.Baseline - 125 - [int]$sealGeometry[1] / 2)
    Invoke-Magick @(
      $finalBase, '-colorspace', 'Gray', '-fill', '#40382e', '-colorize', '38%',
      '-channel', 'A', '-evaluate', 'multiply', '0.72', '+channel',
      '-write', 'mpr:locked', '+delete', 'mpr:locked', $sealTemp,
      '-gravity', 'northwest', '-geometry', "+$sealX+$sealY",
      '-compose', 'over', '-composite', "PNG32:$lockedCandidate"
    )

    Copy-IfPixelsChanged $finalBase (Join-Path $destination 'base.png')
    Copy-IfPixelsChanged $maskCandidate (Join-Path $destination 'silhouette-mask.png')
    Copy-IfPixelsChanged $shadowCandidate (Join-Path $destination 'ground-shadow.png')
    Copy-IfPixelsChanged $lockedCandidate (Join-Path $destination 'locked-overlay.png')
  }
}
finally {
  if (
    (Test-Path -LiteralPath $tempRoot) -and
    $tempRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)
  ) {
    Remove-Item -LiteralPath $tempRoot -Recurse
  }
}

