<#
.SYNOPSIS
    Builds a standalone release APK for CiviTrack that works without Metro dev server.

.DESCRIPTION
    This script:
    1. Validates prerequisites (Node, Java, Android SDK)
    2. Installs dependencies if needed
    3. Runs expo prebuild to sync native project
    4. Bundles JS via Hermes and builds a release APK
    5. Copies the final APK to ./build/ for easy access

.PARAMETER ApiUrl
    The backend API URL the app will connect to.
    In a release build __DEV__ is false, so the hardcoded dev URL won't be used.
    Pass your server URL here (e.g. your local network IP or production domain).
    Example: -ApiUrl "http://192.168.0.247:3000"

.EXAMPLE
    .\build-apk.ps1 -ApiUrl "http://192.168.0.247:3000"
    .\build-apk.ps1 -ApiUrl "https://civitrack.vercel.app"
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$ApiUrl
)

$ErrorActionPreference = "Stop"
$MobileDir = $PSScriptRoot
$AndroidDir = Join-Path $MobileDir "android"
$ThemeFile = Join-Path (Join-Path $MobileDir "constants") "theme.ts"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CiviTrack APK Builder (Release)      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: Check prerequisites ──────────────────────────────────────────────

Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
$nodeVersion = (node --version)
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Gray

# Java
# Java — prefer Android Studio's bundled JBR (JDK 21) for Gradle compatibility
$javaHome = $null
$studioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $studioJbr) {
    $javaHome = $studioJbr
    Write-Host "  Using Android Studio JBR: $javaHome" -ForegroundColor Gray
    $env:JAVA_HOME = $javaHome
} else {
    $javaHome = $env:JAVA_HOME
    if (-not $javaHome) {
        $possiblePaths = @(
            "C:\Program Files\Eclipse Adoptium\jdk-21*",
            "C:\Program Files\Eclipse Adoptium\jdk-17*",
            "C:\Program Files\Microsoft\jdk-21*",
            "C:\Program Files\Microsoft\jdk-17*",
            "C:\Program Files\Java\jdk-21*",
            "C:\Program Files\Java\jdk-17*"
        )
        foreach ($pattern in $possiblePaths) {
            $found = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                $javaHome = $found.FullName
                Write-Host "  Found JAVA_HOME at: $javaHome" -ForegroundColor Gray
                $env:JAVA_HOME = $javaHome
                break
            }
        }
    }
}
if (-not $javaHome) {
    Write-Host "WARNING: JAVA_HOME is not set. Gradle may fail." -ForegroundColor DarkYellow
    Write-Host "  Install Android Studio (includes JBR) or JDK 17/21." -ForegroundColor DarkYellow
} else {
    Write-Host "  JAVA_HOME: $javaHome" -ForegroundColor Gray
}

# Android SDK
$sdkDir = $null
$localProps = Join-Path $AndroidDir "local.properties"
if (Test-Path $localProps) {
    $sdkLine = Get-Content $localProps | Where-Object { $_ -match "^sdk\.dir=" }
    if ($sdkLine) {
        $sdkDir = ($sdkLine -replace "^sdk\.dir=", "") -replace "\\\\", "\" -replace "\\\:", ":"
    }
}
if (-not $sdkDir) { $sdkDir = $env:ANDROID_HOME }
if (-not $sdkDir) { $sdkDir = $env:ANDROID_SDK_ROOT }
if (-not $sdkDir) {
    $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $defaultSdk) { $sdkDir = $defaultSdk }
}
if ($sdkDir -and (Test-Path $sdkDir)) {
    Write-Host "  Android SDK: $sdkDir" -ForegroundColor Gray
} else {
    Write-Host "ERROR: Android SDK not found. Install Android Studio or set ANDROID_HOME." -ForegroundColor Red
    exit 1
}

# ── Step 1: Handle API URL ───────────────────────────────────────────────────

Write-Host ""
Write-Host "[2/6] Configuring API URL..." -ForegroundColor Yellow

# Read current production URL from theme.ts
$themeContent = Get-Content $ThemeFile -Raw
$currentProdUrl = ""
if ($themeContent -match ':\s*"(https?://[^"]+)";\s*$') {
    $currentProdUrl = $Matches[1]
}

if (-not $ApiUrl) {
    Write-Host ""
    Write-Host "  In a release build, __DEV__ is false." -ForegroundColor White
    Write-Host "  The app will connect to the production URL in constants/theme.ts" -ForegroundColor White
    Write-Host "  Current production URL: $currentProdUrl" -ForegroundColor Cyan
    Write-Host ""
    $response = Read-Host "  Enter API URL (or press Enter to keep current)"
    if ($response) {
        $ApiUrl = $response.Trim()
    }
}

