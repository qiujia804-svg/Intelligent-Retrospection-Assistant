@echo off
chcp 65001 >nul
echo ==========================================
echo  智能复盘助手 - 一键部署脚本
echo ==========================================
echo.

REM 进入项目目录
cd /d "D:\AI tool\Intelligent-Retrospection-Assistant-master"
if errorlevel 1 (
    echo [错误] 无法进入项目目录
    pause
    exit /b 1
)

REM 检查是否有修改
git diff --quiet
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo [信息] 没有检测到文件修改
    echo.
    choice /C YN /M "是否仍要强制重新部署"
    if errorlevel 2 exit /b 0
    set FORCE_DEPLOY=1
) else (
    set FORCE_DEPLOY=0
)

echo.
echo [1/4] 正在添加文件到暂存区...
git add .
if errorlevel 1 (
    echo [错误] git add 失败
    pause
    exit /b 1
)

echo [2/4] 正在提交更改...
if %FORCE_DEPLOY% equ 1 (
    git commit --allow-empty -m "chore: 强制重新部署 - %date% %time%"
) else (
    git commit -m "auto: 自动部署更新 - %date% %time%"
)
if errorlevel 1 (
    echo [错误] git commit 失败
    pause
    exit /b 1
)

echo [3/4] 正在推送到 GitHub...
git push origin master
if errorlevel 1 (
    echo [错误] git push 失败，尝试拉取最新更改后重试...
    git pull origin master --rebase
    git push origin master
    if errorlevel 1 (
        echo [错误] 推送仍然失败，请手动解决冲突
        pause
        exit /b 1
    )
)

echo [4/4] 推送成功！
echo.
echo ==========================================
echo  部署已触发，Vercel 将自动构建并部署
echo  请访问 https://vercel.com/dashboard 查看进度
echo ==========================================
echo.
pause
