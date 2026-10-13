@echo off
setlocal
cd /d "%~dp0"

rem ============================================================
rem  Apiapia release packer (ASCII-only, JP Windows safe)
rem  Usage: double-click or run: build_release.bat
rem  Output: dist\apiapia-release.zip (fixed name, no version)
rem  Includes real .env from project root.
rem
rem  VERSION HANDLING
rem  The VERSION file at the repo root is the single source of truth for the
rem  release version. This script reads it, injects it into the generated
rem  .env.example, and then VERIFIES that every other file carrying a version
rem  number agrees with it.
rem
rem  The verification exists because drift happened silently before: the backend
rem  hardcoded 2.9.0 in two places while the frontend and VERSION were already on
rem  v2.12.0, and v2.12.0's own changelog claimed the version had been "unified
rem  across five sources" - which was not true of the backend. Nothing failed; the
rem  only symptom was a stale version in /docs and a dead update prompt. A
rem  release packer is the last place that can still catch this.
rem
rem  To cut a release: change VERSION, then update the files the error lists.
rem ============================================================

set "DIST=dist"
set "STAGE=%DIST%\stage\apiapia-release"
set "ZIP=%DIST%\apiapia-release.zip"

echo [1/7] reading version from VERSION...
call :read_version
if errorlevel 1 goto err_version

echo [2/7] verifying version consistency across the repo...
call :chk README.md
call :chk frontend\package.json
call :chk frontend\public\version.json
if defined DRIFT goto err_drift
echo        core release sources agree on %APPVER%

echo [3/7] output : %ZIP%

if not exist docker-compose.yml goto err_nocompose
if not exist backend\Dockerfile goto err_backend
if not exist frontend\Dockerfile goto err_frontend
goto do_clean

:err_nocompose
echo [ERROR] docker-compose.yml not found. Run in project root.
pause
exit /b 1

:err_backend
echo [ERROR] backend\Dockerfile not found.
pause
exit /b 1

:err_frontend
echo [ERROR] frontend\Dockerfile not found.
pause
exit /b 1

rem ------------------------------------------------------------
rem Read the release version out of the VERSION file into %APPVER%
rem (bare semver, leading "v" stripped). ASCII-only on purpose.
rem
rem "set /p" rather than "for /f": for /f keeps a trailing CR when the
rem file has CRLF endings, and a stray CR would then be carried into
rem every findstr comparison below - all six would report drift for a
rem file that is in fact correct. set /p stops at the line break and
rem drops it.
rem
rem Each call re-parses the subroutine body, so the plain %DRIFT% /
rem %APPVER% expansions see what previous calls wrote. That is why
rem delayed expansion is not needed here.
rem ------------------------------------------------------------
:read_version
set "APPVER="
if not exist VERSION (
    echo [ERROR] VERSION file not found at the repo root.
    exit /b 1
)
set /p APPVER=<VERSION
if not defined APPVER (
    echo [ERROR] VERSION file is empty.
    exit /b 1
)
if /i "%APPVER:~0,1%"=="v" set "APPVER=%APPVER:~1%"
if not defined APPVER (
    echo [ERROR] VERSION file holds no version number.
    exit /b 1
)
echo        VERSION says : v%APPVER%
exit /b 0

rem ------------------------------------------------------------
rem :chk <file> - append the path to %DRIFT% when it does not mention
rem the current version. Checks presence only, not validity: the
rem failure mode worth catching is a file that was simply forgotten,
rem which is exactly how 2.9.0 survived three releases.
rem ------------------------------------------------------------
:chk
findstr /c:"%APPVER%" "%~1" >nul 2>&1
if errorlevel 1 set "DRIFT=%DRIFT% %~1"
exit /b 0

:err_version
echo.
pause
exit /b 1

:err_drift
echo.
echo [ERROR] Version drift. VERSION says v%APPVER%, but these files do not
echo         mention it:
for %%F in (%DRIFT%) do echo             %%F
echo.
echo   README.md                     badge + changelog heading
echo   frontend\package.json         version
echo   frontend\public\version.json  version + buildTime + changelog
echo.
echo Bump VERSION first, then update the release files listed above.
echo Packaging aborted so a mismatched build cannot ship.
pause
exit /b 1

:do_clean
echo [4/7] cleaning stage...
if exist "%DIST%\stage" rmdir /s /q "%DIST%\stage"
if exist "%ZIP%" del /f /q "%ZIP%"
mkdir "%STAGE%"

echo [5/7] copying files...
copy /y docker-compose.yml "%STAGE%\docker-compose.yml"
if errorlevel 1 goto err_copy
if exist README.md copy /y README.md "%STAGE%\README.md"
rem The localized READMEs ship too. README.md is English (the default for
rem open source) and README.zh-CN.md is the only one carrying the full
rem historical changelog, so both are required for the zip to be usable.
rem The remaining two are best-effort: a missing translation should not block
rem a release, whereas a missing README.md would.
for %%R in (README.zh-CN.md README.zh-TW.md README.ja.md) do if exist %%R copy /y %%R "%STAGE%\%%R"
if exist VERSION copy /y VERSION "%STAGE%\VERSION"
if exist apiapia_architecture_v2.md copy /y apiapia_architecture_v2.md "%STAGE%\apiapia_architecture_v2.md"
if exist .env copy /y .env "%STAGE%\.env"

