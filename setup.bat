@echo off
REM Requires PHP 8.2+, Composer, internet (XAMPP users: add php and composer to PATH)
call composer create-project laravel/laravel cargotrace-app --no-interaction || exit /b 1
cd cargotrace-app
call php artisan install:api --no-interaction
xcopy /E /Y /I ..\overlay\* . >nul
echo CARGOTRACE_DELAY_THRESHOLD=12>> .env
call php artisan migrate:fresh --seed --force
call php artisan test
echo Done. Run: php artisan serve
