@echo off
echo.
echo ================================
echo Deploy to GitHub and Cloud Run
echo ================================
echo.

echo Step 1: Pushing to GitHub...
call git-push.bat

if %errorlevel% neq 0 (
    echo GitHub push failed. Stopping deployment.
    pause
    exit /b 1
)

echo.
echo Step 2: Deploying to Cloud Run...
call deploy.bat

echo.
echo ================================
echo All deployments completed!
echo ================================
pause