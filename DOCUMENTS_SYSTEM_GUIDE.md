# 📄 Административный модуль документов

## Обзор

Создан полноценный административный модуль документов с генерацией PDF, строгим контролем файлов и безопасным доступом.

## 🗄️ Изменения в базе данных

### Новые таблицы:

```sql
-- Основная таблица документов
CREATE TABLE public.documents (
  id UUID PRIMARY KEY,
  document_number TEXT UNIQUE NOT NULL,
  document_type document_type NOT NULL,
  status document_status DEFAULT 'draft' NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_id UUID REFERENCES orders(id),
  deal_id UUID REFERENCES deals(id),
  warehouse_id UUID REFERENCES warehouses(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  content JSONB,
  metadata JSONB,
  file_path TEXT,
  file_size BIGINT,
  file_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Таблица позиций документов
CREATE TABLE public.document_items (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  item_sequence INTEGER NOT NULL,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity DECIMAL(12, 3) NOT NULL,
  unit_price DECIMAL(12, 2),
  total_price DECIMAL(12, 2),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(document_id, item_sequence)
);

-- Таблица подписей
CREATE TABLE public.document_signatures (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  signature_type TEXT NOT NULL,
  signature_data JSONB,
  ip_address INET,
  user_agent TEXT,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(document_id, signature_type, user_id)
);
```

### Новые типы данных:

```sql
-- Типы документов
CREATE TYPE public.document_type AS ENUM (
  'order_confirmation',
  'shipping_manifest', 
  'receiving_report',
  'inventory_report',
  'warehouse_receipt',
  'delivery_note',
  'invoice',
  'customs_declaration'
);

-- Статусы документов
CREATE TYPE public.document_status AS ENUM (
  'draft',
  'pending', 
  'approved',
  'final',
  'cancelled'
);
```

## 🔐 Безопасность и права доступа

### RLS политики:

- **Admin**: Полный доступ ко всем документам
- **Пользователи**: Доступ только к своим документам
- **Клиенты**: Доступ к документам своих заказов
- **Перевозчики**: Доступ к документам своих сделок

### Security функции:

```sql
-- Проверка доступа к документу
CREATE OR REPLACE FUNCTION public.has_document_access(_user_id UUID, _document_id UUID)
RETURNS BOOLEAN;

-- Генерация номера документа
CREATE OR REPLACE FUNCTION public.generate_document_number(_type document_type)
RETURNS TEXT;
```

## 📋 Логика генерации PDF

### Supabase Edge Function: `documents-pdf`

**Функциональность:**
- Генерация PDF с использованием pdf-lib
- Единый шаблон для всех типов документов
- Автоматическая нумерация документов
- Поддержка мультиязычности
- Цифровые подписи

**Структура PDF:**
```
1. Заголовок компании (Swift Ship Connect)
2. Информация о документе (номер, тип, дата)
3. Связанные данные (заказ, сделка, склад)
4. Таблица позиций (если есть)
5. Подписи (создатель, утверждающий)
6. Футер (дата генерации)
```

**Пример PDF-шаблона:**
```
╔══════════════════════════════════════════════════════════════╗
║                    Swift Ship Connect                        ║
║                     Logistics Platform                         ║
╠══════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Order Confirmation                                              ║
║  Document Number: ORD/2024/000001                               ║
║  Type: Order Confirmation                                        ║
║  Created: January 1, 2024, 10:00 AM                           ║
╠══════════════════════════════════════════════════════════════╣
║  Order Information:                                              ║
║  • Cargo: Electronics                                            ║
║  • From: Tashkent, Uzbekistan                                    ║
║  • To: Almaty, Kazakhstan                                        ║
╠══════════════════════════════════════════════════════════════╣
║  Items:                                                          ║
║  ┌─────────────────┬─────────┬─────────┬─────────┐               ║
║  │ Description     │ Quantity │ Price    │ Total   │               ║
║  └─────────────────┴─────────┴─────────┴─────────┘               ║
╠══════════════════════════════════════════════════════════════╣
║  Signatures:                                                     ║
║  ┌─────────────────┐  ┌─────────────────┐                       ║
║  │ Created by:     │  │ Approved by:    │                       ║
║  │ John Doe        │  │ Jane Smith      │                       ║
║  └─────────────────┘  └─────────────────┘                       ║
╚══════════════════════════════════════════════════════════════╝
```

## 📁 Структура хранения файлов

### Хранилище Supabase Storage:

```
documents/
├── 2024/
│   ├── order_confirmation/
│   │   ├── ORD/2024/000001.pdf
│   │   └── ORD/2024/000002.pdf
│   ├── shipping_manifest/
│   │   ├── SHP/2024/000001.pdf
│   │   └── SHP/2024/000002.pdf
│   └── invoice/
│       ├── INV/2024/000001.pdf
│       └── INV/2024/000002.pdf
└── 2025/
    └── ...
```

### Правила хранения:

- **Только PDF файлы** финальных документов
- **Строгая структура** по годам и типам
- **Уникальные имена** файлов
- **SHA256 хеш** для проверки целостности
- **Автоматическая очистка** временных файлов

