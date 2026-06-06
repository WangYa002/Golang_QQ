@echo off
echo Starting Golang QQ...

echo Starting MongoDB...
start "MongoDB" /MIN cmd /c "D:\Golang\mongodb_install\mongodb-win32-x86_64-windows-8.0.4\bin\mongod.exe --dbpath D:\Golang\mongodb_data\db --port 27017 --logpath D:\Golang\mongodb_data\mongod.log"

timeout /t 3 /nobreak > nul

echo Starting Go backend...
start "Go Backend" /MIN cmd /c "cd /d D:\Golang\Golang_QQ\server && golang-qq.exe"

timeout /t 3 /nobreak > nul

echo Starting React frontend...
start "React Frontend" cmd /c "cd /d D:\Golang\Golang_QQ\web && npm run dev"

echo.
echo ========================================
echo   Golang QQ is running!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8080
echo ========================================
echo.
echo Press any key to stop all servers...
pause > nul

taskkill /FI "WINDOWTITLE eq MongoDB*" /F > nul 2>&1
taskkill /FI "WINDOWTITLE eq Go Backend*" /F > nul 2>&1
taskkill /FI "WINDOWTITLE eq React Frontend*" /F > nul 2>&1
