@echo off
chcp 65001 >nul
echo ========================================
echo  GIT PUSH SCRIPT - Realtime Database
echo ========================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: To Git DEN einai egkatestimeno!
    echo.
    echo Kane ena apo ta parakatw:
    echo 1. Katebase to GitHub Desktop: https://desktop.github.com/
    echo 2. H katebase to Git: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo ✅ Git vrethike!
echo.

REM Show current status
echo 📊 Trexw git status...
git status
echo.

REM Add all changes
echo ➕ Prosthetw oles tis allages...
git add -A
echo.

REM Commit with message
echo 💾 Kanw commit...
git commit -m "Migration: Firestore -> Realtime Database"
if errorlevel 1 (
    echo ⚠️ Tipota gia commit (isan idi commited?)
)
echo.

REM Push to origin
echo 🚀 Stelnw sto GitHub...
git push origin main
if errorlevel 1 (
    echo ❌ To push apetyxe!
    echo Dokimase: git push origin master
    pause
    exit /b 1
)

echo.
echo ========================================
echo  ✅ SUCCESS! Ola aneban kanonika!
echo ========================================
echo.
echo Tora mporw na paw sto Vercel kai na kanw redeploy
echo.
pause
