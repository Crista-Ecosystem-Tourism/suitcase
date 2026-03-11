#!/bin/bash
set -e

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

# Удаление дубликатов папок от iCloud (фикс проблемы с ".expo 2")
rm -rf ".expo 2" "node_modules 2" || true

VERSIONS_DIR="versions/ios_versions"
mkdir -p "$VERSIONS_DIR"

# Находим последний номер версии
LATEST_VERSION_FILE=$(ls -1 "$VERSIONS_DIR"/green_suitcase_v*.tar.gz 2>/dev/null | sort -V | tail -n 1)

if [ -z "$LATEST_VERSION_FILE" ]; then
    NEXT_VERSION=1
else
    # Извлекаем цифру из названия, например green_suitcase_v5.tar.gz -> 5
    LATEST_VERSION=$(basename "$LATEST_VERSION_FILE" | sed -n 's/.*_v\([0-9]*\)\.tar\.gz/\1/p')
    NEXT_VERSION=$((LATEST_VERSION + 1))
fi

APP_NAME="green_suitcase_v${NEXT_VERSION}"
echo "🚀 Подготовка к сборке iOS: $APP_NAME"

# Проверяем, существует ли папка ios, если нет - создаем через prebuild
if [ ! -d "ios" ]; then
    echo "📦 Настройка нативного iOS проекта (prebuild)..."
    npx expo prebuild --platform ios --clean
fi

echo "🏗 Компиляция Release сборки iOS (xcodebuild)..."
cd ios
# Можем использовать Pod install
if [ ! -d "Pods" ]; then
    pod install
fi

# Собираем приложение для симулятора (и аппарата), используя Release конфигурацию
xcodebuild \
  -workspace greensuitcase.xcworkspace \
  -scheme greensuitcase \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED="NO" \
  CODE_SIGNING_REQUIRED="NO" \
  build

cd ..

BUILT_APP="ios/build/Build/Products/Release-iphonesimulator/greensuitcase.app"

if [ -d "$BUILT_APP" ]; then
    # Архивируем .app в tar.gz чтобы не потерять права на чтение/выполнение и структуру папок
    tar -czf "$VERSIONS_DIR/${APP_NAME}.tar.gz" -C "$(dirname "$BUILT_APP")" "$(basename "$BUILT_APP")"
    
    echo "✅ Успешно! Новая сборка iOS (для симулятора) сохранена в: $VERSIONS_DIR/${APP_NAME}.tar.gz"
    
    echo "📲 Установка на запущенный iOS симулятор..."
    if command -v xcrun &> /dev/null; then
        echo "🗑 Удаление старой версии..."
        xcrun simctl uninstall booted Green-suitcase || true
        xcrun simctl install booted "$BUILT_APP" || echo "⚠️ Не удалось установить приложение. Убедитесь, что iOS симулятор запущен."
    else
        echo "⚠️ Утилита xcrun не найдена. Пропуск автоматической установки."
    fi
    
    echo "🧹 Очистка..."
    # Не удаляем папку ios полностью для инкрементальной сборки
    rm -rf dist ios/build
    echo "✨ Готово. Папка ios сохранена для быстрой сборки в следующий раз."
else
    echo "❌ Ошибка: iOS сборка (.app) не найдена в $BUILT_APP"
    exit 1
fi
