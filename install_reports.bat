@echo off
echo ========================================
echo  AgentCraft Enterprise Report Generator
echo  Installation Script
echo ========================================
echo.

echo [1/4] Installing Python dependencies...
pip install reportlab>=4.0.0
if %errorlevel% neq 0 (
    echo ERROR: Failed to install reportlab
    pause
    exit /b 1
)
echo ✓ reportlab installed successfully
echo.

echo [2/4] Verifying installation...
python -c "import reportlab; print('✓ reportlab version:', reportlab.__version__)"
if %errorlevel% neq 0 (
    echo ERROR: reportlab import failed
    pause
    exit /b 1
)
echo.

echo [3/4] Checking backend files...
if exist backend\report_generator.py (
    echo ✓ report_generator.py found
) else (
    echo ERROR: report_generator.py not found
    pause
    exit /b 1
)

if exist backend\report_templates.py (
    echo ✓ report_templates.py found
) else (
    echo ERROR: report_templates.py not found
    pause
    exit /b 1
)

if exist backend\pdf_generator.py (
    echo ✓ pdf_generator.py found
) else (
    echo ERROR: pdf_generator.py not found
    pause
    exit /b 1
)
echo.

echo [4/4] Checking frontend files...
if exist artifacts\agentcraft\src\components\reports\ReportViewer.tsx (
    echo ✓ ReportViewer.tsx found
) else (
    echo ERROR: ReportViewer.tsx not found
    pause
    exit /b 1
)
echo.

echo ========================================
echo  ✓ Installation Complete!
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Start backend server:
echo    python -m backend.main
echo.
echo 2. Start frontend (in new terminal):
echo    cd artifacts\agentcraft
echo    npm run dev
echo.
echo 3. Open browser:
echo    http://localhost:5173
echo.
echo 4. Run a workflow and click "View Enterprise Report"
echo.
echo For help, read:
echo - ENTERPRISE_REPORT_GENERATOR.md (documentation)
echo - setup_reports.md (quick setup guide)
echo - IMPLEMENTATION_SUMMARY.md (implementation details)
echo.
pause
