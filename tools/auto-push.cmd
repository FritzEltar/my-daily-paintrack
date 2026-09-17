@echo off
REM Double-click this file. It keeps running and watches the images\ folder.
REM Whenever you add / remove a picture, or edit daily.json, it automatically:
REM     regenerate manifest + thumbnails  ->  git commit  ->  git push
REM Close this window (or press Ctrl+C) to stop it.
REM Want it to start automatically on boot? Double-click autostart.cmd.

chcp 65001 >nul
title My Daily Paintrack - Auto Sync

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo   Node.js not found.
    echo   Install it from https://nodejs.org/  then run this file again.
    echo.
    pause
    exit /b 1
)

node "%~dp0auto-push.mjs" %*
pause
