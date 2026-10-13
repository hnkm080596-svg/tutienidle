param(
  [ValidateSet('Quest', 'Full', 'E2E')]
  [string]$Mode = 'Quest',
  [string]$E2ESpec = '',
  [string]$E2EGrep = ''
)

$ErrorActionPreference = 'Stop'
$gameRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$nodeModules = Join-Path $gameRoot 'node_modules'

if (-not (Test-Path $nodeModules -PathType Container)) {
  throw "Local node_modules directory missing: $nodeModules"
}

# Keep Vite's watcher away from generated browser profiles and Vitest caches.
# node_modules is ignored by Vite and Git; do not touch existing QA scratch.
$qaTemp = Join-Path $nodeModules '.qa-runtime'
if (-not (Test-Path $qaTemp)) {
  New-Item -ItemType Directory -Path $qaTemp | Out-Null
}
$env:TEMP = $qaTemp
$env:TMP = $qaTemp

# Codex's sandbox redirects LOCALAPPDATA to an empty browser cache. Use the
# actual per-user Playwright cache when present; executable launch may still
# require host permission and is verified independently by the E2E runner.
$browserCache = Join-Path $env:USERPROFILE 'AppData\Local\ms-playwright'
if (Test-Path $browserCache -PathType Container) {
  $env:PLAYWRIGHT_BROWSERS_PATH = $browserCache
}

Set-Location $gameRoot
Write-Host "QA game root: $gameRoot"
Write-Host "QA temporary root: $qaTemp"
Write-Host "Playwright cache: $env:PLAYWRIGHT_BROWSERS_PATH"

function Invoke-VerifiedStep([string]$Step, [string]$Executable, [string[]]$Arguments) {
  Write-Host "Running $Step"
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed (exit code $LASTEXITCODE)"
  }
}

switch ($Mode) {
  'Quest' {
    Invoke-VerifiedStep 'type-check' 'npm' @('run', 'type-check')
    Invoke-VerifiedStep 'quest-scoped Vitest' 'npx' @(
      'vitest', 'run', 'questUi', 'QuestRow', 'QuestPreviewLocaleGap', 'i18nKeyParity',
      '--configLoader', 'native'
    )
  }
  'Full' {
    Invoke-VerifiedStep 'type-check' 'npm' @('run', 'type-check')
    Invoke-VerifiedStep 'build' 'npm' @('run', 'build')
    # The repository QA protocol stops at the first failing gate; run the
    # entire suite only when it is clean, without masking an early failure.
    Invoke-VerifiedStep 'full Vitest' 'npx' @('vitest', 'run', '--configLoader', 'native', '--bail=1')
  }
  'E2E' {
    # Each run gets its own output directory; preserve all prior test artifacts.
    $runId = (Get-Date -Format 'yyyyMMdd-HHmmss-fffffff')
    $outputDir = Join-Path $qaTemp "playwright-$runId"
    $playwrightArgs = @('playwright', 'test', '--workers=1', '--output', $outputDir)
    if ($E2ESpec) { $playwrightArgs += $E2ESpec }
    if ($E2EGrep) { $playwrightArgs += @('--grep', $E2EGrep) }
    Invoke-VerifiedStep 'Playwright E2E' 'npx' $playwrightArgs
  }
}

Write-Host "Verification mode $Mode passed."
