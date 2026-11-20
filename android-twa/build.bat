@echo off
chcp 65001 >nul
cd /d "%~dp0"
del done.txt 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" > "%~dp0build.log" 2>&1
if exist done.txt (echo УСПЕХ) else (echo ОШИБКА - смотрите build.log)
