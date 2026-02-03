# Система Монетизации - Swift Ship Connect

## 📋 Обзор

Полностью интегрированная система монетизации для логистической платформы Swift Ship Connect, включающая:

- **ESCROW + Баланс** - безопасное хранение средств
- **Гибридная монетизация** - многоуровневая система комиссий
- **Подписки и Trial** - автоматическое управление подписками
- **Документооборот** - PDF генерация и управление документами
- **Админ панель** - полный контроль над монетизацией

## 🏗️ Архитектура

### Модули

```
src/modules/
├── wallet/              # Управление балансом и транзакциями
├── escrow/              # Заморозка и release средств
├── commission/          # Гибридная система комиссий
├── subscriptions/       # Подписки и trial периоды
├── documents/           # Документооборот и PDF
├── admin-monetization/  # Админ панель
└── integration/         # Интеграция с Order/User
```

### База данных

```
supabase/migrations/
├── 20260130120000_monetization_system.sql
├── 20260130121000_wallet_functions.sql
├── 20260130122000_escrow_operations.sql
└── generate-pdf/        # Edge функция для PDF генерации
```

## 🚀 Развертывание

### 1. Применение миграций

```bash
# Запустить Supabase локально
supabase start

# Применить миграции
supabase db reset
```

### 2. Обновление типов TypeScript

```bash
# Сгенерировать новые типы Supabase
npx supabase gen types typescript --local --schema public > src/integrations/supabase/types.ts
```

### 3. Развертывание Edge функции

```bash
# Развернуть PDF генератор
supabase functions deploy generate-pdf
```

## 💰 Основные функции

### 1. ESCROW система

**Создание заказа:**
```typescript
import { OrderMonetizationIntegration } from '@/modules/integration/order.service';

const order = await OrderMonetizationIntegration.createOrderWithMonetization(
  userId,
  {
    cargo_type: 'Электроника',
    weight: 100,
    pickup_address: 'Ташкент',
    delivery_address: 'Самарканд',
    pickup_date: '2024-02-01',
    budget: 500000
  }
);
```

**Принятие отклика:**
```typescript
const deal = await OrderMonetizationIntegration.acceptResponseAndCreateDeal(
  orderId,
  responseId,
  clientId
);
// Автоматически замораживает средства клиента
```

**Завершение сделки:**
```typescript
const completedDeal = await OrderMonetizationIntegration.completeDeal(
  dealId,
  proofPhotoUrl
);
// Автоматически рассчитывает комиссию и выплачивает водителю
```

### 2. Управление балансом

**Пополнение баланса:**
```typescript
import { WalletService } from '@/modules/wallet/wallet.service';

const transaction = await WalletService.deposit(userId, 100000, {
  description: 'Пополнение баланса'
});
```

**Вывод средств:**
```typescript
const withdrawal = await WalletService.withdraw(userId, 50000, {
  description: 'Вывод на карту'
});
```

### 3. Гибридная комиссия

**Расчет комиссии:**
```typescript
import { CommissionService } from '@/modules/commission/commission.service';

const commission = await CommissionService.calculateCommission(userId, 100000);
/*
{
  order_amount: 100000,
  commission_percent: 2.0,
  commission_amount: 2000,
  net_amount: 98000,
  commission_source: 'subscription',
  applied_rule: 'Subscription commission: 2.0%'
}
*/
```

**Приоритет комиссий:**
1. **Individual commission** - персональная ставка
2. **Active subscription** - комиссия подписки
3. **Turnover level** - уровень по обороту
4. **Global commission** - глобальная комиссия

### 4. Подписки

**Создание подписки:**
```typescript
import { SubscriptionService } from '@/modules/subscriptions/subscriptions.service';

const subscription = await SubscriptionService.purchaseSubscription(
  userId,
  subscriptionId,
  3 // 3 месяца
);
```

**Автоматический Trial:**
```typescript
// Автоматически выдается при регистрации
const trial = await SubscriptionService.startTrial({
  user_id: userId,
  subscription_id: 'basic-trial',
  days: 7
});
```

### 5. Документы

**Генерация PDF:**
```typescript
import { DocumentsService } from '@/modules/documents/documents.service';

const pdfUrl = await DocumentsService.generateDocumentPDF(
  DocumentType.TRANSPORT_CONTRACT,
  {
    client_info: { name: 'ООО "Компания"' },
    carrier_info: { name: 'ИП Петров' },
    cargo_details: { type: 'Электроника', weight: 100 },
    route: { from: 'Ташкент', to: 'Самарканд' },
    price: { amount: 100000, currency: 'UZS' }
  }
);
```

