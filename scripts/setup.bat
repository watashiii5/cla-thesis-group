@echo off
color 0A
cls

echo.
echo ============================================================
echo   CLA THESIS GROUP - Complete Setup Script
echo ============================================================
echo.

echo [1/4] Installing Frontend Dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)

echo.
echo [2/4] Installing Backend Dependencies...
cd backend
call pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install backend dependencies
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [3/4] Checking environment files...
if not exist .env.local (
    echo WARNING: .env.local not found. Creating template...
    (
        echo # Supabase Configuration
        echo NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
        echo NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
        echo SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
        echo BACKEND_BASE_URL=http://127.0.0.1:8000
        echo RESEND_API_KEY=your_resend_api_key
        echo EMAIL_USER=your_email@gmail.com
        echo EMAIL_PASSWORD=your_email_password
    ) > .env.local
    echo Please update .env.local with your credentials!
)

if not exist backend\.env (
    echo WARNING: backend/.env not found. Creating template...
    (
        echo # Backend Environment Variables
        echo SUPABASE_URL=your_supabase_url
        echo SUPABASE_KEY=your_anon_key
        echo SERVICE_ROLE_KEY=your_service_role_key
    ) > backend\.env
    echo Please update backend/.env with your credentials!
)

echo.
echo [4/4] Setup Complete!
echo.
echo ============================================================
echo   Ready to Start Development
echo ============================================================
echo.
echo Run the following command to start both frontend and backend:
echo.
echo   npm run dev
echo.
echo This will start:
echo   - Frontend: http://localhost:3000
echo   - Backend: http://localhost:8000
echo   - API Docs: http://localhost:8000/docs
echo.
pause