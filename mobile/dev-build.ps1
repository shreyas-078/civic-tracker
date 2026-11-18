<#
.SYNOPSIS
    Builds and installs a CiviTrack development build on a connected Android device or emulator.

.DESCRIPTION
    Unlike Expo Go, a dev build includes all native modules (expo-secure-store,
    expo-location, push notifications, etc.) so the full app works.
    Unlike a release APK, it connects to Metro for live reload & fast refresh.

    This script:
    1. Validates prerequisites (Node, Java, Android SDK, connected device)
    2. Installs dependencies if needed
    3. Starts the Next.js backend if not already running
    4. Runs expo prebuild to sync native config
    5. Builds a debug APK with native modules and installs it on device
    6. Starts Metro bundler — the app connects to it for JS

.PARAMETER SkipBackend
    Skip starting the Next.js dev server (if you already have it running).

.PARAMETER Clean
    Run a clean prebuild (wipes and regenerates the android folder).

.PARAMETER Device
    Target a specific device by serial (from 'adb devices'). If omitted,
    uses the only connected device or prompts if multiple are found.

.EXAMPLE
    .\dev-build.ps1
    .\dev-build.ps1 -Clean
    .\dev-build.ps1 -SkipBackend -Device "emulator-5554"
#>

param(
    [switch]$SkipBackend,
    [switch]$Clean,
    [string]$Device
)

$ErrorActionPreference = "Stop"
$MobileDir  = $PSScriptRoot
$ProjectDir = Split-Path $MobileDir -Parent
$AndroidDir = Join-Path $MobileDir "android"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CiviTrack Dev Build (Android)        " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Helpers ──────────────────────────────────────────────────────────────────

function Test-Port([int]$Port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $Port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

# ── Step 1: Check prerequisites ──────────────────────────────────────────────

Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: Node.js is not installed." -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js: $(node --version)" -ForegroundColor Gray

# Java — prefer Android Studio bundled JBR (JDK 21)
$javaHome = $null
$studioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $studioJbr) {
    $javaHome = $studioJbr
} else {
    $javaHome = $env:JAVA_HOME
    if (-not $javaHome) {
        $patterns = @(
            "C:\Program Files\Eclipse Adoptium\jdk-21*",
            "C:\Program Files\Eclipse Adoptium\jdk-17*",
            "C:\Program Files\Microsoft\jdk-21*",
            "C:\Program Files\Microsoft\jdk-17*",
            "C:\Program Files\Java\jdk-21*",
            "C:\Program Files\Java\jdk-17*"
        )
        foreach ($p in $patterns) {
            $found = Get-Item $p -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) { $javaHome = $found.FullName; break }
        }
    }
}
if ($javaHome) {
    $env:JAVA_HOME = $javaHome
    Write-Host "  JAVA_HOME: $javaHome" -ForegroundColor Gray
} else {
    Write-Host "  WARNING: JAVA_HOME not found. Gradle may fail." -ForegroundColor DarkYellow
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
    $env:ANDROID_HOME = $sdkDir
    Write-Host "  Android SDK: $sdkDir" -ForegroundColor Gray
} else {
    Write-Host "  ERROR: Android SDK not found." -ForegroundColor Red
    exit 1
}

# ADB + connected device
$adb = Join-Path (Join-Path $sdkDir "platform-tools") "adb.exe"
if (-not (Test-Path $adb)) {
    Write-Host "  ERROR: adb not found at $adb" -ForegroundColor Red
    exit 1
}

$devices = & $adb devices 2>&1 | Where-Object { $_ -match "\tdevice$" } | ForEach-Object { ($_ -split "\t")[0] }
if (-not $devices -or $devices.Count -eq 0) {
    Write-Host ""
    Write-Host "  ERROR: No Android device/emulator connected." -ForegroundColor Red
    Write-Host "  Connect a device via USB (enable USB debugging) or start an emulator." -ForegroundColor Gray
    Write-Host "  Then run this script again." -ForegroundColor Gray
    exit 1
}

$targetDevice = $Device
if (-not $targetDevice) {
    if ($devices.Count -eq 1) {
        $targetDevice = $devices
    } else {
        Write-Host ""
        Write-Host "  Multiple devices found:" -ForegroundColor White
        for ($i = 0; $i -lt $devices.Count; $i++) {
            Write-Host "    [$($i+1)] $($devices[$i])" -ForegroundColor Cyan
        }
        $choice = Read-Host "  Select device (1-$($devices.Count))"
        $idx = [int]$choice - 1
        if ($idx -lt 0 -or $idx -ge $devices.Count) {
            Write-Host "  Invalid selection." -ForegroundColor Red
            exit 1
        }
        $targetDevice = $devices[$idx]
    }
}
Write-Host "  Target device: $targetDevice" -ForegroundColor Green

# ── Step 2: Ensure Next.js backend is running ───────────────────────────────

Write-Host ""
Write-Host "[2/6] Checking backend server..." -ForegroundColor Yellow

