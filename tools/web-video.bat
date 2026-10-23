@echo off
rem Drag a video onto this file to put a web-sized copy of it in Media.
rem See tools\web-video.py for the options (crop, width, quality).
cd /d "%~dp0.."
where py >nul 2>nul && (py tools\web-video.py %*) || (python tools\web-video.py %*)
pause
