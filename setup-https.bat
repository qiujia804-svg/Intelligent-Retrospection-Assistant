@echo off
chcp 65001 >nul
echo ============================================
echo   配置 HTTPS (SSL 证书)
echo ============================================
echo.

:: 配置变量
set SERVER_IP=81.71.18.174
set SERVER_USER=root

echo 将在服务器上安装 Certbot 并申请 SSL 证书
echo 域名: deepmind.work, www.deepmind.work
echo.

ssh -o StrictHostKeyChecking=no %SERVER_USER%@%SERVER_IP% "
echo '安装 Certbot...'
apt install -y certbot python3-certbot-nginx

echo '申请 SSL 证书...'
certbot --nginx -d deepmind.work -d www.deepmind.work --non-interactive --agree-tos --email admin@deepmind.work --redirect

echo '设置自动续期...'
systemctl enable certbot.timer
systemctl start certbot.timer

echo '检查证书状态...'
certbot certificates
"

if %errorlevel% neq 0 (
    echo.
    echo [错误] HTTPS 配置失败
    pause
    exit /b 1
)

echo.
echo ============================================
echo   HTTPS 配置完成！
echo ============================================
echo.
echo 现在可以通过 https://deepmind.work 访问
echo.
pause
