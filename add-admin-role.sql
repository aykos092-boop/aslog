-- Добавить роль admin для пользователя
-- UID пользователя: uIgIpjzRKreOuhx8ixDaAeB3kNs1

INSERT INTO public.user_roles (
  user_id, 
  role
) VALUES (
  'uIgIpjzRKreOuhx8ixDaAeB3kNs1', 
  'admin'
) ON CONFLICT (user_id, role) DO NOTHING;

-- Проверить что роль добавлена
SELECT * FROM public.user_roles 
WHERE user_id = 'uIgIpjzRKreOuhx8ixDaAeB3kNs1' AND role = 'admin';
