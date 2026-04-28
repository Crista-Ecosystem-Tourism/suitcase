#!/bin/bash
set -e

# Переходим в директорию скрипта (корень проекта)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Не переносим macOS xattr/resource fork в bundle (иначе codesign падает).
export COPYFILE_DISABLE=1

if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей (node_modules не найден)..."
    npm install --legacy-peer-deps
fi

if [ ! -d "node_modules/expo" ]; then
    echo "📦 Пакет expo не найден. Устанавливаю..."
    npm install expo --legacy-peer-deps
fi

# Удаление дубликатов папок от iCloud (фикс проблемы с ".expo 2")
rm -rf ".expo 2" "node_modules 2" "ios/Pods 2" || true

VERSIONS_DIR="versions/ios_versions"
mkdir -p "$VERSIONS_DIR"

# Находим последний номер версии
LATEST_VERSION_FILE=$(ls -1 "$VERSIONS_DIR"/suitcase_v*.tar.gz 2>/dev/null | sort -V | tail -n 1)

if [ -z "$LATEST_VERSION_FILE" ]; then
    NEXT_VERSION=1
else
    LATEST_VERSION=$(basename "$LATEST_VERSION_FILE" | sed -n 's/.*_v\([0-9]*\)\.tar\.gz/\1/p')
    NEXT_VERSION=$((LATEST_VERSION + 1))
fi

APP_NAME="suitcase_v${NEXT_VERSION}"
echo "🚀 Подготовка к сборке iOS: $APP_NAME"

# Всегда синхронизируем нативный iOS проект с app.json/package.json.
echo "📦 Синхронизация iOS проекта (expo prebuild)..."
npx expo prebuild --platform ios

echo "🏗 Компиляция Release сборки iOS (xcodebuild)..."
cd ios

# Чистим прошлые derived артефакты ДО pod install
rm -rf build

# Всегда обновляем pods/codegen после prebuild
pod install

# Xattr чистка перед сборкой
xattr -cr "$PROJECT_DIR/ios" 2>/dev/null || true

BUILT_APP="build/Build/Products/Release-iphonesimulator/greensuitcase.app"
ENTITLEMENTS="build/Build/Intermediates.noindex/greensuitcase.build/Release-iphonesimulator/greensuitcase.build/greensuitcase.app.xcent"

# Собираем приложение. Позволяем упасть на CodeSign (iCloud xattr проблема),
# потом чиним вручную.
set +e
xcodebuild \
  -workspace greensuitcase.xcworkspace \
  -scheme greensuitcase \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath build \
  build 2>&1
BUILD_EXIT=$?
set -e

if [ $BUILD_EXIT -ne 0 ]; then
    if [ -d "$BUILT_APP" ]; then
        echo "⚠️  xcodebuild упал (скорее всего CodeSign + xattr). Исправляем вручную..."
        # Пересобираем app-каталог без xattr/resource fork (на iCloud Desktop это критично)
        CLEAN_APP="${BUILT_APP}.clean"
        rm -rf "$CLEAN_APP"
        /usr/bin/ditto --noextattr --norsrc "$BUILT_APP" "$CLEAN_APP"
        rm -rf "$BUILT_APP"
        mv "$CLEAN_APP" "$BUILT_APP"
        # Дополнительно удаляем потенциальные остатки FinderInfo/ResourceFork
        xattr -cr "$BUILT_APP" 2>/dev/null || true
        xattr -dr com.apple.FinderInfo "$BUILT_APP" 2>/dev/null || true
        xattr -dr com.apple.ResourceFork "$BUILT_APP" 2>/dev/null || true
        # Подписываем ad-hoc для симулятора
        if [ -f "$ENTITLEMENTS" ]; then
            /usr/bin/codesign --force --sign - --entitlements "$ENTITLEMENTS" --timestamp=none --generate-entitlement-der "$BUILT_APP"
        else
            /usr/bin/codesign --force --sign - "$BUILT_APP"
        fi
        echo "✅ Ручная подпись прошла успешно."
    else
        echo "❌ Сборка упала до создания .app. Лог выше."
        exit 1
    fi
fi

cd ..

BUILT_APP="ios/build/Build/Products/Release-iphonesimulator/greensuitcase.app"

if [ -d "$BUILT_APP" ]; then
    tar -czf "$VERSIONS_DIR/${APP_NAME}.tar.gz" -C "$(dirname "$BUILT_APP")" "$(basename "$BUILT_APP")"
    
    echo "✅ Успешно! Новая сборка iOS (для симулятора) сохранена в: $VERSIONS_DIR/${APP_NAME}.tar.gz"
    
    echo "📲 Установка на запущенный iOS симулятор..."
    if command -v xcrun &> /dev/null; then
        # Автозапуск только если симулятор сейчас не запущен (нет booted устройства).
        HAS_BOOTED_DEVICE=0
        if xcrun simctl list devices booted | awk '/Booted/{found=1} END{exit !found}'; then
            HAS_BOOTED_DEVICE=1
        fi

        if [ "$HAS_BOOTED_DEVICE" -eq 0 ]; then
            echo "▶️ Симулятор не запущен. Запускаю..."
            DEVICE_UDID=$(xcrun simctl list devices available | awk -F '[()]' '/iPhone/ && /Shutdown/ {print $2; exit}')
            if [ -n "$DEVICE_UDID" ]; then
                open -a Simulator
                xcrun simctl boot "$DEVICE_UDID" || true
                xcrun simctl bootstatus "$DEVICE_UDID" -b || true
            else
                echo "⚠️ Не найдено доступных iPhone симуляторов."
            fi
        else
            echo "✅ Симулятор уже запущен. Автозапуск не требуется."
        fi
        echo "🗑 Удаление старой версии..."
        xcrun simctl uninstall booted Green-suitcase || true
        xcrun simctl install booted "$BUILT_APP" || echo "⚠️ Не удалось установить приложение. Убедитесь, что iOS симулятор запущен."
    else
        echo "⚠️ Утилита xcrun не найдена. Пропуск автоматической установки."
    fi
    
    echo "🧹 Очистка..."
    rm -rf dist ios/build
    echo "✨ Готово. Папка ios сохранена для быстрой сборки в следующий раз."
else
    echo "❌ Ошибка: iOS сборка (.app) не найдена в $BUILT_APP"
    exit 1
fi
