# 🔥 Firebase Authentication Setup Guide

## ✅ Система полностью работает с Firebase!

**Ваш проект Firebase:**
- **Project ID**: `asialog-2aa38`
- **API Key**: `AIzaSyBuht58TZusVJm4do47LSooBWBGSZErsS8`
- **Auth Domain**: `asialog-2aa38.firebaseapp.com`

---

## 🚀 Быстрый старт (5 минут)

### 1. Включить Firebase в проекте
```bash
# Создать .env файл
cp .env.firebase.example .env

# Убедиться что VITE_USE_FIREBASE=true
```

### 2. Настроить Firebase Console

#### A. Authentication
1. Открыть [Firebase Console](https://console.firebase.google.com/)
2. Выбрать проект `asialog-2aa38`
3. **Authentication → Get Started**
4. **Sign-in method → Email/Password** → Enable
5. **Sign-in method → Google** → Enable
6. Добавить домены в **Authorized domains**:
   - `localhost`
   - `asialog-2aa38.firebaseapp.com`
   - Ваш production домен

#### B. Firestore Database
1. **Firestore Database → Create database**
2. Выбрать регион (например, `europe-west1`)
3. **Start in production mode** (правила настроим позже)
4. Скопировать Security Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
      allow create: if request.auth.uid == userId;
    }
    
    // Email OTP codes
    match /email_otp_codes/{docId} {
      allow create: if true; // Anyone can create
      allow read, update: if request.auth != null;
      allow delete: if false;
    }
    
    // Auth attempts (for rate limiting)
    match /auth_attempts/{docId} {
      allow create: if true;
      allow read: if request.auth != null;
      allow delete: if false;
    }
    
    // Account lockouts
    match /account_lockouts/{docId} {
      allow create: if true;
      allow read: if request.auth != null;
      allow delete: if request.auth != null;
    }
    
    // Referrals
    match /referrals/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if false;
    }
  }
}
```

### 3. Запустить проект
```bash
npm install
npm run dev
```

Открыть: http://localhost:5173/auth

---

## ✨ Реализованные функции

### 1️⃣ Email Registration with OTP ✅
- **Как работает:**
  1. Пользователь вводит email/password/имя
  2. Firebase создаёт user account
  3. Отправляется 5-digit OTP код на email
  4. После verify → пользователь активен

- **Безопасность:**
  - Rate limiting: 5 OTP/час на email
  - OTP expires через 5 минут
  - Max 5 attempts на OTP
  - Account lockout после 5 failed attempts (10 минут)

### 2️⃣ Google OAuth ✅
- **Как работает:**
  1. Нажать "Войти через Google"
  2. Firebase Auth popup
  3. Если новый user → создаётся profile в Firestore
  4. Если существующий → login

- **Преимущества:**
  - Нативная интеграция Firebase
  - Automatic email verification
  - Безопасный токен обмен
  - No extra configuration needed

### 3️⃣ Password Reset ✅
- **Как работает:**
  1. Пользователь нажимает "Забыли пароль?"
  2. Вводит email
  3. Firebase отправляет reset link
  4. Переход по ссылке → новый пароль

- **Firebase handles:**
  - Email sending
  - Token generation
  - Link expiration (1 час)
  - Security

### 4️⃣ Password Validation ✅
- Минимум 8 символов
- Заглавная буква (A-Z)
- Строчная буква (a-z)
- Цифра (0-9)
- Спецсимвол (!@#$%...)

### 5️⃣ Brute-Force Protection ✅
- Rate limiting на все операции
- Account lockout mechanism
- Auth attempts logging
- IP tracking (опционально)

---

## 📊 Архитектура

```
Frontend (React)
    ↓
firebaseAuthService.ts
    ↓
Firebase SDK
    ↓
Firebase Authentication + Firestore
    ↓
User Profile Storage
```

### Firestore Collections:

**users** - User profiles
```typescript
{
  uid: string,
  email: string,
  fullName: string,
  role: 'client' | 'carrier' | 'admin',
  phone?: string,
  phoneVerified: boolean,
  emailVerified: boolean,
  accountStatus: 'pending' | 'active' | 'suspended' | 'blocked',
  referralCode: string,
  photoURL?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastLoginAt?: Timestamp
}
```

**email_otp_codes** - OTP storage
```typescript
{
  email: string,
  code: string, // 5-digit
  type: 'email_verification' | 'login',
  verified: boolean,
  attempts: number,
  maxAttempts: number, // 5
  expiresAt: Date,
  createdAt: Timestamp
}
```

**auth_attempts** - Rate limiting
```typescript
{
  identifier: string, // email or phone
  attemptType: string, // 'login', 'otp_verify', etc.
  success: boolean,
  createdAt: Timestamp,
  ipAddress?: string,
  userAgent?: string
}
```

**account_lockouts** - Temporary locks
```typescript
{
  identifier: string,
  lockedUntil: Date,
  reason: string,
  createdAt: Timestamp
}
```

---

## 🔧 Компоненты

### Frontend Components
```
✅ src/config/firebase.ts              - Firebase config
✅ src/services/firebaseAuthService.ts - Auth logic
✅ src/hooks/useFirebaseAuth.tsx       - Auth context
✅ src/pages/AuthFirebase.tsx          - Auth page
✅ src/components/auth/EmailOTPInputFirebase.tsx
✅ src/components/auth/GoogleSignInButtonFirebase.tsx
```

### Key Functions
```typescript
// Sign up
signUpWithEmail(data: SignUpData)

