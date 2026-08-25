import { createClient } from '@supabase/supabase-js';

/**
 * Only the anon key ever appears here. It is safe in the client:
 * every table is protected by row level security, so this key can
 * read exactly what the signed-in student is allowed to read.
 *
 * The service_role key must NEVER appear in this project. It belongs
 * only in Supabase Edge Function secrets.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export type Role = 'student' | 'admin';

export type Profile = {
  id: string;
  student_code: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
};

export type Course = {
  id: string;
  grade: string;
  title: string;
  description: string | null;
  position: number;
  is_published: boolean;
};
