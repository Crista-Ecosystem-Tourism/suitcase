#!/bin/bash
set -e

# ============================================
# 🌐 Скрипт деплоя веб-версии на Firebase Hosting
# ============================================

# Переходим в директорию скрипта (корень проекта)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🌐 Деплой веб-версии Green Suitcase на Firebase Hosting"
echo "========================================================="

# 1. Проверяем наличие Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "⚠️  Firebase CLI не найден. Устанавливаю..."
    npm install -g firebase-tools
fi

# 2. Проверяем авторизацию Firebase
echo "🔐 Проверяю авторизацию Firebase..."
if ! firebase projects:list &> /dev/null; then
    echo "🔑 Требуется вход в Firebase. Запускаю авторизацию..."
    firebase login
fi

# 3. Экспортируем веб-бандл через Expo
echo "📦 Экспорт веб-бандла через Expo..."
pnpm expo export --platform web

# 4. Деплоим на Firebase Hosting
echo "🚀 Деплою на Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅ Готово! Веб-версия обновлена."
echo "🌍 Сайт доступен по адресу: https://green-suitcase.web.app"
echo ""