if ($SkipBackend) {
    Write-Host "  Skipped (user flag)." -ForegroundColor Gray
} elseif (Test-Port 3000) {
    Write-Host "  Next.js already running on :3000" -ForegroundColor Green
} else {
    Write-Host "  Starting Next.js dev server in background..." -ForegroundColor Gray
    $backendJob = Start-Process powershell -ArgumentList "-NoProfile -Command cd '$ProjectDir'; npm run dev" `
        -WindowStyle Minimized -PassThru
    Write-Host "  Waiting for server to be ready..." -ForegroundColor Gray
    $waited = 0
    while (-not (Test-Port 3000) -and $waited -lt 30) {
        Start-Sleep -Seconds 2
        $waited += 2
    }
    if (Test-Port 3000) {
        Write-Host "  Next.js running on :3000 (PID $($backendJob.Id))" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Server didn't start in 30s. Continuing anyway..." -ForegroundColor DarkYellow
        Write-Host "  Start it manually: cd '$ProjectDir'; npm run dev" -ForegroundColor Gray
    }
}

# ── Step 3: Install dependencies ─────────────────────────────────────────────

Write-Host ""
Write-Host "[3/6] Installing dependencies..." -ForegroundColor Yellow

Push-Location $MobileDir
try {
    if (-not (Test-Path (Join-Path $MobileDir "node_modules"))) {
        Write-Host "  Running npm install..." -ForegroundColor Gray
        npm install 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: npm install failed." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  node_modules present." -ForegroundColor Gray
    }

    # ── Step 4: Expo prebuild ────────────────────────────────────────────────

    Write-Host ""
    Write-Host "[4/6] Running expo prebuild..." -ForegroundColor Yellow

    $prebuildArgs = "--platform android --no-install"
    if ($Clean) {
        $prebuildArgs = "--platform android --clean --no-install"
        Write-Host "  Clean mode: regenerating android folder." -ForegroundColor Gray
    }

    $origEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    Invoke-Expression "npx expo prebuild $prebuildArgs" 2>&1 | ForEach-Object {
        $msg = $_.ToString()
        if ($msg -match "error|fail|exception") {
            Write-Host "  $msg" -ForegroundColor Red
        } elseif ($msg -match "warn") {
            Write-Host "  $msg" -ForegroundColor DarkYellow
        }
    }

    $ErrorActionPreference = $origEAP

    # Ensure local.properties exists after prebuild
    $localProps = Join-Path $AndroidDir "local.properties"
    if (-not (Test-Path $localProps)) {
        $escapedSdk = $sdkDir -replace "\\", "\\" -replace ":", "\:"
        Set-Content -Path $localProps -Value "sdk.dir=$escapedSdk"
        Write-Host "  Recreated local.properties" -ForegroundColor Gray
    }

    # ── Step 5: Build debug APK ──────────────────────────────────────────────

    Write-Host ""
    Write-Host "[5/6] Building debug APK..." -ForegroundColor Yellow

    Push-Location $AndroidDir
    try {
        $origEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        & .\gradlew.bat assembleDebug 2>&1 | ForEach-Object {
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
            Write-Host "  ERROR: Gradle build failed." -ForegroundColor Red
            Write-Host "  Try: .\dev-build.ps1 -Clean" -ForegroundColor Gray
            exit 1
        }
    } finally {
        Pop-Location
    }

    # ── Step 6: Install on device & start Metro ──────────────────────────────

    Write-Host ""
    Write-Host "[6/6] Installing on device and starting Metro..." -ForegroundColor Yellow

    $apkPath = Join-Path $AndroidDir "app\build\outputs\apk\debug\app-debug.apk"
    if (-not (Test-Path $apkPath)) {
        # Try to find debug APK anywhere under build
        $found = Get-ChildItem -Path (Join-Path $AndroidDir "app\build") -Recurse -Filter "*debug*.apk" -ErrorAction SilentlyContinue
        if ($found) {
            $apkPath = $found[0].FullName
        } else {
            Write-Host "  ERROR: Debug APK not found." -ForegroundColor Red
            exit 1
        }
    }

    $apkSize = [math]::Round((Get-Item $apkPath).Length / 1MB, 1)
    Write-Host "  APK: $apkPath (${apkSize} MB)" -ForegroundColor Gray

    # Install
    Write-Host "  Installing on $targetDevice..." -ForegroundColor Gray
    $origEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    & $adb -s $targetDevice install -r $apkPath 2>&1 | ForEach-Object {
        $line = $_.ToString()
        if ($line -match "Success") {
            Write-Host "  Installed successfully!" -ForegroundColor Green
        } elseif ($line -match "Failure|error") {
            Write-Host "  $line" -ForegroundColor Red
        }
    }

    $ErrorActionPreference = $origEAP

    # Reverse port so device can reach Metro on :8081
    & $adb -s $targetDevice reverse tcp:8081 tcp:8081 2>&1 | Out-Null
    # Also reverse :3000 so the app can reach the Next.js server via localhost
    & $adb -s $targetDevice reverse tcp:3000 tcp:3000 2>&1 | Out-Null
    Write-Host "  adb reverse ports: 8081 (Metro), 3000 (Backend)" -ForegroundColor Gray

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  DEV BUILD READY!                     " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Starting Metro bundler..." -ForegroundColor Cyan
    Write-Host "  The app will open automatically on your device." -ForegroundColor White
    Write-Host "  Press Ctrl+C to stop Metro when done." -ForegroundColor Gray
    Write-Host ""

    # Launch the app on device, then start Metro (which the app connects to)
    $packageName = "com.civictrack.app"
    & $adb -s $targetDevice shell am start -n "$packageName/.MainActivity" 2>&1 | Out-Null

    # Start Metro — this is blocking (interactive terminal)
    npx react-native start --port 8081

} finally {
    Pop-Location
}
