@echo off
echo.
echo ================================
echo Git Operations
echo ================================
echo.

REM Check git status first
echo Checking git status...
git status

echo.
echo Files to be committed:
git diff --cached --name-only

echo.
set /p CONTINUE="Continue with commit and push? (y/n): "
if /i not "%CONTINUE%"=="y" (
    echo Operation cancelled.
    pause
    exit /b 0
)

echo.
set /p MESSAGE="Enter commit message: "
if "%MESSAGE%"=="" set MESSAGE=Update from local development

echo.
echo Committing changes...
git add .
git commit -m "%MESSAGE%"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Commit failed!
    pause
    exit /b 1
)

echo.
echo Pushing to GitHub...
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Push failed!
    echo This might be due to:
    echo - Authentication issues
    echo - Secret scanning blocks
    echo - Network connectivity
    echo.
    echo Try running: git push origin main --verbose
    pause
    exit /b 1
)

echo.
echo ================================
echo Successfully pushed to GitHub!
echo ================================
pause