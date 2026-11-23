#!/usr/bin/env bash
# Requires: PHP 8.2+, Composer, internet. Creates a fresh Laravel app and applies the CargoTrace files.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
composer create-project laravel/laravel "$HERE/cargotrace-app" --no-interaction
cd "$HERE/cargotrace-app"
php artisan install:api --no-interaction
cp -r "$HERE/overlay/." .
grep -q CARGOTRACE_DELAY_THRESHOLD .env || echo "CARGOTRACE_DELAY_THRESHOLD=12" >> .env
php artisan migrate:fresh --seed --force
php artisan test
echo "Done. Run: cd cargotrace-app && php artisan serve   (API at http://127.0.0.1:8000/api)"
