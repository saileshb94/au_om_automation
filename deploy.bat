@echo off
echo.
echo ================================
echo Deploying to Cloud Run...
echo ================================
echo.

REM Check if gcloud is authenticated
gcloud auth list --filter=status:ACTIVE --format="value(account)" > temp.txt
set /p ACCOUNT=<temp.txt
del temp.txt

if "%ACCOUNT%"=="" (
    echo ERROR: Not authenticated with gcloud
    echo Please run: gcloud auth login
    pause
    exit /b 1
)

echo Authenticated as: %ACCOUNT%
echo.

REM Deploy to Cloud Run
gcloud run deploy lvlyaustraliaorders ^
    --source . ^
    --platform managed ^
    --region asia-southeast1 ^
    --project new-project-292307 ^
    --allow-unauthenticated

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Deployment failed!
    pause
    exit /b 1
)

echo.
echo ================================
echo Deployment completed successfully!
echo ================================
echo Your service is available at:
echo https://lvlyaustraliaorders-dzi6xsjkpa-as.a.run.app
echo.
pause