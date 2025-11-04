@echo off
setlocal enabledelayedexpansion
color 0A
cls

echo.
echo ============================================================
echo   CLA THESIS GROUP - Complete Setup Script
echo   Version 2.0 - Updated November 2025
echo ============================================================
echo.

REM Check Node.js
echo [CHECK] Verifying Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install from: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo SUCCESS: Node.js !NODE_VERSION! detected

REM Check Python
echo [CHECK] Verifying Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed!
    echo Please download and install from: https://www.python.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo SUCCESS: !PYTHON_VERSION! detected

echo.
echo [1/5] Installing Frontend Dependencies...
echo This may take a few minutes...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies
    echo.
    echo Troubleshooting tips:
    echo 1. Delete node_modules folder and try again
    echo 2. Run: npm cache clean --force
    echo 3. Check your internet connection
    pause
    exit /b 1
)
echo SUCCESS: Frontend dependencies installed

echo.
echo [2/5] Installing Backend Dependencies...
cd backend
if not exist "requirements.txt" (
    echo ERROR: requirements.txt not found in backend folder!
    cd ..
    pause
    exit /b 1
)

echo Installing Python packages...
call pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install backend dependencies
    echo.
    echo Troubleshooting tips:
    echo 1. Try: pip install --upgrade pip
    echo 2. Try: pip install -r requirements.txt --force-reinstall
    echo 3. Check your internet connection
    cd ..
    pause
    exit /b 1
)
cd ..
echo SUCCESS: Backend dependencies installed

echo.
echo [3/5] Checking Environment Files...
if not exist ".env.local" (
    echo WARNING: .env.local not found. Creating template...
    (
        echo # Supabase Configuration
        echo NEXT_PUBLIC_SUPABASE_URL=https://yuayzoouloznokcgeunb.supabase.co
        echo NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
        echo SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
        echo.
        echo # Backend URL
        echo BACKEND_BASE_URL=http://127.0.0.1:8000
        echo.
        echo # Email Configuration
        echo EMAIL_USER=your_email@gmail.com
        echo EMAIL_PASSWORD=your_gmail_app_password_here
        echo.
        echo # Resend API ^(Optional^)
        echo RESEND_API_KEY=your_resend_api_key_here
    ) > .env.local
    echo CREATED: .env.local template
    echo ACTION REQUIRED: Please update .env.local with your credentials!
) else (
    echo FOUND: .env.local exists
)

if not exist "backend\.env" (
    echo WARNING: backend/.env not found. Creating template...
    (
        echo # Backend Environment Variables
        echo SUPABASE_URL=https://yuayzoouloznokcgeunb.supabase.co
        echo SUPABASE_KEY=your_anon_key_here
        echo SERVICE_ROLE_KEY=your_service_role_key_here
    ) > backend\.env
    echo CREATED: backend/.env template
    echo ACTION REQUIRED: Please update backend/.env with your credentials!
) else (
    echo FOUND: backend/.env exists
)

echo.
echo [4/5] Verifying Installation...
echo Checking installed packages...
call npm list --depth=0 >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Some packages may have peer dependency warnings
    echo This is normal and shouldn't affect functionality
) else (
    echo SUCCESS: All packages verified
)

echo.
echo [5/5] Setup Complete!
echo.
echo ============================================================
echo   Installation Summary
echo ============================================================
echo.
echo Node.js:     !NODE_VERSION!
echo Python:      !PYTHON_VERSION!
echo Frontend:    READY
echo Backend:     READY
echo.
echo ============================================================
echo   Next Steps
echo ============================================================
echo.
echo 1. UPDATE your environment files:
echo    - .env.local (frontend config)
echo    - backend/.env (backend config)
echo.
echo 2. Get your Supabase credentials:
echo    - Visit: https://app.supabase.com/
echo    - Go to: Settings ^> API
echo    - Copy: URL, anon key, service_role key
echo.
echo 3. Setup Gmail App Password (for email):
echo    - Visit: https://myaccount.google.com/security
echo    - Enable: 2-Step Verification
echo    - Create: App Password for Mail
echo.
echo 4. START the application:
echo    ^> npm run dev
echo.
echo This will start:
echo   - Frontend: http://localhost:3000
echo   - Backend:  http://localhost:8000
echo   - API Docs: http://localhost:8000/docs
echo.
echo ============================================================
echo   Troubleshooting
echo ============================================================
echo.
echo If you encounter errors:
echo   1. Check SETUP_GUIDE.md for detailed solutions
echo   2. Run: npm cache clean --force
echo   3. Delete node_modules and run setup again
echo   4. Check your internet connection
echo.
echo For help, visit:
echo   - GitHub: https://github.com/YOUR_USERNAME/cla-thesis-group
echo   - Docs: README.md ^& SETUP_GUIDE.md
echo.
echo ============================================================
echo.
pause