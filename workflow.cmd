@echo off
setlocal
chcp 65001 >nul
set "PYTHONUTF8=1"
cd /d "%~dp0"

set "PYTHON_EXE=python"
python --version >nul 2>nul
if errorlevel 1 set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"

if /I "%~1"=="doctor" (
  "%PYTHON_EXE%" tools\agent_workflow.py doctor
) else (
  "%PYTHON_EXE%" tools\agent_workflow.py run %*
)

if errorlevel 1 (
  echo.
  echo Workflow gap loi. Hay gui noi dung loi nay cho Codex.
  pause
  exit /b 1
)

echo.
echo Workflow da ket thuc thanh cong.
pause
