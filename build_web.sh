#!/bin/bash
set -e

# ============================================
# 🌐 Скрипт деплоя веб-версии на Firebase Hosting
# ============================================

# Переходим в директорию скрипта (корень проекта)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей (node_modules не найден)..."
    npm install --legacy-peer-deps
fi

if [ ! -d "node_modules/expo" ]; then
    echo "📦 Пакет expo не найден. Устанавливаю..."
    npm install expo --legacy-peer-deps
fi

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

WEB_VERSIONS_DIR="versions/web_versions"
mkdir -p "$WEB_VERSIONS_DIR"

# Находим последний номер версии
LATEST_VERSION_DIR=$(ls -1d "$WEB_VERSIONS_DIR"/v* 2>/dev/null | sort -V | tail -n 1)

if [ -z "$LATEST_VERSION_DIR" ]; then
    NEXT_VERSION=1
else
    # Извлекаем цифру из названия папки: v5 -> 5
    LATEST_VERSION=$(basename "$LATEST_VERSION_DIR" | sed -n 's/v\([0-9]*\)/\1/p')
    NEXT_VERSION=$((LATEST_VERSION + 1))
fi

CURRENT_VERSION_DIR="$WEB_VERSIONS_DIR/v${NEXT_VERSION}"
mkdir -p "$CURRENT_VERSION_DIR"

# 3. Экспортируем веб-бандл через Expo
echo "📦 Экспорт веб-бандла v${NEXT_VERSION} через Expo..."
rm -rf dist
npx expo export --platform web

echo "📂 Сохранение Web-версии в $CURRENT_VERSION_DIR/dist..."
cp -R dist "$CURRENT_VERSION_DIR/dist"

# 4. Деплоим на Firebase Hosting
echo "🚀 Деплою на Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅ Готово! Веб-версия обновлена."
echo "🌍 Сайт доступен по адресу: https://green-suitcase.web.app"
echo ""
