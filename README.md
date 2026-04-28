# Suitcase (Crista)

Мобильное приложение экосистемы **Crista** на **Expo** (React Native): поездки, карта, цели, архив, расходы, локальное хранилище (SQLite через Expo), авторизация (Firebase / Google Sign-In).

Репозиторий: [github.com/Crista-Ecosystem-Tourism/suitcase](https://github.com/Crista-Ecosystem-Tourism/suitcase)

## Стек

- **Expo SDK ~52**, **React Native 0.76**, **expo-router** (файловый роутинг в `app/`)
- Карты: **react-native-maps**
- Firebase, Google Sign-In — см. `app.json` / `google-services.json` / `GoogleService-Info.plist` (не коммить секреты в публичные репозитории без необходимости)

## Структура

```
suitcase/
├── app/
│   ├── (tabs)/           # нижние вкладки: главная, карта, мир, цели, архив, профиль, add
│   ├── trip/             # создание/просмотр/редактирование поездок
│   ├── expense/          # расходы
│   ├── login.tsx
│   └── _layout.tsx
├── assets/
├── app.json              # конфиг Expo (схема, иконки, нативные ключи карт)
├── package.json
└── ...
```

## Запуск

Требования: **Node.js**, **npm** или **pnpm**, для iOS — Xcode, для Android — Android Studio / SDK.

```bash
git clone git@github.com:Crista-Ecosystem-Tourism/suitcase.git
cd suitcase
npm install
npm start
```

Далее в терминале Expo: **`i`** (iOS), **`a`** (Android), **`w`** (web при поддержке).

Сборка нативных проектов (при необходимости):

```bash
npm run android
npm run ios
```

## Переменные и секреты

- Конфигурация Firebase и ключей карт задаётся в **`app.json`** и нативных файлах — перед публикацией проверьте, что секреты не утекли в git.
- Для продакшена используйте **EAS Secrets** / переменные окружения по документации Expo.

## Связь с backend Crista

Приложение может работать автономно или позже связываться с **AI Agent** / REST API — уточните базовый URL в коде клиента, когда интеграция будет готова.

Организация: [Crista Ecosystem Tourism на GitHub](https://github.com/Crista-Ecosystem-Tourism).
