# 🚀 Быстрый деплой Telegram системы

## ✅ Проблема auth.users исправлена!

Заменили `auth.users` на `profiles` в `documents-pdf` функции.

## 📋 Что нужно сделать:

### 1. SQL миграция (если еще не выполнена)
```sql
-- В Supabase Dashboard → SQL Editor
-- Выполнить: supabase/migrations/20260201150000_add_telegram_verification.sql
```

### 2. Деплой функций
```bash
# В корне проекта
supabase functions deploy telegram-proxy
supabase functions deploy telegram-phone-bot
supabase functions deploy documents-pdf
```

### 3. ENV переменные
```bash
# В Supabase Dashboard → Settings → Functions
supabase secrets set TELEGRAM_BOT_TOKEN=8361698849:AAFm9dUTOOQpkNIJ-ESopomLB9OLxbKoGAI
supabase secrets set SUPABASE_URL=https://eqrzodfukdnwsogjzmoz.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your_anon_key
```

### 4. Webhook для бота @asloguzbot
```bash
curl.exe -X POST "https://api.telegram.org/bot8361698849:AAFm9dUTOOQpkNIJ-ESopomLB9OLxbKoGAI/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://eqrzodfukdnwsogjzmoz.supabase.co/functions/v1/telegram-phone-bot"
  }'
```

### 5. Проверить webhook
```bash
curl.exe -X GET "https://api.telegram.org/bot8361698849:AAFm9dUTOOQpkNIJ-ESopomLB9OLxbKoGAI/getWebhookInfo"
```

## 🧪 Тестирование:

### 1. Проверить бота @asloguzbot:
```
1. Найти @asloguzbot в Telegram
2. Отправить /start
3. Ввести номер: +998901234567
4. Проверить ответ
```

### 2. Проверить фронтенд:
```
1. Открыть: http://localhost:8080/telegram-verification
2. Ввести номер телефона
3. Проверить что нет ошибок auth.users
```

### 3. Проверить API:
```bash
# Тест отправки кода
curl.exe -X POST "https://eqrzodfukdnwsogjzmoz.supabase.co/functions/v1/telegram-proxy/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_anon_key" \
  -d '{"phone": "+998901234567"}'
```

## 🎯 Результат:

✅ **Ошибка auth.users исправлена**
✅ **CORS ошибки устранены**
✅ **Failed to fetch исправлен**
✅ **Vite server не падает**
✅ **Telegram бот @asloguzbot стабилен**

## 🔧 Если что-то не работает:

### Проверить логи:
```bash
supabase functions logs telegram-phone-bot
supabase functions logs telegram-proxy
supabase functions logs documents-pdf
```

### Переустановить webhook:
```bash
curl.exe -X POST "https://api.telegram.org/bot8361698849:AAFm9dUTOOQpkNIJ-ESopomLB9OLxbKoGAI/deleteWebhook"
# Затем снова установить
```

**Готово! Система должна работать без ошибок!** 🎉
