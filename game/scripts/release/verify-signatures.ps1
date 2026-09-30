#Requires -Version 5.1
<#
.SYNOPSIS
  Verifies Authenticode signatures on a packaged Windows beta candidate.

.DESCRIPTION
  BETA-FINAL PR9 / spec B4 - signature verification, fail-closed.

  Enumerates the expected signed files from the candidate manifest
  (build/package-manifest.json `signing` section) and runs
  Get-AuthenticodeSignature over every .exe in the unpacked candidate plus
  the NSIS -Setup.exe installer when a release directory is given:

    - every *.exe must match a manifest list; an unlisted executable is
      rejected as unexpected (tamper surface)
    - expectedSignedFiles entries must exist (literal paths) and carry a
      Valid Authenticode signature whose signer thumbprint equals
      -ExpectedThumbprint, plus an RFC3161 timestamp countersignature
      (unless -AllowMissingTimestamp)
    - thirdPartySignedFiles entries may carry a different publisher's
      signature (upstream Electron artifacts such as resources/elevate.exe);
      when signed the signature must be Valid
    - the installer must be Valid + expected thumbprint when the manifest's
      signing.installerSigned is true

  -ArtifactPath accepts a single file (publisher check), an unpacked app dir
  (resources\app.asar present), or a release output dir (one *-unpacked
  candidate plus *-Setup.exe files - zero or ambiguous candidates refuse).

  No secrets live in this script: -ArtifactPath and -ExpectedThumbprint are
  typed parameters supplied by the candidate manifest and the approved
  certificate record (see docs/operations/beta/signing.md).

.EXAMPLE
  pwsh -NoProfile -File scripts/release/verify-signatures.ps1 `
    -ArtifactPath release `
    -ExpectedThumbprint A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ArtifactPath,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [ValidatePattern('^[0-9A-Fa-f]{40}$')]
  [string]$ExpectedThumbprint,

  [Parameter()]
  [string]$ManifestPath,

  [Parameter()]
  [switch]$AllowMissingTimestamp
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ExpectedThumbprint = $ExpectedThumbprint.ToUpperInvariant()

$script:Problems = New-Object 'System.Collections.Generic.List[string]'
$script:Verified = New-Object 'System.Collections.Generic.List[string]'
$script:Upstream = New-Object 'System.Collections.Generic.List[string]'

function Add-Problem([string]$Message) {
  $script:Problems.Add($Message)
}

# Same glob semantics as scripts/release/inspect-package.mjs globToRegExp:
# '*' inside a path segment, '**' across segments, a '**/' prefix matches
# zero or more directories. Paths compare as posix-style relative paths.
function ConvertTo-GlobRegex {
  param([Parameter(Mandatory = $true)][string]$Glob)
  $re = ''
  $i = 0
  while ($i -lt $Glob.Length) {
    $c = [string]$Glob[$i]
    if ($c -eq '*') {
      if ($i + 1 -lt $Glob.Length -and $Glob[$i + 1] -eq '*') {
        if ($i + 2 -lt $Glob.Length -and $Glob[$i + 2] -eq '/') {
          $re += '(?:.*/)?'
          $i += 3
        } else {
          $re += '.*'
          $i += 2
        }
      } else {
        $re += '[^/]*'
        $i += 1
      }
    } elseif ($c -eq '?') {
      $re += '[^/]'
      $i += 1
    } else {
      $re += [regex]::Escape($c)
      $i += 1
    }
  }
  return [regex]("^$re$")
}

function Test-Glob {
  param([string]$Pattern, [string]$Path)
  return (ConvertTo-GlobRegex -Glob $Pattern).IsMatch($Path)
}

function Test-AnyGlob {
  param([string[]]$Patterns, [string]$Path)
  foreach ($p in $Patterns) {
    if (Test-Glob -Pattern $p -Path $Path) { return $true }
  }
  return $false
}

function Test-FileSignature {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [bool]$RequirePublisher,
    [bool]$RequireTimestamp
  )
  $sig = $null
  try {
    $sig = Get-AuthenticodeSignature -LiteralPath $Path -ErrorAction Stop
  } catch {
    Add-Problem "signature query failed: $Path ($($_.Exception.Message))"
    return
  }
  if ($null -eq $sig) {
    Add-Problem "no signature information returned: $Path"
    return
  }
  if ($sig.Status -ne 'Valid') {
    # An unsigned upstream file listed in thirdPartySignedFiles is reported
    # but tolerated; an invalid/tampered signature always refuses.
    if (-not $RequirePublisher -and $sig.Status -eq 'NotSigned') {
      $script:Upstream.Add("$Path (unsigned upstream file)")
      return
    }
    Add-Problem "invalid artifact signature ($($sig.Status)): $Path"
    return
  }
  if ($RequirePublisher) {
    if ($null -eq $sig.SignerCertificate) {
      Add-Problem "signed file carries no signer certificate: $Path"
      return
    }
    if ($sig.SignerCertificate.Thumbprint -ne $ExpectedThumbprint) {
      Add-Problem "unexpected publisher thumbprint $($sig.SignerCertificate.Thumbprint) (expected $ExpectedThumbprint): $Path"
      return
    }
    if ($RequireTimestamp -and $null -eq $sig.TimeStamperCertificate) {
      Add-Problem "missing RFC3161 timestamp countersignature: $Path"
      return
    }
  }
  if ($RequirePublisher) {
    $script:Verified.Add($Path)
  } else {
    $script:Upstream.Add("$Path (publisher $($sig.SignerCertificate.Thumbprint))")
  }
}

