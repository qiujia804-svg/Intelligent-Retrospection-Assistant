@echo off
chcp 936 >nul
echo ============================================
echo   Intelligent Retrospection Assistant - Deploy
echo ============================================
echo.

:: Config
set SERVER_IP=81.71.18.174
set SERVER_USER=root
set PROJECT_DIR=/var/www/deepmind

:: Check OpenSSH
where scp >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] OpenSSH not found. Please install it.
    echo Settings -^> Apps -^> Optional features -^> Add feature -^> OpenSSH Client
    pause
    exit /b 1
)

echo [Step 1/3] Uploading files to server...
echo Target: %SERVER_USER%@%SERVER_IP%:%PROJECT_DIR%
echo.

:: Upload files using scp
scp -r -o StrictHostKeyChecking=no index.html review-assistant.js review-assistant.css mobile.css manifest.json service-worker.js offline.html robots.txt sitemap.xml admin.html chart-demo.html data-repair-tool.html data-storage.js commercial-system.js import-data.js generate-qrcode.js icons images server api %SERVER_USER%@%SERVER_IP%:%PROJECT_DIR%/

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Upload failed. Please check:
    echo   1. Server IP: %SERVER_IP%
    echo   2. Network connection
    echo   3. SSH password or key
    pause
    exit /b 1
)

echo.
echo [Step 2/3] Uploading deploy script...
scp -o StrictHostKeyChecking=no deploy-to-server.sh %SERVER_USER%@%SERVER_IP%:/root/

echo.
echo [Step 3/3] Running deployment on server...
ssh -o StrictHostKeyChecking=no %SERVER_USER%@%SERVER_IP% "bash /root/deploy-to-server.sh"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Deployment failed
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Deployment Complete!
echo ============================================
echo.
echo Visit: http://deepmind.work
echo.
pause
