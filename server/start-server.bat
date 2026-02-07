@echo off
echo Starting Email Server...
cd /d "%~dp0"
node email-server.js
pause