function Test-UnpackedCandidate {
  param(
    [Parameter(Mandatory = $true)][string]$Dir,
    [string[]]$ExpectedSigned,
    [string[]]$ThirdPartySigned,
    [bool]$RequireTimestamp
  )
  $dirFull = (Get-Item -LiteralPath $Dir).FullName
  $exes = @(Get-ChildItem -LiteralPath $dirFull -Recurse -File -Filter '*.exe')
  if ($exes.Count -eq 0) {
    Add-Problem "no signable executables under $dirFull"
    return
  }
  $seen = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($f in $exes) {
    $rel = $f.FullName.Substring($dirFull.Length) -replace '^[\\/]', '' -replace '\\', '/'
    [void]$seen.Add($rel)
    if (Test-AnyGlob -Patterns $ExpectedSigned -Path $rel) {
      Test-FileSignature -Path $f.FullName -RequirePublisher $true -RequireTimestamp $RequireTimestamp
    } elseif (Test-AnyGlob -Patterns $ThirdPartySigned -Path $rel) {
      Test-FileSignature -Path $f.FullName -RequirePublisher $false -RequireTimestamp $false
    } else {
      Add-Problem "unexpected signable file not listed in the signing manifest: $rel"
    }
  }
  # Literal (non-wildcard) manifest entries must exist in the payload.
  foreach ($section in @($ExpectedSigned, $ThirdPartySigned)) {
    foreach ($rel in $section) {
      if ($rel -notmatch '[*?]' -and -not $seen.Contains($rel)) {
        Add-Problem "expected signed file missing from payload: $rel"
      }
    }
  }
}

# -- resolve candidate(s) -----------------------------------------------------

$item = Get-Item -LiteralPath $ArtifactPath -ErrorAction Stop
$unpackedDirs = @()
$installerFiles = @()
$singleFile = $null
$needManifest = $true

if (-not $item.PSIsContainer) {
  $singleFile = $item.FullName
  $needManifest = $false
} elseif (Test-Path -LiteralPath (Join-Path $item.FullName 'resources\app.asar')) {
  $unpackedDirs = @($item.FullName)
} else {
  $unpackedDirs = @(
    Get-ChildItem -LiteralPath $item.FullName -Directory |
      Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'resources\app.asar') } |
      ForEach-Object { $_.FullName }
  )
  $installerFiles = @(
    Get-ChildItem -LiteralPath $item.FullName -File -Filter '*-Setup.exe' |
      ForEach-Object { $_.FullName }
  )
  if ($unpackedDirs.Count -eq 0 -and $installerFiles.Count -eq 0) {
    Add-Problem "no packaged candidate under $ArtifactPath (expected a dir containing resources/app.asar or *-Setup.exe)"
  }
  if ($unpackedDirs.Count -gt 1) {
    Add-Problem "ambiguous payload: $($unpackedDirs.Count) unpacked candidates under $ArtifactPath - pass the specific dir"
  }
}

# -- manifest (expected-file enumeration) --------------------------------------

$expectedSigned = @()
$thirdPartySigned = @()
$installerSigned = $true

if ($needManifest -and $script:Problems.Count -eq 0) {
  if ([string]::IsNullOrEmpty($ManifestPath)) {
    $ManifestPath = Join-Path $PSScriptRoot '..\..\build\package-manifest.json'
  }
  if (-not (Test-Path -LiteralPath $ManifestPath)) {
    Add-Problem "candidate manifest not found: $ManifestPath"
  } else {
    $manifestJson = $null
    try {
      $manifestJson = Get-Content -LiteralPath $ManifestPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    } catch {
      Add-Problem "candidate manifest unreadable: $ManifestPath ($($_.Exception.Message))"
    }
    if ($null -ne $manifestJson) {
      if ($null -eq $manifestJson.signing -or $null -eq $manifestJson.signing.expectedSignedFiles) {
        Add-Problem "candidate manifest has no signing.expectedSignedFiles section"
      } else {
        $expectedSigned = @($manifestJson.signing.expectedSignedFiles)
        if ($null -ne $manifestJson.signing.thirdPartySignedFiles) {
          $thirdPartySigned = @($manifestJson.signing.thirdPartySignedFiles)
        }
        $installerSigned = ($manifestJson.signing.installerSigned -ne $false)
      }
    }
  }
}

# -- verification --------------------------------------------------------------

$requireTimestamp = -not $AllowMissingTimestamp.IsPresent

if ($null -ne $singleFile) {
  Test-FileSignature -Path $singleFile -RequirePublisher $true -RequireTimestamp $requireTimestamp
}
foreach ($dir in $unpackedDirs) {
  Test-UnpackedCandidate -Dir $dir -ExpectedSigned $expectedSigned -ThirdPartySigned $thirdPartySigned -RequireTimestamp $requireTimestamp
}
foreach ($inst in $installerFiles) {
  if ($installerSigned) {
    Test-FileSignature -Path $inst -RequirePublisher $true -RequireTimestamp $requireTimestamp
  } else {
    $script:Upstream.Add("$inst (installer unsigned by manifest contract)")
  }
}

# -- report ---------------------------------------------------------------------

foreach ($f in $script:Verified) { Write-Host "signed OK: $f" }
foreach ($f in $script:Upstream) { Write-Host "upstream:   $f" }
foreach ($p in $script:Problems) { [Console]::Error.WriteLine("verify-signatures: $p") }

if ($script:Problems.Count -gt 0) {
  Write-Host "verify-signatures FAILED: $($script:Problems.Count) problem(s), $($script:Verified.Count) publisher-verified file(s)"
  exit 1
}
Write-Host "verify-signatures OK: $($script:Verified.Count) publisher-verified file(s), thumbprint $ExpectedThumbprint"
exit 0
