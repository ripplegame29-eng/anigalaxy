@echo off
chcp 65001 >nul
cd /d "%~dp0"
del emu-done.txt 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0emulator.ps1" > "%~dp0emulator.log" 2>&1
