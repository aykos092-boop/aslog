# 🔐 AsiaLog Production Authentication System

## Обзор

Production-ready система аутентификации с поддержкой:
- ✅ Email регистрация с OTP кодом (5 минут)
- ✅ Google OAuth 2.0
- ✅ Телефон через Telegram Bot
- ✅ Восстановление пароля (Email + Telegram)
- ✅ Brute-force защита (rate limiting)
- ✅ Account lockout (10 минут после 5 неудачных попыток)
- ✅ Валидация пароля (8+ chars, uppercase, lowercase, number, special)
- ✅ Security events logging
- ✅ Session management

---

## 📋 Требования

### Backend Dependencies
- Supabase (PostgreSQL + Edge Functions)
- Redis (опционально для rate limiting)

### External Services
1. **Email**:
   - Resend (рекомендуется) или
   - SMTP (Gmail, SendGrid, etc.)

2. **Google OAuth**:
   - Google Cloud Console project
   - OAuth 2.0 credentials

3. **Telegram Bot**:
   - Bot Token от @BotFather
   - Webhook настроен (опционально)

---

## 🚀 Установка

### 1. Клонировать репозиторий
```bash
git clone <repo-url>
cd swift-ship-connect
npm install
```

### 2. Настроить переменные окружения
```bash
cp .env.example .env
```

Заполните `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

RESEND_API_KEY=re_your_api_key
TELEGRAM_BOT_TOKEN=8361698849:AAFm9dUTOOQpkNIJ-ESopomLB9OLxbKoGAI
```

### 3. Выполнить миграции БД
```bash
# В Supabase SQL Editor
supabase/migrations/20260126120000_auth_system_overhaul.sql
```

### 4. Deploy Edge Functions
```bash
supabase functions deploy auth-email-otp
supabase functions deploy auth-google-oauth
supabase functions deploy telegram-otp
supabase functions deploy password-reset
```

### 5. Настроить Google OAuth

