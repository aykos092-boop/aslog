-- Таблица для кеширования результатов геокодирования
CREATE TABLE public.geocode_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  address_normalized TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  formatted_address TEXT,
  provider TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Индекс для быстрого поиска по нормализованному адресу
CREATE INDEX idx_geocode_cache_normalized ON public.geocode_cache (address_normalized);

-- Триггер обновления updated_at
CREATE TRIGGER update_geocode_cache_updated_at
BEFORE UPDATE ON public.geocode_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: публичный доступ на чтение, вставка только через service role
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read geocode cache"
ON public.geocode_cache
FOR SELECT
USING (true);

CREATE POLICY "Service role can insert geocode cache"
ON public.geocode_cache
FOR INSERT
WITH CHECK (true);

-- Добавляем популярные города Центральной Азии
INSERT INTO public.geocode_cache (address, address_normalized, lat, lng, formatted_address, provider) VALUES
-- Кыргызстан
('Бишкек', 'бишкек', 42.8746, 74.5698, 'Бишкек, Кыргызстан', 'manual'),
('Bishkek', 'bishkek', 42.8746, 74.5698, 'Bishkek, Kyrgyzstan', 'manual'),
('Ош', 'ош', 40.5283, 72.7985, 'Ош, Кыргызстан', 'manual'),
('Osh', 'osh', 40.5283, 72.7985, 'Osh, Kyrgyzstan', 'manual'),
('Джалал-Абад', 'джалал-абад', 40.9333, 73.0017, 'Джалал-Абад, Кыргызстан', 'manual'),
('Jalal-Abad', 'jalal-abad', 40.9333, 73.0017, 'Jalal-Abad, Kyrgyzstan', 'manual'),
('Каракол', 'каракол', 42.4907, 78.3936, 'Каракол, Кыргызстан', 'manual'),
('Karakol', 'karakol', 42.4907, 78.3936, 'Karakol, Kyrgyzstan', 'manual'),
('Токмок', 'токмок', 42.8422, 75.2858, 'Токмок, Кыргызстан', 'manual'),
('Tokmok', 'tokmok', 42.8422, 75.2858, 'Tokmok, Kyrgyzstan', 'manual'),
('Нарын', 'нарын', 41.4286, 76.0000, 'Нарын, Кыргызстан', 'manual'),
('Naryn', 'naryn', 41.4286, 76.0000, 'Naryn, Kyrgyzstan', 'manual'),
('Талас', 'талас', 42.5228, 72.2428, 'Талас, Кыргызстан', 'manual'),
('Talas', 'talas', 42.5228, 72.2428, 'Talas, Kyrgyzstan', 'manual'),
('Баткен', 'баткен', 40.0628, 70.8194, 'Баткен, Кыргызстан', 'manual'),
('Batken', 'batken', 40.0628, 70.8194, 'Batken, Kyrgyzstan', 'manual'),

-- Казахстан
('Алматы', 'алматы', 43.2380, 76.9450, 'Алматы, Казахстан', 'manual'),
('Almaty', 'almaty', 43.2380, 76.9450, 'Almaty, Kazakhstan', 'manual'),
('Астана', 'астана', 51.1694, 71.4491, 'Астана, Казахстан', 'manual'),
('Astana', 'astana', 51.1694, 71.4491, 'Astana, Kazakhstan', 'manual'),
('Шымкент', 'шымкент', 42.3167, 69.5958, 'Шымкент, Казахстан', 'manual'),
('Shymkent', 'shymkent', 42.3167, 69.5958, 'Shymkent, Kazakhstan', 'manual'),
('Караганда', 'караганда', 49.8047, 73.1094, 'Караганда, Казахстан', 'manual'),
('Karaganda', 'karaganda', 49.8047, 73.1094, 'Karaganda, Kazakhstan', 'manual'),

-- Узбекистан
('Ташкент', 'ташкент', 41.2995, 69.2401, 'Ташкент, Узбекистан', 'manual'),
('Tashkent', 'tashkent', 41.2995, 69.2401, 'Tashkent, Uzbekistan', 'manual'),
('Самарканд', 'самарканд', 39.6542, 66.9597, 'Самарканд, Узбекистан', 'manual'),
('Samarkand', 'samarkand', 39.6542, 66.9597, 'Samarkand, Uzbekistan', 'manual'),
('Бухара', 'бухара', 39.7747, 64.4286, 'Бухара, Узбекистан', 'manual'),
('Bukhara', 'bukhara', 39.7747, 64.4286, 'Bukhara, Uzbekistan', 'manual'),
('Андижан', 'андижан', 40.7821, 72.3442, 'Андижан, Узбекистан', 'manual'),
('Andijan', 'andijan', 40.7821, 72.3442, 'Andijan, Uzbekistan', 'manual'),
('Фергана', 'фергана', 40.3842, 71.7869, 'Фергана, Узбекистан', 'manual'),
('Fergana', 'fergana', 40.3842, 71.7869, 'Fergana, Uzbekistan', 'manual'),
('Наманган', 'наманган', 40.9983, 71.6726, 'Наманган, Узбекистан', 'manual'),
('Namangan', 'namangan', 40.9983, 71.6726, 'Namangan, Uzbekistan', 'manual'),

-- Таджикистан
('Душанбе', 'душанбе', 38.5598, 68.7740, 'Душанбе, Таджикистан', 'manual'),
('Dushanbe', 'dushanbe', 38.5598, 68.7740, 'Dushanbe, Tajikistan', 'manual'),
('Худжанд', 'худжанд', 40.2864, 69.6220, 'Худжанд, Таджикистан', 'manual'),
('Khujand', 'khujand', 40.2864, 69.6220, 'Khujand, Tajikistan', 'manual'),

-- Туркменистан
('Ашхабад', 'ашхабад', 37.9601, 58.3261, 'Ашхабад, Туркменистан', 'manual'),
('Ashgabat', 'ashgabat', 37.9601, 58.3261, 'Ashgabat, Turkmenistan', 'manual'),

-- Россия (основные)
('Москва', 'москва', 55.7558, 37.6173, 'Москва, Россия', 'manual'),
('Moscow', 'moscow', 55.7558, 37.6173, 'Moscow, Russia', 'manual'),
('Санкт-Петербург', 'санкт-петербург', 59.9343, 30.3351, 'Санкт-Петербург, Россия', 'manual'),
('Saint Petersburg', 'saint petersburg', 59.9343, 30.3351, 'Saint Petersburg, Russia', 'manual'),
('Новосибирск', 'новосибирск', 55.0084, 82.9357, 'Новосибирск, Россия', 'manual'),
('Novosibirsk', 'novosibirsk', 55.0084, 82.9357, 'Novosibirsk, Russia', 'manual'),
('Екатеринбург', 'екатеринбург', 56.8389, 60.6057, 'Екатеринбург, Россия', 'manual'),
('Yekaterinburg', 'yekaterinburg', 56.8389, 60.6057, 'Yekaterinburg, Russia', 'manual'),

-- Китай (приграничные)
('Кашгар', 'кашгар', 39.4677, 75.9938, 'Кашгар, Китай', 'manual'),
('Kashgar', 'kashgar', 39.4677, 75.9938, 'Kashgar, China', 'manual'),
('Урумчи', 'урумчи', 43.8256, 87.6168, 'Урумчи, Китай', 'manual'),
('Urumqi', 'urumqi', 43.8256, 87.6168, 'Urumqi, China', 'manual')

ON CONFLICT (address) DO NOTHING;