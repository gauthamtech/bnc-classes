import { CORS, json, presign, callerProfile } from '../_shared/r2.ts';

/**
 * sign-upload — admin only.
 *
 * Returns a one-off URL the browser can PUT the video straight to. The file
 * never passes through this function, so a 2 GB upload costs no function
 * time and hits no request size limit.
 *
 * action: 'start'  -> presigned PUT url + the storage key
 * action: 'finish' -> records the key against the lesson and marks it ready
 */
const UPLOAD_TTL_SECONDS = 60 * 60 * 6; // long uploads on Indian broadband

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const caller = await callerProfile(req);
    if (!caller) return json({ error: 'not signed in' }, 401);

    const { admin, profile } = caller;
    if (profile.role !== 'admin') return json({ error: 'admins only' }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, lesson_id } = body;
    if (!lesson_id) return json({ error: 'lesson_id required' }, 400);

    const { data: lesson } = await admin
      .from('lessons')
      .select('id, course_id')
      .eq('id', lesson_id)
      .maybeSingle();
    if (!lesson) return json({ error: 'no such lesson' }, 404);

    if (action === 'start') {
      const ext = String(body.filename ?? '').split('.').pop()?.toLowerCase() ?? 'mp4';
      const safeExt = /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'mp4';
      const key = `courses/${lesson.course_id}/${lesson_id}.${safeExt}`;

      const url = await presign(key, 'PUT', UPLOAD_TTL_SECONDS);

      await admin.from('lessons').update({ status: 'uploading' }).eq('id', lesson_id);
      return json({ url, key, expires_in: UPLOAD_TTL_SECONDS });
    }

    if (action === 'finish') {
      const { key, size_bytes, duration_sec } = body;
      if (!key) return json({ error: 'key required' }, 400);

      await admin.from('lesson_sources').upsert(
        { lesson_id, storage_key: key, size_bytes: size_bytes ?? null },
        { onConflict: 'lesson_id' }
      );

      await admin
        .from('lessons')
        .update({
          status: 'ready',
          duration_sec: duration_sec ? Math.round(duration_sec) : null,
        })
        .eq('id', lesson_id);

      return json({ ok: true });
    }

    if (action === 'fail') {
      await admin.from('lessons').update({ status: 'failed' }).eq('id', lesson_id);
      return json({ ok: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