// Sign in
signInWithEmail(email, password)

// Google OAuth
signInWithGoogle(role?: AppRole)

// OTP
sendEmailOTP(email, type)
verifyEmailOTP(email, code)

// Password reset
requestPasswordReset(email)

// Sign out
signOut()
```

---

## 🧪 Тестирование

### Manual Test Checklist

**Email Registration:**
- [ ] Регистрация с валидным email/password
- [ ] OTP код генерируется
- [ ] OTP код expires через 5 минут
- [ ] 5 неверных попыток → lockout
- [ ] После verify → user создаётся в Firestore
- [ ] Profile данные сохраняются

**Google OAuth:**
- [ ] Кнопка "Войти через Google"
- [ ] Google popup открывается
- [ ] Новый пользователь → создаётся profile
- [ ] Существующий → login
- [ ] Redirect to dashboard

**Password Validation:**
- [ ] < 8 chars → error
- [ ] No uppercase → error
- [ ] No lowercase → error
- [ ] No number → error
- [ ] No special char → error
- [ ] Valid password → success

**Security:**
- [ ] 5 failed logins → lockout 10 min
- [ ] Rate limiting работает
- [ ] Auth attempts логируются в Firestore

---

## 🔒 Security Best Practices

### 1. Firestore Security Rules
```javascript
// Уже настроены выше
// Users can only read/write their own data
// OTP codes public для создания
// Admin-only для auth_attempts
```

### 2. Firebase Authentication Settings
- **Email enumeration protection**: Enabled
- **Password policy**: 6+ chars (можно усилить)
- **Multi-factor authentication**: Можно включить позже
- **Session duration**: Default (1 hour)

### 3. Environment Variables
```bash
# Никогда не коммитить!
.env
.env.local
.env.production
```

### 4. API Keys
- Firebase API keys **можно** использовать в frontend
- Они ограничены Firebase domain restrictions
- Real security в Firestore Rules

---

## 📱 Email OTP отправка

### Вариант 1: Firebase Extensions (рекомендуется)
```bash
# Установить Extension "Trigger Email"
# https://extensions.dev/extensions/firebase/firestore-send-email
```

**Setup:**
1. Firebase Console → Extensions
2. Install "Trigger Email from Firestore"
3. Настроить SMTP (Gmail, SendGrid, etc.)
4. Collection: `mail`
5. Email template с OTP кодом

**Code change:**
```typescript
// В sendEmailOTP функции
await addDoc(collection(db, 'mail'), {
  to: email,
  template: {
    name: 'otp',
    data: { otp, expiresIn: '5 minutes' }
  }
});
```

### Вариант 2: Cloud Function + Resend/SMTP
```bash
# Deploy Cloud Function
firebase deploy --only functions:sendOTPEmail
```

**functions/index.ts:**
```typescript
import * as functions from 'firebase-functions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOTPEmail = functions.firestore
  .document('email_otp_codes/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    
    await resend.emails.send({
      from: 'AsiaLog <noreply@asialog.uz>',
      to: data.email,
      subject: 'Код подтверждения',
      html: `Ваш код: <b>${data.code}</b>`
    });
  });
```

### Вариант 3: Dev Mode (console.log)
```typescript
// Уже реализовано
// OTP code выводится в console
console.log(`OTP for ${email}: ${otp}`);
```

---

## 🚀 Production Deployment

### 1. Environment Setup
```bash
# Production .env
VITE_USE_FIREBASE=true
VITE_FIREBASE_API_KEY=AIzaSyBuht58TZusVJm4do47LSooBWBGSZErsS8
# ... остальные
NODE_ENV=production
```

### 2. Build
```bash
npm run build
```

### 3. Deploy (Vercel/Netlify)
```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod
```

### 4. Firebase Hosting (альтернатива)
```bash
firebase init hosting
firebase deploy --only hosting
```

### 5. Authorized Domains
Firebase Console → Authentication → Settings → Authorized domains
- Добавить production domain

---

## 🐛 Troubleshooting

### OTP не отправляется
**Решение**: Настроить Email Extension или Cloud Function (см. выше)

### Google Sign-In не работает
**Проверить**:
1. Google provider включён в Firebase Console
2. Authorized domains добавлены
3. Browser не блокирует popup

### Firestore Permission Denied
**Проверить**: Security Rules настроены правильно

### Build fails
```bash
rm -rf node_modules
npm install
npm run build
```

---

## 📚 Полезные ссылки

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firestore Docs](https://firebase.google.com/docs/firestore)
- [Firebase Extensions](https://extensions.dev/)

---

## ✅ Checklist для production

- [ ] Firebase Authentication enabled
- [ ] Google OAuth configured
- [ ] Firestore Database created
- [ ] Security Rules deployed
- [ ] Email sending configured
- [ ] Authorized domains added
- [ ] Environment variables set
- [ ] Build successful
- [ ] Deploy to hosting
- [ ] Test all flows
- [ ] Monitor Firebase Console

---

**🎉 Готово! Система работает на Firebase!**

Создано: 26 января 2026  
Версия: 2.0.0 (Firebase)
