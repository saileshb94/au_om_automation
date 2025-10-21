@echo off
echo.
echo ================================
echo Deploying to Cloud Run...
echo ================================
echo.

REM Check if gcloud is installed
echo Checking gcloud installation...
where gcloud >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: gcloud CLI not found in PATH
    echo Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)
echo gcloud found: OK
echo.

REM Check if gcloud is authenticated
echo Checking authentication...
gcloud auth list --filter=status:ACTIVE --format="value(account)" > temp.txt 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Failed to check authentication
    echo Please run: gcloud auth login
    del temp.txt 2>nul
    pause
    exit /b 1
)

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
REM Note: --launch-stage=BETA is required because the service uses manual scaling (a BETA feature)
gcloud run deploy lvlyaustraliaorders ^
    --source . ^
    --platform managed ^
    --region asia-southeast1 ^
    --project new-project-292307 ^
    --allow-unauthenticated ^
    --launch-stage=BETA

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