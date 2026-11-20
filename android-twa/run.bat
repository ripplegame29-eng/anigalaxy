@echo off
chcp 65001 >nul
cd /d "%~dp0"
call build.bat
if not exist done.txt exit /b 1
call emulator.bat