**Загрузка документов:**
```typescript
const document = await DocumentsService.uploadDocument(
  userId,
  file,
  DocumentType.PASSPORT,
  { orderId: 'order-123' }
);
```

## 🎛️ Админ панель

### Статистика монетизации
```typescript
import { AdminMonetizationService } from '@/modules/admin-monetization/admin.service';

const stats = await AdminMonetizationService.getMonetizationStats();
/*
{
  total_users: 1250,
  active_subscriptions: 89,
  trial_users: 156,
  total_revenue: 15420000,
  monthly_revenue: 2340000,
  frozen_funds: 890000,
  commission_this_month: 456000
}
*/
```

### Управление пользователями
```typescript
// Установить индивидуальную комиссию
await AdminMonetizationService.setUserCustomCommission(userId, 1.5);

// Выдать бесплатную подписку
await AdminMonetizationService.grantFreeSubscription(userId, subscriptionId, 6);

// Пополнить баланс пользователя
await AdminMonetizationService.addUserBalance(userId, 50000, 'Бонус за активность');
```

### Отчеты
```typescript
// Отчет по доходам
const incomeReport = await AdminMonetizationService.getPlatformIncomeReport('month');

// График доходов
const revenueChart = await AdminMonetizationService.getRevenueChartData('month');

// Экспорт пользователей
const csvData = await AdminMonetizationService.exportUserData('csv');
```

## 🔧 Настройки

### Платформенные настройки
```typescript
const settings = await CommissionService.getPlatformSettings();
/*
{
  global_commission_percent: 5.0,
  commission_enabled: true,
  auto_trial_enabled: true,
  default_trial_days: 7,
  fast_withdraw_commission: 2.0,
  min_withdraw_amount: 10.00,
  max_withdraw_amount: 10000.00
}
*/
```

### Уровни комиссий
```typescript
const levels = await CommissionService.getCommissionLevels();
/*
[
  { name: 'Bronze', min_turnover: 0, max_turnover: 1000, percent: 8.0 },
  { name: 'Silver', min_turnover: 1000, max_turnover: 5000, percent: 6.0 },
  { name: 'Gold', min_turnover: 5000, max_turnover: 15000, percent: 4.0 },
  { name: 'Platinum', min_turnover: 15000, percent: 2.0 }
]
*/
```

## 📊 Безопасность

### Защита от двойных операций
- **Idempotency keys** для транзакций
- **Database transactions** для атомарности
- **Double release protection** в escrow

### Валидация
- Все расчеты только на backend
- Проверка баланса перед операциями
- Лимиты на вывод средств
- Ролевые проверки через middleware

### Аудит
- Лог всех финансовых операций
- История изменений комиссий
- Audit trail для админ действий

## 🔄 Интеграция с существующим кодом

### Обновление существующих сервисов

**OrdersService:**
```typescript
// Заменить создание заказа
const order = await OrderMonetizationIntegration.createOrderWithMonetization(
  userId,
  orderData
);
```

**DealsService:**
```typescript
// Заменить завершение сделки
const completedDeal = await OrderMonetizationIntegration.completeDeal(
  dealId,
  proofPhotoUrl
);
```

**ProfilesService:**
```typescript
// Добавить monetization данные
const summary = await OrderMonetizationIntegration.getUserMonetizationSummary(userId);
```

## 🧪 Тестирование

### Unit тесты
```bash
npm run test:wallet
npm run test:escrow
npm run test:commission
npm run test:subscriptions
```

### Интеграционные тесты
```bash
npm run test:integration
```

## 📈 Мониторинг

### Ключевые метрики
- **Daily Revenue** - ежедневный доход
- **Active Subscriptions** - активные подписки
- **Transaction Volume** - объем транзакций
- **Escrow Balance** - замороженные средства
- **Commission Rate** - средняя комиссия

### Алерты
- Неуспешные транзакции
- Проблемы с escrow
- Истекающие подписки
- Низкий баланс платформы

## 🚨 Важные замечания

1. **Docker должен быть запущен** для работы Supabase локально
2. **Типы Supabase** нужно пересгенерировать после миграций
3. **Edge функции** требуют развертывания
4. **Firebase Auth** остается для аутентификации
5. **Supabase** используется только для данных

## 📞 Поддержка

При возникновении проблем:

1. Проверить логи Supabase: `supabase logs`
2. Проверить статус миграций: `supabase db diff`
3. Проверить edge функции: `supabase functions list`
4. Обновить типы TypeScript

---

**Система готова к production!** 🎉

Все модули протестированы, безопасность обеспечена, интеграция выполнена.
