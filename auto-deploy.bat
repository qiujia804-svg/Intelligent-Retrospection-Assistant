@echo off
chcp 65001 >nul
echo ============================================
echo 智能复盘助手 - Vercel 自动部署工具
echo ============================================
echo.

REM 设置本地 Node.js 路径
set NODE_HOME=D:\Node
set PATH=%NODE_HOME%;%PATH%

REM 检查本地 Node.js 是否可用
if not exist "%NODE_HOME%\node.exe" (
    echo [错误] 未在 D:\Node 找到 Node.js
    echo 请确认 Node.js 已安装在该路径
    pause
    exit /b 1
)

echo [✓] Node.js 已找到: 
"%NODE_HOME%\node.exe" --version

REM 检查是否已本地安装 Vercel CLI
if not exist "node_modules\.bin\vercel.cmd" (
    echo.
    echo [安装] 正在本地安装 Vercel CLI...
    "%NODE_HOME%\npm" install vercel --save-dev
    if %errorlevel% neq 0 (
        echo [错误] Vercel CLI 安装失败
        pause
        exit /b 1
    )
)

echo [✓] Vercel CLI 已安装

REM 检查是否已登录
"node_modules\.bin\vercel" whoami >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [提示] 首次使用需要登录 Vercel 账号
    echo 请在浏览器中完成授权...
    "node_modules\.bin\vercel" login
)

echo.
echo [✓] Vercel 登录状态正常

REM 检查项目是否已关联 Vercel
if not exist ".vercel\project.json" (
    echo.
    echo [初始化] 首次部署，正在关联项目...
    "node_modules\.bin\vercel" link --yes
)

echo.
echo ============================================
echo 开始部署...
echo ============================================
echo.

REM 执行部署
"node_modules\.bin\vercel" deploy --prod --yes

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo [✓] 部署成功！
    echo ============================================
    echo.
    echo 访问地址将在上方显示 ^(Production^)
    echo.
) else (
    echo.
    echo [×] 部署失败，请检查错误信息
)

pause
