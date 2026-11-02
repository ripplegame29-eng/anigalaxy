# Апскейл артов героев нейросетью Real-ESRGAN (модель для аниме), на видеокарте через Vulkan.
# Оригиналы в data\cards-art не трогаются: результат кладётся в data\cards-art-hd,
# сайт сам берёт HD-версию, если она есть (см. src/app/api/cards/art/[id]/route.ts).
# Запуск из папки проекта:  powershell -ExecutionPolicy Bypass -File scripts\upscale-art.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "data\cards-art"
$dst = Join-Path $root "data\cards-art-hd"
$tool = Join-Path $root "tools\realesrgan"
$exe = Join-Path $tool "realesrgan-ncnn-vulkan.exe"

if (-not (Test-Path $exe)) {
  Write-Host "Скачиваю Real-ESRGAN (около 40 МБ)..."
  New-Item -ItemType Directory -Force $tool | Out-Null
  $zip = Join-Path $tool "r.zip"
  Invoke-WebRequest "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip" -OutFile $zip
  Expand-Archive $zip -DestinationPath $tool -Force
  Remove-Item $zip
}
New-Item -ItemType Directory -Force $dst | Out-Null
Write-Host "Обрабатываю $src -> $dst (может занять 10-30 минут)..."
& $exe -i $src -o $dst -n realesrgan-x4plus-anime -s 4 -f jpg
Write-Host "Готово: $((Get-ChildItem $dst -Filter *.jpg).Count) файлов. Обновите страницу сайта (Ctrl+F5)."
