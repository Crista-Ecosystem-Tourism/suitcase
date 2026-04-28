# Suitcase (Crista)

Мобильное приложение экосистемы **Crista** на **Expo** (React Native) и отдельный backend-сервис Suitcase: поездки, карта, цели, архив, расходы, единая авторизация Crista через PostgreSQL + JWT.

Репозиторий: [github.com/Crista-Ecosystem-Tourism/suitcase](https://github.com/Crista-Ecosystem-Tourism/suitcase)

## Стек

- **Expo SDK ~52**, **React Native 0.76**, **expo-router** (файловый роутинг в `app/`)
- Карты: **react-native-maps**
- Backend: **FastAPI**, **SQLAlchemy async**, **Alembic**, общая PostgreSQL экосистемы Crista.

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
├── backend/               # отдельный FastAPI-сервис и Docker-контейнер Suitcase
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

- `EXPO_PUBLIC_API_URL` задаёт URL backend Suitcase для мобильного приложения. По умолчанию: `https://api.crista.online/suitcase-api`.
- `backend/` использует общую PostgreSQL через `DATABASE_URL` или `POSTGRES_*`, а также общий `JWT_SECRET`.

## Связь с backend Crista

Мобильное приложение и веб-раздел «Мой чемодан» работают с отдельным сервисом Suitcase (`/suitcase-api/*`). Пользователи остаются едиными для Crista: таблица `app_user` и `JWT_SECRET` общие с основным backend.

Организация: [Crista Ecosystem Tourism на GitHub](https://github.com/Crista-Ecosystem-Tourism).
