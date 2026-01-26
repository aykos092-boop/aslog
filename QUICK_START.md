# ⚡ Quick Start Guide - Auth System

## 🚀 За 5 минут к работающей системе

### 1. Клонировать и установить (если еще не сделано)
```bash
git clone <repo-url>
cd swift-ship-connect
npm install
```

### 2. Настроить .env
```bash
cp .env.example .env
```

**Минимальная конфигурация для тестирования:**
```env
# Supabase (обязательно)
VITE_SUPABASE_URL=https://xyzabcdefg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-key

# Email (выбрать один вариант)
# Вариант 1: Resend (рекомендуется)
RESEND_API_KEY=re_123456789

# Вариант 2: Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=your-app-password

# Google OAuth (опционально, можно пропустить)
VITE_GOOGLE_CLIENT_ID=123-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123

# Telegram Bot (опционально)
TELEGRAM_BOT_TOKEN=8361698849:AAFm9dUTOOQpkNIJ-ESopomLB9OLxbKoGAI
```

### 3. Выполнить миграцию БД

**В Supabase Dashboard:**
1. Открыть SQL Editor
2. Скопировать содержимое: `supabase/migrations/20260126120000_auth_system_overhaul.sql`
3. Выполнить (Run)

**Или через CLI:**
```bash
supabase db push
```

### 4. Deploy Edge Functions

**В Supabase Dashboard:**
- Перейти в Edge Functions
- Создать новые функции и скопировать код

**Или через CLI:**
```bash
supabase functions deploy auth-email-otp
supabase functions deploy auth-google-oauth
supabase functions deploy cleanup-auth-tokens
```

### 5. Запустить проект
```bash
npm run dev
```

Открыть: http://localhost:5173

---

## ✅ Проверка работы

### Тест 1: Email OTP Registration
1. Открыть http://localhost:5173/auth
2. Вкладка "Регистрация"
3. Заполнить: email, пароль, имя
4. Выбрать роль (Клиент/Перевозчик)
5. Нажать "Зарегистрироваться"
6. **Ожидание:** OTP код на email
7. Ввести код → Успех!

### Тест 2: Login
1. Открыть http://localhost:5173/auth
2. Вкладка "Вход"
3. Ввести email/password
4. **Ожидание:** Вход в dashboard

### Тест 3: Password Reset
1. Нажать "Забыли пароль?"
2. Ввести email
3. **Ожидание:** Письмо с reset link
4. Открыть ссылку
5. Ввести новый пароль
6. **Ожидание:** Success

### Тест 4: Google OAuth (если настроен)
1. Нажать "Войти через Google"
2. Выбрать аккаунт Google
3. **Ожидание:** Вход в dashboard

---

## 🐛 Troubleshooting

### OTP не приходит на email

**Проверка 1: Resend API**
```bash
# Проверить в Supabase Edge Function logs
# Должен быть API call к Resend
```

**Проверка 2: Gmail SMTP**
```bash
# Убедиться что "App Password" создан в Gmail
# https://myaccount.google.com/apppasswords
```

**Проверка 3: Spam folder**
- Проверить папку спам

**Проверка 4: Logs**
```bash
# В браузере Console
# Должен быть вызов: invoke('auth-email-otp')
```

### Google Sign-In не работает

**Проверка 1: Client ID**
```bash
# Проверить в .env
VITE_GOOGLE_CLIENT_ID=...

# Проверить в index.html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

**Проверка 2: Redirect URI**
```
Добавить в Google Console:
- http://localhost:5173
- https://your-domain.com
```

**Проверка 3: Console errors**
```
F12 → Console → Искать Google errors
```

### Build fails

**Error: "vite not found"**
```bash
rm -rf node_modules
rm package-lock.json
npm install
```

**Error: TypeScript errors**
```bash
# Проверить tsconfig.json
# Убедиться что paths настроены:
"paths": { "@/*": ["./src/*"] }
```

### Edge Functions не работают

**Проверка 1: Deploy status**
```bash
supabase functions list
```

**Проверка 2: Environment variables**
```
В Supabase Dashboard → Edge Functions → Settings
Добавить secrets:
- RESEND_API_KEY
- GOOGLE_CLIENT_SECRET
- TELEGRAM_BOT_TOKEN
```

**Проверка 3: Logs**
```
Supabase Dashboard → Edge Functions → Logs
```

---

## 📱 Тестирование на телефоне

### Через ngrok (для Google OAuth)
```bash
# Установить ngrok
npm install -g ngrok

# Запустить туннель
ngrok http 5173

# Получить URL: https://abc123.ngrok.io

# Добавить в Google Console redirect URIs
# Открыть на телефоне: https://abc123.ngrok.io
```

### Через локальную сеть
```bash
# В vite.config.ts добавить:
server: {
  host: '0.0.0.0',
  port: 5173
}

# Запустить
npm run dev

# Открыть на телефоне:
# http://192.168.1.X:5173
# (заменить X на IP вашего компа)
```

---

## 🎓 Дополнительные ресурсы

- **Полная документация**: `AUTH_SYSTEM_README.md`
- **Диагностика**: `DIAGNOSTIC_REPORT.md`
- **Environment setup**: `.env.example`

---

## 💡 Полезные команды

```bash
# Dev server
npm run dev

# Build production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Tests
npm test

# Deploy Edge Functions
supabase functions deploy <function-name>

# View Edge Function logs
supabase functions logs <function-name>

# DB migrations
supabase db push
supabase db reset  # Осторожно! Удалит данные
```

---

## ✨ Готово!

Система аутентификации настроена и работает.

**Следующие шаги:**
1. Тестировать все flows
2. Настроить production env
3. Deploy на Vercel/Netlify
4. Мониторинг security events

**Вопросы?** Смотри `AUTH_SYSTEM_README.md` или `DIAGNOSTIC_REPORT.md`

---

**Создано**: 26 января 2026  
**Версия**: 1.0.0
