@echo off
git add apps/ENG-Frontend/src/components/engineer/newprod_eng/TemplateTool/forms/
if %errorlevel% neq 0 exit /b %errorlevel%
git commit -m "fix(frontend): remove grey background on print for all templates"
if %errorlevel% neq 0 exit /b %errorlevel%
git push origin pm
if %errorlevel% neq 0 exit /b %errorlevel%
git checkout mtc
if %errorlevel% neq 0 exit /b %errorlevel%
git pull origin mtc
if %errorlevel% neq 0 exit /b %errorlevel%
git checkout dev
if %errorlevel% neq 0 exit /b %errorlevel%
git pull origin dev
if %errorlevel% neq 0 exit /b %errorlevel%
git merge mtc -m "Merge branch 'mtc' into dev"
if %errorlevel% neq 0 exit /b %errorlevel%
git merge pm -m "Merge branch 'pm' into dev"
if %errorlevel% neq 0 exit /b %errorlevel%
git push origin dev
if %errorlevel% neq 0 exit /b %errorlevel%
git checkout main
if %errorlevel% neq 0 exit /b %errorlevel%
git pull origin main
if %errorlevel% neq 0 exit /b %errorlevel%
git merge dev -m "Merge branch 'dev' into main"
if %errorlevel% neq 0 exit /b %errorlevel%
git push origin main
if %errorlevel% neq 0 exit /b %errorlevel%
echo All done successfully!
