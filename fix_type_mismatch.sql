-- ИСПРАВЛЕНИЕ ОШИБКИ ТИПОВ ДАННЫХ
-- Проблема: subscription_id VARCHAR(50) сравнивается с UUID

-- ==========================================
-- ШАГ 1: Исправляем тип subscription_id в user_subscriptions
-- ==========================================

-- Сначала удаляем foreign key constraint если он есть
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_id_fkey;

-- Изменяем тип subscription_id с VARCHAR на UUID
ALTER TABLE user_subscriptions 
ALTER COLUMN subscription_id TYPE UUID USING subscription_id::uuid;

-- Восстанавливаем foreign key constraint с правильным типом
ALTER TABLE user_subscriptions 
ADD CONSTRAINT user_subscriptions_subscription_id_fkey 
FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;

-- ==========================================
-- ШАГ 2: Исправляем тип subscription_id в profiles
-- ==========================================

-- Сначала удаляем constraint если он есть
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_id_fkey;

-- Изменяем тип subscription_id с VARCHAR на UUID
ALTER TABLE profiles 
ALTER COLUMN subscription_id TYPE UUID USING subscription_id::uuid;

-- Восстанавливаем foreign key constraint
ALTER TABLE profiles 
ADD CONSTRAINT profiles_subscription_id_fkey 
FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;

-- ==========================================
-- ШАГ 3: Обновляем данные в subscriptions чтобы использовать UUID
-- ==========================================

-- Обновляем ID подписок на UUID
UPDATE subscriptions 
SET id = CASE 
    WHEN id = 'basic' THEN '550e8400-e29b-41d4-a716-446655440001'::uuid
    WHEN id = 'pro' THEN '550e8400-e29b-41d4-a716-446655440002'::uuid
    WHEN id = 'elite' THEN '550e8400-e29b-41d4-a716-446655440003'::uuid
    ELSE id::uuid
END
WHERE id IN ('basic', 'pro', 'elite');

-- ==========================================
-- ШАГ 4: Обновляем platform_settings для UUID
-- ==========================================

UPDATE platform_settings 
SET value = CASE 
    WHEN key = 'default_trial_subscription_id' THEN '550e8400-e29b-41d4-a716-446655440001'
    ELSE value
END
WHERE key = 'default_trial_subscription_id';

-- ==========================================
-- ШАГ 5: Пересоздаем индексы с правильными типами
-- ==========================================

-- Удаляем старые индексы
DROP INDEX IF EXISTS idx_user_subscriptions_subscription_id;
DROP INDEX IF EXISTS idx_profiles_subscription_id;

-- Создаем новые индексы с правильными типами
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_subscription_id ON user_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id ON profiles(subscription_id);

-- ==========================================
-- ШАГ 6: Проверка данных
-- ==========================================

-- Проверяем что все ID теперь UUID
SELECT 
    'subscriptions' as table_name,
    id,
    pg_typeof(id) as id_type
FROM subscriptions 
UNION ALL
SELECT 
    'user_subscriptions' as table_name,
    subscription_id,
    pg_typeof(subscription_id) as id_type
FROM user_subscriptions 
WHERE subscription_id IS NOT NULL
UNION ALL
SELECT 
    'profiles' as table_name,
    subscription_id,
    pg_typeof(subscription_id) as id_type
FROM profiles 
WHERE subscription_id IS NOT NULL;

-- Показываем текущие подписки с UUID
SELECT * FROM subscriptions;
