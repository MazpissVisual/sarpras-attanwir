ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
UPDATE public.user_profiles SET role = 'pimpinan' WHERE role = 'kepala_sekolah';
