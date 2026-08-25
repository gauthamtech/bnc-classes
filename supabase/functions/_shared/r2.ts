import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Shared R2 + Supabase helpers for the two video functions.
 *
 * Every secret lives in Edge Function environment variables and never
 * reaches the browser. That is the whole security model: the bucket is
 * private, and the only way to a file is a URL this server signs after
 * checking who is asking.
 */

export const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
export const R2_BUCKET = Deno.env.get('R2_BUCKET')!;
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;

export const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});

export function objectUrl(key: string) {
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}

/** Presign a URL that works without any credentials, for a limited time. */
export async function presign(key: string, method: 'GET' | 'PUT', seconds: number) {
  const url = new URL(objectUrl(key));
  url.searchParams.set('X-Amz-Expires', String(seconds));
  const signed = await r2.sign(new Request(url, { method }), {
    aws: { signQuery: true, allHeaders: false },
  });
  return signed.url;
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Resolves the caller from their bearer token, then reads their profile with
 * the service key. Returns null when the token is missing or invalid.
 */
export async function callerProfile(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData.user) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .maybeSingle();

  return profile ? { admin, profile } : null;
}
