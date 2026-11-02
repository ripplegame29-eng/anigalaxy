# Upscale hero art with Real-ESRGAN (anime model, GPU via Vulkan).
# Originals in data\cards-art are untouched; output goes to data\cards-art-hd,
# the site serves the HD file when it exists (src/app/api/cards/art/[id]/route.ts).
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\upscale-art.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "data\cards-art"
$dst = Join-Path $root "data\cards-art-hd"
$tool = Join-Path $root "tools\realesrgan"
$exe = Get-ChildItem $tool -Recurse -Filter "realesrgan-ncnn-vulkan.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $exe) {
  Write-Host "Downloading Real-ESRGAN (about 40 MB)..."
  New-Item -ItemType Directory -Force $tool | Out-Null
  $zip = Join-Path $tool "r.zip"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip" -OutFile $zip
  Expand-Archive $zip -DestinationPath $tool -Force
  Remove-Item $zip
  $exe = Get-ChildItem $tool -Recurse -Filter "realesrgan-ncnn-vulkan.exe" | Select-Object -First 1
}
New-Item -ItemType Directory -Force $dst | Out-Null
Write-Host "Processing $src -> $dst (10-30 minutes)..."
Push-Location $exe.DirectoryName
& $exe.FullName -i $src -o $dst -n realesrgan-x4plus-anime -s 4 -f jpg
Pop-Location
Write-Host ("Done: " + (Get-ChildItem $dst -Filter *.jpg).Count + " files. Refresh the site (Ctrl+F5).")
