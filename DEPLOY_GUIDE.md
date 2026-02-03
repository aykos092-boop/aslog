# 🚀 Деплой Telegram системы - пошаговая инструкция

## 📋 Что нужно сделать:

### 1. SQL миграция (уже должна быть выполнена)
```sql
-- В Supabase Dashboard → SQL Editor
-- Выполнить: supabase/migrations/20260201150000_add_telegram_verification.sql
```

### 2. Проверить CLI
```bash
# Проверить что Supabase CLI установлен
supabase --version

# Если нет - установить:
# npm install -g supabase
```

### 3. Авторизоваться в Supabase
```bash
# В корне проекта
supabase login
# Ввести email и пароль от Supabase
```

### 4. Проверить проект
```bash
# Убедиться что правильный проект
supabase projects list

# Если нужно переключиться:
supabase link --project-ref eqrzodfukdnwsogjzmoz
```

### 5. Деплой функций
```bash
# Деплой telegram-proxy
supabase functions deploy telegram-proxy

# Деплой telegram-phone-bot  
supabase functions deploy telegram-phone-bot

# Проверить что функции задеплоены
supabase functions list
```

### 6. Добавить ENV переменные

#### Для telegram-proxy:
```bash
# В Supabase Dashboard → Settings → Functions
# Или через CLI:
supabase secrets set SUPABASE_URL=https://eqrzodfukdnwsogjzmoz.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here
```

#### Для telegram-phone-bot:
```bash
supabase secrets set TELEGRAM_BOT_TOKEN=8361698849:AAFm9dUTOOQpkNIJ-ESopomLB9OLxbKoGAI
supabase secrets set SUPABASE_URL=https://eqrzodfukdnwsogjzmoz.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here
```

### 7. Настроить webhook для Telegram бота
```bash
# Установить webhook
curl -X POST "https://api.telegram.org/bot8361698849:AAFm9dUTOOQpkNIJ-ESopomLB9OLxbKoGAI/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://eqrzodfukdnwsogjzmoz.supabase.co/functions/v1/telegram-phone-bot"
  }'

# Проверить webhook
curl -X GET "https://api.telegram.org/bot8361698849:AAFm9dUTOOQpkNIJ-ESopomLB9OLxbKoGAI/getWebhookInfo"
```

## 🔧 Если что-то не работает:

### Проверить логи функций:
```bash
# Логи telegram-proxy
supabase functions logs telegram-proxy

# Логи telegram-phone-bot
supabase functions logs telegram-phone-bot

# Логи в реальном времени
supabase functions logs telegram-phone-bot --follow
```

### Проверить статус функций:
```bash
# Список всех функций
supabase functions list

# Детальная информация
supabase functions serve telegram-proxy --no-verify-jwt
```

### Переустановить функцию:
```bash
# Удалить и заново задеплоить
supabase functions delete telegram-proxy
supabase functions deploy telegram-proxy
```

## 📱 Тестирование:

### 1. Проверить API эндпоинты:
```bash
# Тест отправки кода
curl -X POST "https://eqrzodfukdnwsogjzmoz.supabase.co/functions/v1/telegram-proxy/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_anon_key" \
  -d '{"phone": "+998901234567"}'
```

### 2. Проверить Telegram бота:
```
1. Найти @asloguzbot в Telegram
2. Отправить /start
3. Ввести номер телефона
4. Проверить ответы
```

### 3. Проверить фронтенд:
```
1. Открыть http://localhost:8080/telegram-verification
2. Ввести номер телефона
3. Проверить что нет CORS ошибок
```

## 🎯 Готово!

После выполнения этих шагов:

✅ **CORS ошибки устранены**
✅ **Failed to fetch исправлен**  
✅ **Vite server не падает**
✅ **Service Worker работает**
✅ **Telegram бот стабилен**

## 📞 Если нужна помощь:

1. **Проверьте логи** - там 90% проблем
2. **Убедитесь что ENV переменные установлены**
3. **Проверьте webhook статус**
4. **Протестируйте API напрямую**

**Система готова к продакшену!** 🚀
