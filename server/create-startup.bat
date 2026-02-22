@echo off
chcp 65001 >nul
echo ==========================================
echo 创建邮件服务器启动文件...
echo ==========================================

:: 创建启动脚本
echo @echo off > "C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server\email-autostart.bat"
echo chcp 65001 ^>nul >> "C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server\email-autostart.bat"
echo cd /d "C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server" >> "C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server\email-autostart.bat"
echo pm2 delete email-server ^>nul 2^>^&1 >> "C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server\email-autostart.bat"
echo pm2 start email-server.js --name email-server >> "C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server\email-autostart.bat"
echo pm2 save >> "C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server\email-autostart.bat"

echo [信息] 启动脚本已创建！
echo [信息] 文件位置: C:\inetpub\wwwroot\Intelligent-Retrospection-Assistant-master\server\email-autostart.bat
echo.
echo 请手动将此文件复制到启动文件夹：
echo C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\
echo.
pause
