@echo off
setlocal
set "PLAYWRIGHT_BROWSERS_PATH=D:\Codex\playwright-cli\browsers"
set "PWTEST_DAEMON_SESSION_DIR=D:\Codex\playwright-cli\daemon"
set "LOCALAPPDATA=D:\Codex\playwright-cli\localappdata"
node "%~dp0..\scripts\pw.mjs" %*
