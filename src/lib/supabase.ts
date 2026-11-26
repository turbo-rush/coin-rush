import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Supabase is optional during local setup. The app can continue running
 * without credentials; configure the two VITE_ variables in the deployment
 * environment to enable the client.
 */
export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;

export const isSupabaseConfigured = supabase !== null;
