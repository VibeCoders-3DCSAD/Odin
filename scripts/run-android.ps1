# Windows helper: build/run the Expo app from a REAL short checkout at C:\odin.
#
# Why not subst/junction?
# Gradle/Kotlin canonicalize O: and junctions back to the long C:\Users\... path,
# which causes "different roots" and Ninja MAX_PATH failures.
#
# Do NOT use a global ~/.gradle/init.gradle buildDir redirect - it breaks RN autolinking.
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ShortRoot = "C:\odin"
$CxxRoot = "C:\c"

if ($env:ODIN_GRADLE_USER_HOME) {
  $env:GRADLE_USER_HOME = $env:ODIN_GRADLE_USER_HOME
} else {
  $env:GRADLE_USER_HOME = "C:\g"
}

$ShortTemp = "C:\t"
if (-not (Test-Path $ShortTemp)) {
  New-Item -ItemType Directory -Path $ShortTemp | Out-Null
}
$env:TEMP = $ShortTemp
$env:TMP = $ShortTemp

# Clear the subst/short-root rewrite path - this flow must not mix drive letters.
Remove-Item Env:ODIN_ANDROID_SHORT_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:ODIN_ANDROID_REAL_ROOT -ErrorAction SilentlyContinue

if (-not $env:ANDROID_HOME) {
  $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $defaultSdk) {
    $env:ANDROID_HOME = $defaultSdk
  }
}
if ($env:ANDROID_HOME) {
  $env:PATH = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:PATH"
}

function Test-IsReparsePoint([string]$Path) {
  if (-not (Test-Path $Path)) { return $false }
  $item = Get-Item $Path -Force
  return [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
}

function Ensure-Emulator {
  $devices = adb devices 2>$null | Select-String "`tdevice$"
  if ($devices) {
    Write-Host "Android device ready: $($devices.Line)"
    return
  }

  $emulator = Join-Path $env:ANDROID_HOME "emulator\emulator.exe"
  if (-not (Test-Path $emulator)) {
    throw "No Android device/emulator connected, and emulator.exe was not found."
  }

  $avd = if ($env:ODIN_ANDROID_AVD) { $env:ODIN_ANDROID_AVD } else { "Small_Phone" }
  Write-Host "Starting emulator AVD '$avd'..."
  Start-Process -FilePath $emulator -ArgumentList @("-avd", $avd, "-netdelay", "none", "-netspeed", "full") | Out-Null

  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 5
    $boot = (adb shell getprop sys.boot_completed 2>$null | Out-String).Trim()
    if ($boot -eq "1") {
      Write-Host "Emulator booted."
      return
    }
    Write-Host "Waiting for emulator boot..."
  } while ((Get-Date) -lt $deadline)

  throw "Emulator did not finish booting in time. Start 'Small_Phone' from Android Studio, then re-run."
}

