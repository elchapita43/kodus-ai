param(
    [string]$TeamKey
)

$ErrorActionPreference = "Stop"

function Write-Header([string]$Message) {
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Step([string]$Message) {
    Write-Host "-> $Message" -ForegroundColor Yellow
}

function Write-Success([string]$Message) {
    Write-Host "OK $Message" -ForegroundColor Green
}

function Test-IsWindows {
    if (Get-Variable IsWindows -ErrorAction SilentlyContinue) {
        return [bool]$IsWindows
    }

    return $env:OS -eq 'Windows_NT'
}

function Get-NpmBin {
    try {
        $npmBin = (& npm bin -g).Trim()
        if ($npmBin) {
            return $npmBin
        }
    }
    catch {
    }

    $prefix = (& npm prefix -g).Trim()
    if (Test-IsWindows) {
        return $prefix
    }

    return (Join-Path $prefix 'bin')
}

function Get-CodusExecutableName {
    if (Test-IsWindows) {
        return 'codus.cmd'
    }

    return 'codus'
}

function Resolve-CodusCommand {
    $command = Get-Command codus -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $npmBin = Get-NpmBin
    $candidate = Join-Path $npmBin (Get-CodusExecutableName)
    if (Test-Path $candidate) {
        return $candidate
    }

    throw 'Unable to find codus after installation. Open a new terminal and try again.'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm is required but was not found. Install Node.js from https://nodejs.org and run again.'
}

Write-Header 'Codus CLI installer (PowerShell)'
Write-Step 'Installing or updating @codus/cli'
& npm install -g @codus/cli | Out-Host

$npmBin = Get-NpmBin
$pathSeparator = [System.IO.Path]::PathSeparator
$pathEntries = $env:Path -split [System.Text.RegularExpressions.Regex]::Escape([string]$pathSeparator)
if (-not ($pathEntries | Where-Object { $_ -eq $npmBin })) {
    $env:Path = "$npmBin$pathSeparator$env:Path"
}

$codus = Resolve-CodusCommand
$version = (& $codus --version).Trim()
Write-Success "Codus CLI ready ($version)"

if ($TeamKey) {
    Write-Step 'Authenticating with team key'
    & $codus auth team-key --key $TeamKey | Out-Host
    Write-Success 'Authenticated successfully'
}

Write-Step 'Installing bundled Codus skills into detected agent roots'
& $codus skills install | Out-Host
Write-Success 'Bundled skills installed'
