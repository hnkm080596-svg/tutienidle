param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$runtimeRoot = [IO.Path]::GetFullPath(
  (Join-Path $ProjectRoot 'public/assets/backgrounds/dong-fu/modular/seasons')
)
$timeRoot = [IO.Path]::GetFullPath(
  (Join-Path $ProjectRoot 'public/assets/backgrounds/dong-fu/modular/times')
)
$previewRoot = [IO.Path]::GetFullPath(
  (Join-Path $ProjectRoot 'public/assets/backgrounds/dong-fu/modular/previews')
)
$masterRoot = [IO.Path]::GetFullPath(
  (Join-Path $ProjectRoot 'art-source/backgrounds/dong-fu/seasonal-masters')
)
$maskRoot = [IO.Path]::GetFullPath(
  (Join-Path $ProjectRoot 'art-source/backgrounds/dong-fu/layer-masks')
)
$seasons = @('spring', 'summer', 'autumn', 'winter')
$times = @('morning', 'noon', 'evening', 'night')

function Copy-IfPixelsChanged {
  param(
    [Parameter(Mandatory = $true)][string]$Candidate,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if (Test-Path -LiteralPath $Destination) {
    $candidateSignature = (magick identify -format '%#' $Candidate)
    $destinationSignature = (magick identify -format '%#' $Destination)
    if ($candidateSignature -eq $destinationSignature) {
      return
    }
  }

  Copy-Item -LiteralPath $Candidate -Destination $Destination -Force
}

$tempBase = [IO.Path]::GetFullPath($env:TEMP)
$tempName = "dong-fu-sect-ground-alpha-$([IO.Path]::GetRandomFileName())"
$tempRoot = [IO.Path]::GetFullPath((Join-Path $tempBase $tempName))
$tempPrefix = $tempBase.TrimEnd(
  [IO.Path]::DirectorySeparatorChar,
  [IO.Path]::AltDirectorySeparatorChar
) + [IO.Path]::DirectorySeparatorChar
if (-not $tempRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use a temporary directory outside the system temp root: $tempRoot"
}

try {
  New-Item -ItemType Directory -Path $tempRoot | Out-Null

foreach ($season in $seasons) {
  $destination = [IO.Path]::GetFullPath((Join-Path $runtimeRoot "$season/07-sect-ground.png"))
  $master = [IO.Path]::GetFullPath((Join-Path $masterRoot "$season.png"))
  $mask = [IO.Path]::GetFullPath((Join-Path $maskRoot "$season-07-sect-ground-alpha.png"))
  if (-not $destination.StartsWith($runtimeRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside the Dong Fu season root: $destination"
  }
  if (-not (Test-Path -LiteralPath $master)) { throw "Missing seasonal master: $master" }
  if (-not (Test-Path -LiteralPath $mask)) { throw "Missing approved layer mask: $mask" }

  $output = Join-Path $tempRoot "$season-07-sect-ground.png"

  # Always rebuild from immutable art source plus the approved repaired mask.
  # Never feed the runtime output back into alpha extraction: doing so would
  # erode soft ink edges on every repeated run.
  magick $master $mask -alpha off -compose CopyOpacity -composite "PNG32:$output"

  Copy-IfPixelsChanged -Candidate $output -Destination $destination
}

$previewPaths = @()
foreach ($season in $seasons) {
  foreach ($time in $times) {
    $preview = Join-Path $previewRoot "$season-$time.png"
    $previewCandidate = Join-Path $tempRoot "$season-$time.png"
    $layers = @(
      (Join-Path $timeRoot "$time/00-sky.png"),
      (Join-Path $timeRoot "$time/01-high-clouds.png"),
      (Join-Path $timeRoot "$time/02-light-veil.png"),
      (Join-Path $runtimeRoot "$season/03-far-mountains.png"),
      (Join-Path $runtimeRoot "$season/04-distant-ledges.png"),
      (Join-Path $runtimeRoot "$season/05-mid-landscape.png"),
      (Join-Path $runtimeRoot "$season/06-water-valley.png"),
      (Join-Path $runtimeRoot "$season/07-sect-ground.png"),
      (Join-Path $runtimeRoot "$season/08-low-mist.png"),
      (Join-Path $runtimeRoot "$season/09-foreground.png")
    )

    magick @layers -background none -layers flatten $previewCandidate
    Copy-IfPixelsChanged -Candidate $previewCandidate -Destination $preview
    $previewPaths += $preview
  }
}

  $contactSheet = Join-Path $previewRoot 'all-16-contact-sheet.png'
  $contactSheetCandidate = Join-Path $tempRoot 'all-16-contact-sheet.png'
  magick montage @previewPaths -thumbnail '418x235' -tile '4x4' `
    -geometry '+3+18' -background '#f5f0e4' -fill '#211f1a' `
    -pointsize 14 -label '%t' -depth 8 `
    $contactSheetCandidate
  Copy-IfPixelsChanged -Candidate $contactSheetCandidate -Destination $contactSheet
}
finally {
  if (
    (Test-Path -LiteralPath $tempRoot) -and
    $tempRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)
  ) {
    Remove-Item -LiteralPath $tempRoot -Recurse
  }
}
