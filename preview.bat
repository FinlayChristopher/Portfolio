@echo off
title Portfolio preview - close this window to stop it
rem Serves this folder at http://localhost:8000/ the way GitHub Pages serves the site.
rem Pages that read their words from files need this: browsers block a page
rem opened straight from disk from reading other files.
cd /d "%~dp0"
set PY=
where py >nul 2>nul && set PY=py
if not defined PY where python >nul 2>nul && set PY=python
if not defined PY (
  echo Couldn't find Python. Install it from python.org and tick "Add python.exe to PATH".
  pause
  exit /b 1
)
rem turn on the commit hook (makes video posters before each commit), then
rem bring every video's poster up to date
git config core.hooksPath .githooks 2>nul
%PY% tools\make-posters.py
echo.
echo Serving the portfolio at http://localhost:8000/
echo Keep this window open while you look at the site. Close it to stop.
start "" cmd /c "timeout /t 1 >nul & start http://localhost:8000/"
%PY% -m http.server 8000
if errorlevel 1 (
  echo.
  echo The server stopped with an error. If it says the address is in use, another
  echo preview is already running: just open http://localhost:8000/
  pause
)
