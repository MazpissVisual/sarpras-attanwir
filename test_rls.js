const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // Login as test@gmail.com
  const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'test@gmail.com',
    password: 'password123' // assuming it's default password, let me try
  });
  
  if (loginErr) { console.log('Login failed:', loginErr.message); return; }
  
  const { data: profiles, error: pErr } = await supabase.from('user_profiles').select('*');
  console.log('Total returned rows:', profiles?.length, 'Profiles:', profiles, pErr);
}
run();