function Ensure-ShortCheckout {
  if ((Test-Path $ShortRoot) -and -not (Test-IsReparsePoint $ShortRoot) -and (Test-Path (Join-Path $ShortRoot "apps\app\package.json"))) {
    Write-Host "Using existing short checkout: $ShortRoot"
    return
  }

  if (Test-Path $ShortRoot) {
    if (Test-IsReparsePoint $ShortRoot) {
      Write-Host "Removing old junction $ShortRoot"
      cmd /c "rmdir `"$ShortRoot`""
    } else {
      throw "$ShortRoot exists and is not a git worktree we manage. Move/rename it, then re-run."
    }
  }

  Write-Host "Creating short git worktree at $ShortRoot"
  Push-Location $RepoRoot
  try {
    git worktree add --detach "$ShortRoot" HEAD
  } finally {
    Pop-Location
  }
}

function Sync-LocalAppFiles {
  $pairs = @(
    @{ From = Join-Path $RepoRoot "apps\app\.env"; To = Join-Path $ShortRoot "apps\app\.env" },
    @{ From = Join-Path $RepoRoot "apps\app\app.config.ts"; To = Join-Path $ShortRoot "apps\app\app.config.ts" }
  )
  foreach ($pair in $pairs) {
    if (Test-Path $pair.From) {
      Copy-Item -Force $pair.From $pair.To
      Write-Host "Synced $(Split-Path $pair.To -Leaf)"
    }
  }

  $fromAndroid = Join-Path $RepoRoot "apps\app\android"
  $toAndroid = Join-Path $ShortRoot "apps\app\android"
  if (Test-Path $fromAndroid) {
    if (Test-Path $toAndroid) {
      Remove-Item -Recurse -Force $toAndroid
    }
    Write-Host "Copying android/ into short checkout (gitignored native project)"
    Copy-Item -Recurse -Force $fromAndroid $toAndroid
  }
}

Ensure-ShortCheckout

Write-Host "Installing deps in short checkout..."
Push-Location $ShortRoot
try {
  pnpm install
} finally {
  Pop-Location
}

Sync-LocalAppFiles

$AppDir = Join-Path $ShortRoot "apps\app"
$AndroidRoot = Join-Path $AppDir "android"
$AppAndroid = Join-Path $AndroidRoot "app"

if (-not (Test-Path $AndroidRoot)) {
  Write-Host "No android/ project yet - running expo prebuild..."
  Push-Location $AppDir
  try {
    pnpm exec expo prebuild --platform android --no-install
  } finally {
    Pop-Location
  }
}

# Short CMake object staging
if (-not (Test-Path $CxxRoot)) {
  New-Item -ItemType Directory -Path $CxxRoot | Out-Null
}
$CxxLink = Join-Path $AppAndroid ".cxx"
if (Test-Path $CxxLink) {
  # May be a junction or a normal directory. Native stderr must not abort the script.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if (Test-IsReparsePoint $CxxLink) {
      cmd /c "rmdir `"$CxxLink`"" | Out-Null
    } else {
      Remove-Item -LiteralPath $CxxLink -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $CxxLink) {
      Remove-Item -LiteralPath $CxxLink -Recurse -Force -ErrorAction SilentlyContinue
    }
  } finally {
    $ErrorActionPreference = $prevEap
  }
  if (Test-Path $CxxLink) {
    throw "Could not remove $CxxLink. Close Android Studio/Gradle and retry."
  }
}
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$mklink = cmd /c "mklink /J `"$CxxLink`" `"$CxxRoot`"" 2>&1
$ErrorActionPreference = $prevEap
if (-not (Test-Path $CxxLink)) {
  throw "Failed to create cxx junction: $mklink"
}
Write-Host "Linked $CxxLink -> $CxxRoot"

# Drop stale native/kotlin caches that may reference sandbox or long paths
@(
  (Join-Path $AndroidRoot "build"),
  (Join-Path $AndroidRoot ".gradle"),
  (Join-Path $AppAndroid "build"),
  (Join-Path $ShortRoot "node_modules\expo\android\build"),
  (Join-Path $ShortRoot "node_modules\react-native-worklets\android\.cxx"),
  (Join-Path $ShortRoot "node_modules\react-native-worklets-core\android\.cxx"),
  (Join-Path $ShortRoot "node_modules\react-native-reanimated\android\.cxx"),
  (Join-Path $ShortRoot "node_modules\expo-modules-core\android\.cxx")
) | ForEach-Object {
  if (Test-Path $_) {
    Remove-Item -Recurse -Force $_
    Write-Host "Cleared $_"
  }
}

# Stop daemons that may still point at cursor-sandbox-cache
foreach ($gradleHome in @($env:GRADLE_USER_HOME, "C:\g", "$env:LOCALAPPDATA\Temp\cursor-sandbox-cache")) {
  if (-not $gradleHome) { continue }
  $env:GRADLE_USER_HOME = "C:\g"
}
if (Test-Path (Join-Path $AndroidRoot "gradlew.bat")) {
  Push-Location $AndroidRoot
  cmd /c "gradlew.bat --stop" 2>$null | Out-Null
  Pop-Location
}
Get-Process -Name java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Ensure-Emulator
adb reverse tcp:3001 tcp:3001 2>$null | Out-Null
adb reverse tcp:8081 tcp:8081 2>$null | Out-Null

Set-Location $AppDir
Write-Host "GRADLE_USER_HOME=$env:GRADLE_USER_HOME"
Write-Host "TEMP=$env:TEMP"
Write-Host "Building from $AppDir (debug APK embeds JS; Metro not required to launch)"
pnpm android @args
