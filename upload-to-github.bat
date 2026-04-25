@echo off
chcp 65001 >nul
echo ============================================
echo GitHub 上传助手
echo ============================================
echo.

REM 设置 Git 路径（如果已安装）
set PATH=%PATH%;C:\Program Files\Git\bin;C:\Program Files (x86)\Git\bin

REM 检查 Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Git
    echo 请访问 https://git-scm.com/download/win 下载安装
    pause
    exit /b 1
)

echo [✓] Git 已安装
echo.

REM 配置你的仓库地址
set REPO_URL=https://github.com/qiujia804-svg/AI-Retrospect-Network.git

echo 准备上传到: %REPO_URL%
echo.

REM 初始化 Git（如果未初始化）
if not exist ".git" (
    git init
    git branch -M main
)

REM 设置远程仓库
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo [1/4] 添加文件到 Git...
git add .

echo [2/4] 提交更改...
git commit -m "Initial upload" 2>nul || echo 无新文件需要提交

echo [3/4] 推送到 GitHub...
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo [✓] 上传成功！
    echo ============================================
    echo.
    echo 访问: https://github.com/qiujia804-svg/AI-Retrospect-Network
    echo.
) else (
    echo.
    echo [×] 上传失败
    echo 可能需要先在 GitHub 设置 Personal Access Token
)

pause
