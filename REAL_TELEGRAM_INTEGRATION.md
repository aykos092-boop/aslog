# 🤖 Реальная интеграция с Telegram ботом

## 📋 Что нужно для реальной работы:

### **1. Деплой Telegram функции:**
```bash
supabase functions deploy telegram-bot
```

### **2. ENV переменные:**
```bash
TELEGRAM_BOT_TOKEN=8361698849:AAFl19mQYwVeUG3V0QghljXiKEz--7_Eyj8
```

### **3. Webhook для бота:**
```bash
curl.exe -X POST "https://api.telegram.org/bot8361698849:AAFl19mQYwVeUG3V0QghljXiKEz--7_Eyj8/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://eqrzodfukdnwsogjzmoz.supabase.co/functions/v1/telegram-bot/webhook"
  }'
```

## 🎯 Как будет работать:

### **Сейчас (Mock):**
- Код генерируется локально
- Показывается в консоли для тестирования
- Пользователь должен открыть консоль чтобы увидеть код

### **После деплоя (Реально):**
- Пользователь вводит номер на сайте
- Открывает Telegram @asloguzbot
- Бот отправляет УНИКАЛЬНЫЙ код в чат
- Пользователь видит код в Telegram
- Вводит код на сайте (3 попытки)
- ✅ Успешная регистрация

## 📱 Реальный сценарий:

### **Шаг 1: Пользователь на сайте**
```
1. Выбирает роль: Клиент/Перевозчик
2. Вводит номер: +998901234567
3. Нажимает "Продолжить"
4. Видит: "Откройте Telegram @asloguzbot"
```

### **Шаг 2: Telegram бот**
```
1. Пользователь открывает: t.me/asloguzbot?start=UUID
2. Бот обрабатывает /start UUID
3. Бот генерирует УНИКАЛЬНЫЙ код: 28473
4. Бот отправляет сообщение:
   "🔐 Код подтверждения"
   "Ваш уникальный код: 28473"
   "Код действителен 5 минут"
```

### **Шаг 3: Проверка на сайте**
```
1. Пользователь возвращается на сайт
2. Вводит код: 28473
3. Система проверяет (3 попытки)
4. ✅ Успешная регистрация!
```

## 🔧 Что нужно исправить в коде:

### **1. Заменить mock на реальные API вызовы:**
```typescript
// Было (mock):
await sendCodeToTelegram(phone, uniqueCode);

// Станет (реально):
const response = await fetch(`${TELEGRAM_API_BASE}/send-code`, {
  method: 'POST',
  body: JSON.stringify({ phone, code: uniqueCode })
});
```

### **2. Убрать localStorage хранение:**
```typescript
// Было (localStorage):
localStorage.setItem('mock_session', JSON.stringify(...));

// Станет (база данных):
await supabase.from('telegram_sessions').insert({...});
```

### **3. Реальная проверка кода:**
```typescript
// Было (localStorage):
const session = JSON.parse(localStorage.getItem('mock_session'));

// Станет (база данных):
const { data: session } = await supabase
  .from('telegram_sessions')
  .select('*')
  .eq('session_token', sessionToken);
```

## 🚀 Деплой инструкция:

### **1. SQL миграция:**
```sql
-- Выполнить в Supabase Dashboard
CREATE TABLE telegram_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  session_token UUID NOT NULL UNIQUE,
  unique_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### **2. Деплой функции:**
```bash
supabase functions deploy telegram-bot
```

### **3. Настройка бота:**
```bash
# Установить webhook
curl.exe -X POST "https://api.telegram.org/bot8361698849:AAFl19mQYwVeUG3V0QghljXiKEz--7_Eyj8/setWebhook" \
  -d '{"url": "https://eqrzodfukdnwsogjzmoz.supabase.co/functions/v1/telegram-bot/webhook"}'

# Проверить webhook
curl.exe -X GET "https://api.telegram.org/bot8361698849:AAFl19mQYwVeUG3V0QghljXiKEz--7_Eyj8/getWebhookInfo"
```

## 🎉 Результат после деплоя:

- ✅ **Реальная отправка кодов** в Telegram
- ✅ **Уникальные коды** для каждой сессии
- ✅ **3 попытки** ввода
- ✅ **Безопасность** - коды не видны на сайте
- ✅ **Полная интеграция** с @asloguzbot

**Сейчас работает в mock режиме для тестирования. После деплоя будет работать с реальным Telegram ботом!** 🚀
