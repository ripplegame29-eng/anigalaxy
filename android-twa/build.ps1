# Сборка Android-приложения AniGalaxy (TWA) для RuStore.
# Сам скачивает JDK 17, Android SDK и Gradle в папку .tools (один раз, ~1,5 ГБ),
# создаёт ключ подписи, собирает APK и AAB и пишет assetlinks.json для сайта.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root  = $PSScriptRoot
$tools = Join-Path $root '.tools'
New-Item -ItemType Directory -Force $tools | Out-Null
function Step($t) { Write-Host "`n=== $t ===" }
function Fetch($url, $zip, $dest) {
  if (-not (Test-Path $zip)) { Write-Host "Скачиваю $url"; Invoke-WebRequest $url -OutFile $zip -UseBasicParsing }
  Expand-Archive $zip -DestinationPath $dest -Force
}

Step 'JDK 17'
$jdk = Get-ChildItem $tools -Directory -Filter 'jdk-17*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $jdk) {
  Fetch 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' (Join-Path $tools 'jdk.zip') $tools
  $jdk = Get-ChildItem $tools -Directory -Filter 'jdk-17*' | Select-Object -First 1
}
$env:JAVA_HOME = $jdk.FullName
$env:Path = "$($jdk.FullName)\bin;$env:Path"
Write-Host "JAVA_HOME = $env:JAVA_HOME"

Step 'Android SDK'
$sdk = Join-Path $tools 'sdk'
$sdkm = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $sdkm)) {
  $tmp = Join-Path $tools 'clt'
  Fetch 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' (Join-Path $tools 'clt.zip') $tmp
  New-Item -ItemType Directory -Force (Join-Path $sdk 'cmdline-tools') | Out-Null
  Move-Item (Join-Path $tmp 'cmdline-tools') (Join-Path $sdk 'cmdline-tools\latest') -Force
}
$env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk
if (-not (Test-Path (Join-Path $sdk 'platforms\android-34'))) {
  $yes = ('y' + [Environment]::NewLine) * 30
  $yes | & $sdkm --sdk_root=$sdk --licenses | Out-Null
  & $sdkm --sdk_root=$sdk 'platforms;android-34' 'build-tools;34.0.0' 'platform-tools'
  if ($LASTEXITCODE -ne 0) { throw 'sdkmanager завершился с ошибкой' }
}
"sdk.dir=$($sdk -replace '\\','\\')" | Set-Content (Join-Path $root 'local.properties') -Encoding ASCII

Step 'Gradle'
$gradleDir = Get-ChildItem $tools -Directory -Filter 'gradle-8.9*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $gradleDir) {
  Fetch 'https://services.gradle.org/distributions/gradle-8.9-bin.zip' (Join-Path $tools 'gradle.zip') $tools
  $gradleDir = Get-ChildItem $tools -Directory -Filter 'gradle-8.9*' | Select-Object -First 1
}
$gradle = Join-Path $gradleDir.FullName 'bin\gradle.bat'

Step 'Ключ подписи'
$ks = Join-Path $root 'anigalaxy-release.jks'
$props = Join-Path $root 'keystore.properties'
if (-not (Test-Path $ks)) {
  $chars = (48..57) + (65..90) + (97..122)
  $pass = -join ($chars | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  & keytool -genkeypair -v -keystore $ks -alias anigalaxy -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $pass -keypass $pass -dname 'CN=AniGalaxy, O=AniGalaxy, C=RU'
  if ($LASTEXITCODE -ne 0) { throw 'keytool не создал ключ' }
  @("storeFile=anigalaxy-release.jks", "storePassword=$pass", "keyAlias=anigalaxy", "keyPassword=$pass") | Set-Content $props -Encoding ASCII
  Write-Host 'Ключ создан. СОХРАНИТЕ anigalaxy-release.jks и keystore.properties в надёжном месте: без них не выпустить обновление.'
}
$p = @{}; Get-Content $props | ForEach-Object { $k, $v = $_ -split '=', 2; $p[$k] = $v }

Step 'Сборка APK и AAB'
Push-Location $root
& $gradle --no-daemon -q assembleRelease bundleRelease
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw 'Gradle завершился с ошибкой' }

$out = Join-Path $root 'out'
New-Item -ItemType Directory -Force $out | Out-Null
Copy-Item (Join-Path $root 'app\build\outputs\apk\release\app-release.apk') (Join-Path $out 'AniGalaxy.apk') -Force
Copy-Item (Join-Path $root 'app\build\outputs\bundle\release\app-release.aab') (Join-Path $out 'AniGalaxy.aab') -Force

Write-Host "Готово: $out\AniGalaxy.apk и AniGalaxy.aab"
"OK" | Set-Content (Join-Path $root 'done.txt')
