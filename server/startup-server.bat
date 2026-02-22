@echo off
chcp 65001 >nul
echo ==========================================
echo 启动邮件服务器...
echo ==========================================

:: 进入邮件服务器目录
cd /d "C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server"

:: 删除旧进程（如果存在）
pm2 delete email-server >nul 2>&1

:: 启动邮件服务器
echo [信息] 正在启动邮件服务器...
pm2 start email-server.js --name email-server

:: 保存 pm2 配置
echo [信息] 保存 pm2 配置...
pm2 save

echo ==========================================
echo 邮件服务器启动完成！
echo 访问地址: http://81.71.18.174:3000
echo ==========================================