$backupContent = $null
if ($ApiUrl) {
    Write-Host "  Setting production API URL to: $ApiUrl" -ForegroundColor Green
    # Backup and update theme.ts
    $backupContent = $themeContent
    $updatedContent = $themeContent -replace '(:\s*)"https?://[^"]+";\s*$', "`$1`"$ApiUrl`";"
    Set-Content -Path $ThemeFile -Value $updatedContent -NoNewline
} else {
    Write-Host "  Using existing production URL: $currentProdUrl" -ForegroundColor Green
}

# ── Step 2: Install dependencies ─────────────────────────────────────────────

Write-Host ""
Write-Host "[3/6] Installing dependencies..." -ForegroundColor Yellow

Push-Location $MobileDir
try {
    if (-not (Test-Path (Join-Path $MobileDir "node_modules"))) {
        Write-Host "  Running npm install..." -ForegroundColor Gray
        npm install 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: npm install failed." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  node_modules exists, skipping install." -ForegroundColor Gray
    }

    # ── Step 3: Expo prebuild ────────────────────────────────────────────────

    Write-Host ""
    Write-Host "[4/6] Running expo prebuild (syncing native project)..." -ForegroundColor Yellow
    $prebuildOutput = npx expo prebuild --platform android --no-install 2>&1
    $prebuildOutput | ForEach-Object {
        $msg = $_.ToString()
        if ($msg -match "error|fail|exception") {
            Write-Host "  $msg" -ForegroundColor Red
        } elseif ($msg -match "warn|»") {
            Write-Host "  $msg" -ForegroundColor DarkYellow
        }
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: expo prebuild returned non-zero exit code. Continuing anyway..." -ForegroundColor DarkYellow
    }

    # ── Step 4: Build release APK ────────────────────────────────────────────

    Write-Host ""
    Write-Host "[5/6] Building release APK (this may take several minutes)..." -ForegroundColor Yellow

    Push-Location $AndroidDir
    try {
        # Suppress PS5.1 stderr-as-error for native executables
        $origEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        # Clean previous build
        & .\gradlew.bat clean 2>&1 | Out-Null

        # Build release APK — this bundles JS via Hermes into the APK
        & .\gradlew.bat assembleRelease 2>&1 | ForEach-Object {
            $line = $_.ToString()
            if ($line -match "BUILD SUCCESSFUL") {
                Write-Host "  $line" -ForegroundColor Green
            } elseif ($line -match "BUILD FAILED|FAILURE|error:") {
                Write-Host "  $line" -ForegroundColor Red
            } elseif ($line -match "> Task :") {
                Write-Host "  $line" -ForegroundColor Gray
            }
        }

        $ErrorActionPreference = $origEAP

        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "ERROR: Gradle build failed. Check the output above." -ForegroundColor Red
            Write-Host "Common fixes:" -ForegroundColor Yellow
            Write-Host "  - Set JAVA_HOME to JDK 17+" -ForegroundColor Gray
            Write-Host "  - Accept Android SDK licenses: sdkmanager --licenses" -ForegroundColor Gray
            Write-Host "  - Clear gradle cache: Remove-Item ~\.gradle\caches -Recurse -Force" -ForegroundColor Gray
            exit 1
        }
    } finally {
        Pop-Location
    }

    # ── Step 5: Copy APK to build folder ─────────────────────────────────────

    Write-Host ""
    Write-Host "[6/6] Collecting APK..." -ForegroundColor Yellow

    $apkSource = Join-Path $AndroidDir "app\build\outputs\apk\release\app-release.apk"
    $buildDir = Join-Path $MobileDir "build"
    $apkDest = Join-Path $buildDir "CiviTrack.apk"

    if (-not (Test-Path $apkSource)) {
        Write-Host "ERROR: Release APK not found at expected path." -ForegroundColor Red
        Write-Host "  Expected: $apkSource" -ForegroundColor Gray
        # Try to find it
        $found = Get-ChildItem -Path (Join-Path $AndroidDir "app\build") -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue
        if ($found) {
            Write-Host "  Found APKs:" -ForegroundColor Yellow
            $found | ForEach-Object { Write-Host "    $($_.FullName)" -ForegroundColor Gray }
            $apkSource = $found[0].FullName
        } else {
            exit 1
        }
    }

    if (-not (Test-Path $buildDir)) {
        New-Item -ItemType Directory -Path $buildDir | Out-Null
    }

    Copy-Item -Path $apkSource -Destination $apkDest -Force

    $apkSize = [math]::Round((Get-Item $apkDest).Length / 1MB, 1)

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  APK: $apkDest" -ForegroundColor Cyan
    Write-Host "  Size: ${apkSize} MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Install on device:" -ForegroundColor White
    Write-Host "    adb install `"$apkDest`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Or transfer CiviTrack.apk to your phone and open it." -ForegroundColor White
    Write-Host ""

} finally {
    # Restore theme.ts if we modified it
    if ($backupContent) {
        Set-Content -Path $ThemeFile -Value $backupContent -NoNewline
        Write-Host "  (Restored original constants/theme.ts)" -ForegroundColor DarkGray
    }
    Pop-Location
}
