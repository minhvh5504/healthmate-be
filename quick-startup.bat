@echo off
REM OMMS Backend Quick Startup Script for Windows
REM This script helps Frontend developers quickly start the backend services

setlocal enabledelayedexpansion

REM Colors (using Windows 10+ ANSI support)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

:main
cls
echo %BLUE%╔════════════════════════════════════════╗%NC%
echo %BLUE%║   OMMS Backend Quick Startup Script   ║%NC%
echo %BLUE%╚════════════════════════════════════════╝%NC%
echo.

REM Check if Docker is installed
echo %BLUE%🔍 Checking prerequisites...%NC%
call :check_docker
if errorlevel 1 goto :error

REM Check if Docker is running
call :check_docker_running
if errorlevel 1 goto :error

echo %GREEN%✅ All prerequisites met!%NC%
echo.

REM Ask user if they want to clean up first
set /p cleanup="Do you want to clean up existing containers? (y/N): "
if /i "%cleanup%"=="y" (
    call :cleanup
)

REM Start services
call :start_services
if errorlevel 1 goto :error

REM Wait for services to initialize
timeout /t 3 /nobreak >nul

REM Show status
call :show_status

echo.
echo %GREEN%✅ OMMS Backend is starting up!%NC%
echo %GREEN%🌐 Backend API will be available at: http://localhost:8080%NC%
echo %GREEN%📚 API Documentation (Swagger): http://localhost:8080/api%NC%
echo %GREEN%🗄️  Database: PostgreSQL on localhost:5432%NC%
echo.
echo %YELLOW%📝 Useful commands:%NC%
echo %YELLOW%   - View logs: docker-compose logs -f%NC%
echo %YELLOW%   - Stop services: docker-compose down%NC%
echo %YELLOW%   - Restart services: docker-compose restart%NC%
echo.

REM Ask if user wants to see logs
set /p viewlogs="Do you want to view the logs now? (Y/n): "
if /i not "%viewlogs%"=="n" (
    call :show_logs
)

goto :end

:check_docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Docker is not installed!%NC%
    echo %YELLOW%Please install Docker Desktop from: https://www.docker.com/products/docker-desktop%NC%
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo %RED%❌ Docker Compose is not installed!%NC%
        echo %YELLOW%Please install Docker Compose from: https://docs.docker.com/compose/install/%NC%
        exit /b 1
    )
)
exit /b 0

:check_docker_running
docker info >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Docker daemon is not running!%NC%
    echo %YELLOW%Please start Docker Desktop and try again.%NC%
    exit /b 1
)
exit /b 0

:cleanup
echo %YELLOW%🧹 Cleaning up existing containers...%NC%
docker-compose down -v >nul 2>&1
if errorlevel 1 (
    docker compose down -v >nul 2>&1
)
exit /b 0

:start_services
echo %BLUE%🚀 Starting OMMS Backend services...%NC%
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose up --build -d
) else (
    docker-compose up --build -d
)
if errorlevel 1 (
    echo %RED%❌ Failed to start services!%NC%
    exit /b 1
)
exit /b 0

:show_logs
echo %BLUE%📋 Showing logs (Press Ctrl+C to exit logs, services will continue running)...%NC%
timeout /t 2 /nobreak >nul
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose logs -f
) else (
    docker-compose logs -f
)
exit /b 0

:show_status
echo.
echo %GREEN%📊 Service Status:%NC%
docker ps --filter "name=omms" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
exit /b 0

:error
echo.
echo %RED%❌ An error occurred. Please check the messages above.%NC%
pause
exit /b 1

:end
echo.
echo %GREEN%Press any key to exit...%NC%
pause >nul
exit /b 0
