# Эмулятор Android для проверки AniGalaxy: Android 14 с Google Play (внутри есть Chrome).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root  = $PSScriptRoot
$tools = Join-Path $root '.tools'
$sdk   = Join-Path $tools 'sdk'
$jdk = Get-ChildItem $tools -Directory -Filter 'jdk-17*' | Select-Object -First 1
$env:JAVA_HOME = $jdk.FullName
$env:Path = "$($jdk.FullName)\bin;$sdk\platform-tools;$sdk\emulator;$env:Path"
$env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk
$env:ANDROID_AVD_HOME = Join-Path $tools 'avd'
New-Item -ItemType Directory -Force $env:ANDROID_AVD_HOME | Out-Null
$sdkm = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
$avdm = Join-Path $sdk 'cmdline-tools\latest\bin\avdmanager.bat'
$img  = 'system-images;android-34;google_apis_playstore;x86_64'

Write-Host '=== Эмулятор и образ Android 14 (один раз, ~3 ГБ) ==='
$lic = Join-Path $sdk 'licenses'
"`n24333f8a63b6825ea9c5514f83c2829b004d1fee`nd56f5187479451eabf01fb78af6dfcb131a6481e`n8933bad161af4178b1185d1a37fbf41ea5269c55" | Set-Content (Join-Path $lic 'android-sdk-license') -Encoding ASCII
"`n84831b9409646a918e30573bab4c9c91346d8abd" | Set-Content (Join-Path $lic 'android-sdk-preview-license') -Encoding ASCII
"`n859f317696f67ef3d7f30a50a5560e7834b43903" | Set-Content (Join-Path $lic 'android-sdk-arm-dbt-license') -Encoding ASCII
"`n33b6a2b64607f11b759f320ef9dff4ae5c47d97a" | Set-Content (Join-Path $lic 'google-gdk-license') -Encoding ASCII
if (-not (Test-Path (Join-Path $sdk 'system-images\android-34\google_apis_playstore\x86_64'))) {
  & $sdkm "--sdk_root=$sdk" 'emulator' $img
  if ($LASTEXITCODE -ne 0) { throw 'sdkmanager не скачал эмулятор' }
}

Write-Host '=== Проверка ускорения ==='
& (Join-Path $sdk 'emulator\emulator.exe') -accel-check

Write-Host '=== Виртуальный телефон ==='
$avd = 'AniGalaxy_Pixel'
if (-not (Test-Path (Join-Path $env:ANDROID_AVD_HOME "$avd.avd"))) {
  'no' | & $avdm create avd -n $avd -k $img -d pixel_7 --force
  $cfg = Join-Path $env:ANDROID_AVD_HOME "$avd.avd\config.ini"
  Add-Content $cfg "hw.ramSize=4096`nhw.gpu.enabled=yes`nhw.gpu.mode=host`nhw.keyboard=yes`ndisk.dataPartition.size=6G"
}

Write-Host '=== Запуск ==='
$running = (& adb devices) -match 'emulator-'
if (-not $running) { Start-Process (Join-Path $sdk 'emulator\emulator.exe') -ArgumentList "-avd $avd -gpu host -no-snapshot-save -no-boot-anim" }
& adb wait-for-device
do { Start-Sleep 3; $b = (& adb shell getprop sys.boot_completed 2>$null) } until ($b -match '1')
Start-Sleep 5
Write-Host '=== Установка AniGalaxy ==='
& adb uninstall ru.anigalaxy.app | Out-Null
& adb install -r (Join-Path $root 'out\AniGalaxy.apk')
& adb shell monkey -p ru.anigalaxy.app -c android.intent.category.LAUNCHER 1
"OK" | Set-Content (Join-Path $root 'emu-done.txt')
Write-Host 'Готово: AniGalaxy запущен в эмуляторе.'
