@echo off
setlocal

cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 "%~dp0convert_mdx_to_sqlite_gui.py"
    goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
    python "%~dp0convert_mdx_to_sqlite_gui.py"
    goto :eof
)

echo.
echo 未找到 Python，请先安装 Python 3。
echo 安装完成后重新双击这个 bat 文件即可。
echo.
pause
