-- 1. Standardization of Roles in database
UPDATE public.user_profiles
SET role = 'superadmin'
WHERE lower(replace(role, ' ', '')) = 'superadmin' OR role = 'Super Admin';

-- 2. Drop the constraint if it exists
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- 3. Replace kepsek with pimpinan
UPDATE public.user_profiles SET role = 'pimpinan' WHERE role = 'kepala_sekolah';

-- 4. Automatically normalize role for new users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  raw_role TEXT;
  assigned_role TEXT;
BEGIN
  -- Superadmin bootstrap
  IF new.email = 'test@gmail.com' THEN
    assigned_role := 'superadmin';
  ELSE
    raw_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
    -- Normalize format
    IF lower(replace(raw_role, ' ', '')) = 'superadmin' THEN
      assigned_role := 'superadmin';
    ELSE
      assigned_role := raw_role;
    END IF;
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, role, division, access_rights)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    assigned_role,
    new.raw_user_meta_data->>'division',
    COALESCE(new.raw_user_meta_data->'access_rights', '[]'::jsonb)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
