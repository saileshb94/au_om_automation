@echo off
echo.
echo ================================
echo Environment Check
echo ================================
echo.

echo Checking Node.js...
node --version
if %errorlevel% neq 0 echo ERROR: Node.js not found!

echo.
echo Checking npm...
npm --version
if %errorlevel% neq 0 echo ERROR: npm not found!

echo.
echo Checking gcloud...
gcloud version
if %errorlevel% neq 0 echo ERROR: gcloud not found!

echo.
echo Checking git...
git --version
if %errorlevel% neq 0 echo ERROR: git not found!

echo.
echo Current project configuration:
gcloud config list

echo.
echo Current git status:
git status

echo.
echo Environment variables check:
if exist .env (
    echo .env file: EXISTS
) else (
    echo .env file: MISSING
)

echo.
pause