1. Перейти на [Google Cloud Console](https://console.cloud.google.com/)
2. Создать проект или выбрать существующий
3. **APIs & Services → Credentials**
4. **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   ```
   http://localhost:5173
   https://your-domain.com
   ```
7. Скопировать Client ID и Client Secret в `.env`

### 6. Настроить Resend Email

1. Создать аккаунт на [Resend](https://resend.com/)
2. Верифицировать домен (например, `asialog.uz`)
3. Создать API key
4. Добавить в `.env`: `RESEND_API_KEY=re_...`

### 7. Настроить Telegram Bot

1. Найти [@BotFather](https://t.me/BotFather) в Telegram
2. Создать бота: `/newbot`
3. Скопировать токен
4. (Опционально) Настроить webhook:
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://your-project.supabase.co/functions/v1/telegram-webhook
```

### 8. Добавить Google Sign-In SDK

В `index.html`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────┐
│              Frontend (React)                    │
├─────────────────────────────────────────────────┤
│  Components:                                     │
│  - EmailOTPInput                                 │
│  - GoogleSignInButton                            │
│  - PhoneOTPVerification                          │
│  - PasswordResetForm                             │
│                                                  │
│  Services:                                       │
│  - authService.ts (centralized logic)            │
│                                                  │
│  Hooks:                                          │
│  - useAuth (context + state management)          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         Supabase Edge Functions                  │
├─────────────────────────────────────────────────┤
│  - auth-email-otp       (send/verify email)      │
│  - auth-google-oauth    (Google OAuth)           │
│  - telegram-otp         (phone via Telegram)     │
│  - password-reset       (forgot password)        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│              Database (PostgreSQL)               │
├─────────────────────────────────────────────────┤
│  Tables:                                         │
│  - email_otp_codes      (OTP storage)            │
│  - auth_attempts        (brute-force tracking)   │
│  - oauth_providers      (Google, etc.)           │
│  - password_reset_tokens                         │
│  - account_lockouts     (temporary locks)        │
│  - security_events      (audit logs)             │
│  - user_sessions        (session tracking)       │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│           External Services                      │
├─────────────────────────────────────────────────┤
│  - Resend API (email delivery)                   │
│  - Google OAuth API                              │
│  - Telegram Bot API                              │
└─────────────────────────────────────────────────┘
```

---

## 📝 Использование

### Email Registration with OTP

```tsx
import { EmailOTPInput } from '@/components/auth/EmailOTPInput';

<EmailOTPInput
  email="user@example.com"
  type="email_verification"
  onVerified={() => {
    console.log('Email verified!');
    // Proceed with signup
  }}
/>
```

### Google Sign-In

```tsx
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

<GoogleSignInButton
  role="client"
  onSuccess={() => {
    console.log('Logged in with Google!');
  }}
/>
```

### Phone Verification (Telegram)

```tsx
import { PhoneOTPVerification } from '@/components/auth/PhoneOTPVerification';

<PhoneOTPVerification
  phone="+998901234567"
  onVerified={() => {
    console.log('Phone verified!');
  }}
/>
```

### Password Reset

```tsx
import { PasswordResetForm } from '@/components/auth/PasswordResetForm';

<PasswordResetForm
  onBack={() => navigate('/auth')}
  onSuccess={() => {
    toast({ title: 'Password reset successful!' });
  }}
/>
```

---

## 🔒 Безопасность

### Password Requirements
- Минимум 8 символов
- Заглавная буква (A-Z)
- Строчная буква (a-z)
- Цифра (0-9)
- Спецсимвол (!@#$%^&*...)

### Rate Limiting
- **Email OTP**: max 5 отправок/час
- **Phone OTP**: max 5 отправок/час
- **Login attempts**: max 5 попыток/10 минут
- **Password reset**: max 3 запроса/час

### Account Lockout
- **Trigger**: 5 неудачных попыток входа/OTP
- **Duration**: 10 минут
- **Bypass**: Только через admin dashboard

### Security Events
Все события логируются в `security_events`:
- `email_verified`
- `google_login`
- `password_reset_requested`
- `otp_rate_limit`
- `account_locked`

---

## 🧪 Тестирование

### Unit Tests
```bash
npm test
```

### E2E Tests (Playwright)
```bash
npm run test:e2e
```

### Manual Testing Checklist
- [ ] Email OTP отправка и валидация
- [ ] Google OAuth login/signup
- [ ] Phone OTP через Telegram
- [ ] Password reset (email + Telegram)
- [ ] Rate limiting срабатывает
- [ ] Account lockout работает
- [ ] Password validation корректна
- [ ] Security events создаются

---

## 🛠️ Troubleshooting

### OTP код не приходит на email
1. Проверьте RESEND_API_KEY
2. Проверьте spam папку
3. Проверьте логи Supabase Edge Functions
4. Убедитесь, что домен верифицирован в Resend

### Google Sign-In не работает
1. Проверьте VITE_GOOGLE_CLIENT_ID
2. Убедитесь, что redirect URI добавлен в Google Console
3. Проверьте, что Google SDK загружен в index.html
4. Откройте DevTools → Console для ошибок

### Telegram OTP не приходит
1. Проверьте TELEGRAM_BOT_TOKEN
2. Убедитесь, что пользователь написал боту `/start`
3. Проверьте, что Telegram account привязан к user_id
4. Проверьте логи Edge Function `telegram-otp`

### Account заблокирован
```sql
-- Разблокировать вручную
DELETE FROM account_lockouts WHERE identifier = 'user@example.com';
```

---

## 📊 Мониторинг

### Security Events Dashboard
```sql
SELECT 
  event_type, 
  COUNT(*) as count,
  MAX(created_at) as last_event
FROM security_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY count DESC;
```

### Failed Login Attempts
```sql
SELECT 
  identifier,
  COUNT(*) as failed_attempts,
  MAX(created_at) as last_attempt
FROM auth_attempts
WHERE success = false
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY identifier
HAVING COUNT(*) >= 3
ORDER BY failed_attempts DESC;
```

### Active Account Lockouts
```sql
SELECT * FROM account_lockouts
WHERE locked_until > NOW()
ORDER BY locked_until DESC;
```

---

## 🔄 Миграция с старой системы

1. **Backup existing data**:
```bash
pg_dump -h <host> -U <user> <database> > backup.sql
```

2. **Run migration**:
```sql
-- В Supabase SQL Editor
\i supabase/migrations/20260126120000_auth_system_overhaul.sql
```

3. **Migrate users** (если нужно):
```sql
-- Пример: пометить всех существующих пользователей как verified
UPDATE profiles 
SET email_verified = true, account_status = 'active'
WHERE created_at < '2026-01-26';
```

---

## 📞 Support

- **Документация**: `AUTH_SYSTEM_README.md`
- **Issues**: GitHub Issues
- **Email**: support@asialog.uz
- **Telegram**: @asialog_support

---

## 🎯 Roadmap

- [ ] 2FA (TOTP) поддержка
- [ ] Biometric authentication (WebAuthn)
- [ ] Social login (Facebook, Apple)
- [ ] Magic link login (passwordless)
- [ ] SMS OTP (Twilio/AWS SNS) fallback
- [ ] Device fingerprinting
- [ ] IP geolocation blocking
- [ ] Advanced fraud detection

---

## 📄 License

MIT License - см. LICENSE файл

---

**Developed with ❤️ by AsiaLog Team**
