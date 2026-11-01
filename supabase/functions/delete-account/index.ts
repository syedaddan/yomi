import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return respond({ error: 'Sign in before deleting your account.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond({ error: 'Account deletion is not configured on the server.' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return respond({ error: 'Your session is invalid. Sign in again and retry.' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const bucket of ['custom-audio', 'profile-avatars']) {
    while (true) {
      const { data: objects, error: listError } = await adminClient.storage
        .from(bucket)
        .list(user.id, { limit: 1000 });
      if (listError) return respond({ error: `Could not remove account files: ${listError.message}` }, 500);
      const paths = (objects || [])
        .filter((object) => object.id)
        .map((object) => `${user.id}/${object.name}`);
      if (!paths.length) break;
      const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
      if (removeError) return respond({ error: `Could not remove account files: ${removeError.message}` }, 500);
      if (objects.length < 1000) break;
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) return respond({ error: `Could not delete the account: ${deleteError.message}` }, 500);
  return respond({ message: 'Your account and associated data were deleted.' });
});
