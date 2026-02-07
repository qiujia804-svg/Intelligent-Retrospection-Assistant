@echo off
echo 安装 pm2 进程管理器...
cd /d "%~dp0"

:: 安装 pm2
npm install -g pm2

:: 启动服务
pm2 start email-server.js --name "email-server"

:: 保存配置
pm2 save

:: 设置开机自启
pm2 startup

echo.
echo 安装完成！
echo 常用命令：
echo   pm2 list          - 查看运行状态
echo   pm2 stop email-server   - 停止服务
echo   pm2 restart email-server - 重启服务
echo   pm2 logs email-server    - 查看日志
pause
