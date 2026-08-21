import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SECRET_KEY as string // use the service role key on the backend, not the public anon key
);