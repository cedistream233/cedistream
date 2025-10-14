@echo off
REM Development setup script for CediStream (Windows)

echo 🚀 Setting up CediStream development environment...

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd /d "%~dp0"
call npm install

REM Install frontend dependencies  
echo 📦 Installing frontend dependencies...
cd ..\frontend
call npm install

REM Go back to backend
cd ..\backend

echo ✅ Setup complete!
echo.
echo To start development:
echo   Backend:  cd backend ^&^& npm run dev
echo   Frontend: cd frontend ^&^& npm run dev
echo.
echo Or run both with: npm run dev (from backend folder)