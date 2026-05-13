import { createClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const createServerClient = () => {
  return createClient(supabaseUrl!, supabaseKey!);
};