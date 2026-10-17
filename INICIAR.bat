@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 24 LTS e tente novamente.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo Nao foi possivel instalar. Consulte README.md.
    pause
    exit /b 1
  )
)
echo.
echo Vendrex Distribuidora: abra http://127.0.0.1:5173
echo Painel: http://127.0.0.1:5173/admin
echo Mantenha esta janela aberta. Ctrl+C para encerrar.
echo.
call npm run build
if errorlevel 1 (
  echo Falha no build. Consulte README.md.
  pause
  exit /b 1
)
call npm start
pause
