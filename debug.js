
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
  console.log('Total Auth Users:', users?.users?.length);
  
  const { data: profiles, error: pErr } = await supabase.from('user_profiles').select('*');
  console.log('Total User Profiles:', profiles?.length, pErr);
  
  console.log('Profiles data:', profiles);
}
run();
