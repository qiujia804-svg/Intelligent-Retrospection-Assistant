@echo off
chcp 65001 >nul
echo ============================================
echo Git 推送修复脚本
echo ============================================
echo.

cd /d "D:\AI tool\Intelligent-Retrospection-Assistant-master"

echo [1/3] 检查当前分支...
git branch

echo.
echo [2/3] 推送到 master 分支（不是 main）...
git push origin master

echo.
echo [3/3] 如果失败，尝试强制推送...
if %errorlevel% neq 0 (
    echo.
    echo 普通推送失败，尝试强制推送...
    git push origin master --force
)

echo.
echo ============================================
pause
