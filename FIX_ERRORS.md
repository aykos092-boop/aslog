# 🚨 Исправление ошибок Swift Ship Connect

## 📋 **Проблемы которые нужно исправить:**

### **1. Ошибки 404 - Таблицы не существуют**
```
Could not find the table 'public.subscriptions' in the schema cache
Could not find the table 'public.platform_income' in the schema cache
```

### **2. Ошибки 406 - API проблемы**
```
Failed to load resource: the server responded with a status of 406 ()
```

### **3. Firebase auth ошибки**
```
auth/invalid-credential Firebase: Error (auth/invalid-credential)
```

### **4. Ошибки NaN в UI**
```
Warning: Received NaN for the `value` attribute
```

### **5. 404 роут /wallet/deposit**
```
404 Error: User attempted to access non-existent route: /wallet/deposit
```

---

## 🔧 **Как исправить:**

### **Шаг 1: Создать недостающие таблицы**

**Способ A - Через Supabase Dashboard:**
1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект `eqrzodfukdnwsogjzmoz`
3. SQL Editor → New query
4. Скопируйте и вставьте SQL из файла `create_missing_tables.sql`
5. Нажмите "Run"

**Способ B - Через CLI (если Docker работает):**
```bash
npx supabase db reset
npx supabase db push
```

---

### **Шаг 2: Исправить Firebase конфигурацию**

**Проблема:** Firebase проект настроен на `asialog-2aa38` вместо Swift Ship Connect

**Решение A - Обновить конфигурацию:**
1. Создайте новый Firebase проект: [Firebase Console](https://console.firebase.google.com/)
2. Название проекта: `Swift Ship Connect`
3. Включите Authentication → Email/Password
4. Скопируйте новые учетные данные
5. Обновите `src/lib/firebase.ts`

**Решение B - Использовать существующий проект:**
1. В [Firebase Console](https://console.firebase.google.com/project/asialog-2aa38/authentication/users)
2. Добавьте пользователя: `abdurahmonpolatov158@gmail.com`
3. Установите пароль
4. Проверьте что Email верифицирован

---

### **Шаг 3: Проверить роуты**

**Роуты уже добавлены в App.tsx:**
```typescript
<Route path="/wallet/deposit" element={<EnhancedWalletDeposit />} />
<Route path="/wallet/withdraw" element={<EnhancedWalletWithdraw />} />
<Route path="/subscriptions" element={<SubscriptionsPage />} />
```

---

### **Шаг 4: Проверить данные пользователя**

**UID пользователя:** `uIgIpjzRKreOuhx8ixDaAeB3kNs1`

**Проверить в Supabase:**
```sql
-- Проверить существует ли пользователь
SELECT * FROM auth.users WHERE id = 'uIgIpjzRKreOuhx8ixDaAeB3kNs1';

-- Проверить профиль
SELECT * FROM profiles WHERE user_id = 'uIgIpjzRKreOuhx8ixDaAeB3kNs1';

-- Проверить роль
SELECT * FROM user_roles WHERE user_id = 'uIgIpjzRKreOuhx8ixDaAeB3kNs1';
```

---

## 🚀 **После исправления:**

### **Должно работать:**
1. ✅ **Firebase auth** - вход без ошибок
2. ✅ **Таблицы** - все таблицы созданы
3. ✅ **Роуты** - `/wallet/deposit` работает
4. ✅ **Монетизация** - без NaN ошибок
5. ✅ **API запросы** - без 406 ошибок

### **Проверить:**
1. Зайдите в `/admin` → вкладка "Monetization"
2. Проверьте что нет NaN в полях
3. Попробуйте `/wallet/deposit`
4. Проверьте `/subscriptions`

---

## 🎯 **Быстрое решение:**

**Если нужно быстро запустить:**
1. Выполните SQL из `create_missing_tables.sql`
2. Используйте существующий Firebase проект
3. Добавьте пользователя в Firebase Console
4. Проверьте что все роуты работают

**Это должно исправить основные ошибки!** 🚀
