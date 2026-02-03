-- =============================================
-- Add WMS Roles to Users
-- =============================================

-- Add warehouse_manager role to admin user (example)
INSERT INTO public.user_roles (user_id, role) 
VALUES 
  ('YOUR_USER_ID_HERE', 'warehouse_manager'),
  ('YOUR_USER_ID_HERE', 'storekeeper');

-- Or add to existing admin user
-- First get the user ID from auth.users
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';

-- Then add the role (replace with actual user_id)
INSERT INTO public.user_roles (user_id, role) 
VALUES 
  ('ACTUAL_USER_ID_FROM_ABOVE', 'warehouse_manager');

-- Check existing roles
SELECT 
  u.email,
  ur.role,
  ur.created_at
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.email, ur.role;

-- View all available roles
SELECT unnest(enum_range(NULL::app_role)) as all_roles;
