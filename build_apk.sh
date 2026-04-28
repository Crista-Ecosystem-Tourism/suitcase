#!/bin/bash
set -e

# Экспорт JAVA_HOME для Gradle (если Java установлена через Homebrew)
if [ -x "$(command -v brew)" ]; then
    export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
fi

# Экспорт ANDROID_HOME, если не установлен
if [ -z "$ANDROID_HOME" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
fi

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

VERSIONS_DIR="versions/android_versions"
mkdir -p "$VERSIONS_DIR"

# Находим последний номер версии
LATEST_VERSION_FILE=$(ls -1 "$VERSIONS_DIR"/suitcase_v*.apk 2>/dev/null | sort -V | tail -n 1)

if [ -z "$LATEST_VERSION_FILE" ]; then
    NEXT_VERSION=1
else
    # Извлекаем цифру из названия, например suitcase_v5.apk -> 5
    LATEST_VERSION=$(basename "$LATEST_VERSION_FILE" | sed -n 's/.*_v\([0-9]*\)\.apk/\1/p')
    NEXT_VERSION=$((LATEST_VERSION + 1))
fi

APK_NAME="suitcase_v${NEXT_VERSION}.apk"
echo "🚀 Подготовка к сборке APK: $APK_NAME"

# Всегда синхронизируем нативный Android проект с app.json/package.json,
# чтобы избегать рассинхрона Gradle/плагинов после изменений конфигурации.
echo "📦 Синхронизация Android проекта (expo prebuild)..."
CI=1 npx expo prebuild --platform android

echo "🏗 Компиляция Release APK с помощью Gradle..."
cd android
./gradlew clean assembleRelease
cd ..

BUILT_APK="android/app/build/outputs/apk/release/app-release.apk"

if [ -f "$BUILT_APK" ]; then
    cp "$BUILT_APK" "$VERSIONS_DIR/$APK_NAME"
    echo "✅ Успешно! Новый APK файл сохранен в: $VERSIONS_DIR/$APK_NAME"
    
    echo "📲 Установка APK на запущенный эмулятор (или подключенное устройство)..."
    if command -v adb &> /dev/null; then
        echo "🗑 Удаление старой версии..."
        adb uninstall greensuitcase.com || true
        adb install -r "$VERSIONS_DIR/$APK_NAME" || echo "⚠️ Не удалось установить APK. Убедитесь, что эмулятор запущен."
    elif [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
        "$HOME/Library/Android/sdk/platform-tools/adb" install -r "$VERSIONS_DIR/$APK_NAME" || echo "⚠️ Не удалось установить APK. Убедитесь, что эмулятор запущен."
    else
        echo "⚠️ Утилита adb не найдена. Пропуск автоматической установки."
    fi
    
    echo "🧹 Очистка..."
    # Мы больше не удаляем папку android, чтобы работал кэш сборки (Incremental Build)!
    # Это ускорит следующую сборку с 8 минут до 30 секунд.
    rm -rf dist
    echo "✨ Готово. Папка android сохранена для быстрой сборки в следующий раз."
else
    echo "❌ Ошибка: APK файл не найден ($BUILT_APK)"
    exit 1
fi
