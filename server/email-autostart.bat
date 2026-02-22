@echo off
chcp 65001 >nul
cd /d "C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server"
pm2 delete email-server >nul 2>&1
pm2 start email-server.js --name email-server
pm2 save
echo 邮件服务器已启动