rem gen_env_example copies the repo's .env.example when present and falls back to
rem a minimal generated list when it is not, so the check below is unconditional.
call :gen_env_example
if not exist "%STAGE%\.env.example" goto err_env

robocopy backend "%STAGE%\backend" /E /NJH /NJS /NDL /NFL /XD __pycache__ .pytest_cache .venv venv env ENV .idea .vscode data /XF *.pyc *.pyo *.pyd *.log *.sqlite *.sqlite3 *.db .env .env.local
if errorlevel 8 goto err_backend_copy

robocopy frontend "%STAGE%\frontend" /E /NJH /NJS /NDL /NFL /XD node_modules .next out build dist .idea .vscode /XF *.log .env .env.local .env.development.local .env.production.local
if errorlevel 8 goto err_frontend_copy

del /f /q "%STAGE%\backend\.env" 2>nul
del /f /q "%STAGE%\frontend\.env" 2>nul

echo [6/7] zipping...
powershell -NoProfile -NonInteractive -Command "Compress-Archive -Path '%STAGE%' -DestinationPath '%ZIP%' -Force"
if errorlevel 1 goto err_zip

rmdir /s /q "%DIST%\stage"

echo [7/7] done.
echo.
echo Output: %CD%\%ZIP%
for %%F in ("%ZIP%") do echo Size: %%~zF bytes
echo.
echo Next on server:
echo   1. unzip the zip (.env already included)
echo   2. docker compose up --build -d
echo   3. open http://server-ip:3000
echo.
endlocal
goto :eof

:gen_env_example
rem The repo's .env.example is the source of truth: it carries the per-variable
rem notes that matter at deploy time (which secrets can be rotated without
rem invalidating stored data, which knobs are user-owned rather than
rem deployment-owned). The fallback below exists only so a repo missing that
rem file still produces a runnable release, and it deliberately lists the
rem essentials rather than pretending to be the full reference.
set "ENVFILE=%STAGE%\.env.example"
if exist .env.example (
    copy /y .env.example "%ENVFILE%" >nul
    exit /b 0
)
echo # Apiapia deploy template > "%ENVFILE%"
echo # Usage: copy .env.example .env, then edit >> "%ENVFILE%"
echo # NOTE: .env.example was missing from the repo; this is the >> "%ENVFILE%"
echo #       essentials-only fallback, not the full reference. >> "%ENVFILE%"
echo. >> "%ENVFILE%"
echo POSTGRES_USER=postgres >> "%ENVFILE%"
echo POSTGRES_PASSWORD=change-me-in-production >> "%ENVFILE%"
echo POSTGRES_DB=apiapia >> "%ENVFILE%"
echo POSTGRES_HOST=postgres >> "%ENVFILE%"
echo POSTGRES_PORT=5432 >> "%ENVFILE%"
echo. >> "%ENVFILE%"
echo SECRET_KEY=change-this-to-a-super-secret-jwt-key-min-32-chars-long >> "%ENVFILE%"
echo API_KEY_ENCRYPTION_KEY=dGhpc2lzYTMyeWVhcnNvbGRzZWNyZXRrZXkxMjM0NTY= >> "%ENVFILE%"
echo. >> "%ENVFILE%"
echo DEFAULT_MODEL=gpt-4o-mini >> "%ENVFILE%"
echo DEFAULT_PROVIDER=openai >> "%ENVFILE%"
echo. >> "%ENVFILE%"
echo OPENAI_API_KEY= >> "%ENVFILE%"
echo OPENAI_BASE_URL=https://api.openai.com/v1 >> "%ENVFILE%"
echo OPENROUTER_API_KEY= >> "%ENVFILE%"
echo OPENROUTER_BASE_URL=https://openrouter.ai/api/v1 >> "%ENVFILE%"
echo ANTHROPIC_API_KEY= >> "%ENVFILE%"
echo ANTHROPIC_BASE_URL=https://api.anthropic.com >> "%ENVFILE%"
echo GEMINI_API_KEY= >> "%ENVFILE%"
echo OLLAMA_BASE_URL= >> "%ENVFILE%"
echo. >> "%ENVFILE%"
echo TAVILY_API_KEY= >> "%ENVFILE%"
echo TAVILY_SEARCH_DEPTH=advanced >> "%ENVFILE%"
echo TAVILY_INCLUDE_ANSWER=True >> "%ENVFILE%"
exit /b 0

:err_copy
echo [ERROR] copy root files failed.
pause
exit /b 1

:err_env
echo [ERROR] .env.example missing and generation failed.
pause
exit /b 1

:err_backend_copy
echo [ERROR] backend copy failed.
pause
exit /b 1

:err_frontend_copy
echo [ERROR] frontend copy failed.
pause
exit /b 1

:err_zip
echo [ERROR] zip failed. Check PowerShell is available.
pause
exit /b 1
