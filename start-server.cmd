@echo off
setlocal

REM Starts the PHP built-in server using the PHP CLI ini (auto-detected).
REM This helps avoid "could not find driver" when pdo_mysql isn't enabled in the server ini.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