## 🎛️ Admin UI описание

### Components: `DocumentsManager`

**Основные функции:**
- 📋 Таблица всех документов с фильтрацией
- 🔍 Поиск по номеру, названию, описанию
- 🏷️ Фильтры по типу и статусу
- 👁️ Просмотр деталей документа
- 📥 Скачивание PDF
- 🔄 Генерация PDF по требованию

**Фильтры:**
- **Тип документа**: 8 типов документов
- **Статус**: 5 статусов (draft, pending, approved, final, cancelled)
- **Поиск**: по номеру, названию, описанию

**Действия:**
- **Просмотр**: Детальная информация в модальном окне
- **Скачать**: PDF файл (если существует)
- **Сгенерировать**: Создать PDF для финальных документов

### Интерфейс:

```
┌─────────────────────────────────────────────────────────────────┐
│ Documents Management                                            │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 [Search documents...]  📋[Type▼]  📊[Status▼]  ➕[Create]     │
├─────────────────────────────────────────────────────────────────┤
│ 📄 Documents List (Total: 25)                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ # │ Type        │ Title           │ Status    │ Created │Actions│ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ORD/2024/000001│Order Conf │Order #123      │✅ Final  │Jan 1  │👁️📥│ │
│ │SHP/2024/000001│Shipping   │Manifest #456   │⏳ Pending│Jan 2  │👁️📥│ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🌐 Языковая поддержка

### Поддерживаемые языки:

- **Русский** (основной)
- **Английский**
- **Узбекский**
- **Казахский**

### Локализация:

```typescript
// Примеры ключей локализации
t("documents.title", "Documents")
t("documents.type.order_confirmation", "Order Confirmation")
t("documents.status.final", "Final")
t("documents.pdfGenerated", "PDF Generated")
```

## 🔄 Интеграция с существующей системой

### Связи с таблицами:

- **orders**: Документы подтверждения заказов
- **deals**: Манифесты и накладные
- **warehouses**: Складские квитанции
- **products**: Позиции в документах
- **auth.users**: Создатели и утверждающие

### API интеграция:

```typescript
// Генерация PDF
const { data } = await supabase.functions.invoke('documents-pdf', {
  body: { documentId: 'uuid' }
});

// Получение документов
const { data } = await supabase
  .from('documents')
  .select('*, creator:auth.users!created_by(email)')
  .eq('status', 'final');
```

## 📊 Примеры использования

### 1. Создание документа заказа:

```sql
INSERT INTO documents (
  document_type,
  title,
  description,
  order_id,
  created_by
) VALUES (
  'order_confirmation',
  'Order Confirmation #123',
  'Confirmation of order for electronics',
  'order-uuid',
  'user-uuid'
);
```

### 2. Добавление позиций:

```sql
INSERT INTO document_items (
  document_id,
  item_sequence,
  product_name,
  quantity,
  unit_price,
  total_price
) VALUES (
  'document-uuid',
  1,
  'Laptop Dell XPS 15',
  2,
  1500.00,
  3000.00
);
```

### 3. Генерация PDF:

```typescript
// Вызов функции генерации
await generatePDF('document-uuid');

// Результат
{
  success: true,
  filePath: 'documents/2024/order_confirmation/ORD/2024/000001.pdf',
  publicUrl: 'https://storage.supabase.co/...',
  fileSize: 245760
}
```

## 🚀 Deployment

### Шаги развертывания:

1. **Выполнить миграцию:**
   ```sql
   -- В Supabase SQL Editor
   -- Файл: supabase/migrations/20260201130000_documents_system.sql
   ```

2. **Создать storage bucket:**
   ```sql
   INSERT INTO storage.buckets (id, name, public) 
   VALUES ('documents', 'documents', false);
   ```

3. **Развернуть функции:**
   ```bash
   supabase functions deploy documents-pdf
   ```

4. **Обновить интерфейс:**
   - Компоненты уже добавлены в Admin Dashboard
   - Новая вкладка "Documents" доступна для admin

## 📋 Требования к системе

### Минимальные требования:

- **Supabase**: PostgreSQL 14+
- **Node.js**: 18+ (для локальной разработки)
- **Браузер**: Chrome 90+, Firefox 88+, Safari 14+

### Рекомендуемые настройки:

- **Storage**: 10GB+ для документов
- **Memory**: 512MB+ для PDF генерации
- **Timeout**: 30s для Edge Functions

## 🔧 Мониторинг и логирование

### Логи операций:

- Создание документов
- Генерация PDF
- Скачивание файлов
- Изменение статусов

### Метрики:

- Количество документов по типам
- Размер хранилища
- Время генерации PDF
- Популярные документы

---

## 📞 Поддержка

Для вопросов и поддержки:
- **Техническая документация**: `DOCUMENTS_SYSTEM_GUIDE.md`
- **API документация**: Supabase Functions
- **UI компоненты**: `src/components/admin/DocumentsManager.tsx`

**Система готова к использованию!** 🎉
