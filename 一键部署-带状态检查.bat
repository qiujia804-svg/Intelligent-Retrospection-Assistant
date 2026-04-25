@echo off
chcp 65001 >nul
echo ==========================================
echo  智能复盘助手 - 一键部署（带状态检查）
echo ==========================================
echo.

cd /d "D:\AI tool\Intelligent-Retrospection-Assistant-master"
if errorlevel 1 (
    echo [错误] 无法进入项目目录
    pause
    exit /b 1
)

REM 显示当前状态
echo [信息] 当前分支: 
git branch --show-current
echo.
echo [信息] 最近的提交:
git log -1 --oneline
echo.
echo [信息] 未提交的修改:
git status --short
echo.

REM 检查是否有修改
git diff --quiet
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo [信息] 工作区干净，没有需要提交的修改
    echo.
    choice /C YN /M "是否进行空提交强制重新部署"
    if errorlevel 2 (
        echo 已取消部署
        pause
        exit /b 0
    )
    set COMMIT_MSG=chore: 强制重新部署 - %date% %time%
    set ALLOW_EMPTY=--allow-empty
) else (
    set /p COMMIT_MSG="请输入提交说明（直接回车使用默认）: "
    if "!COMMIT_MSG!"=="" set COMMIT_MSG=auto: 更新部署 - %date% %time%
    set ALLOW_EMPTY=
)

echo.
echo [1/3] 添加文件...
git add .

echo [2/3] 提交更改...
git commit %ALLOW_EMPTY% -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo [错误] 提交失败
    pause
    exit /b 1
)

echo [3/3] 推送到远程...
git push origin master
if errorlevel 1 (
    echo.
    echo [警告] 推送失败，尝试自动解决...
    git pull origin master --rebase
    if errorlevel 1 (
        echo [错误] 自动合并失败，请手动解决冲突
        pause
        exit /b 1
    )
    git push origin master
    if errorlevel 1 (
        echo [错误] 推送仍然失败
        pause
        exit /b 1
    )
)

echo.
echo ==========================================
echo  部署成功触发！
echo  查看最新部署: https://vercel.com/dashboard
echo  访问网站: https://deepmind.work
echo ==========================================
pause
