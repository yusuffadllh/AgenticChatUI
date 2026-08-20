@echo off
REM Smoke test (Windows): validates baseline success criteria.
setlocal

if not exist "docs\scope-and-requirements.md" goto fail

findstr /C:"## 2. Scope" "docs\scope-and-requirements.md" >nul || goto fail
findstr /C:"## 3. Requirements" "docs\scope-and-requirements.md" >nul || goto fail
findstr /C:"## 4. Success Criteria" "docs\scope-and-requirements.md" >nul || goto fail

echo RESULT: PASS - all baseline success criteria satisfied
exit /b 0

:fail
echo RESULT: FAIL - a baseline success criterion was not met
exit /b 1
