import { CORS, json, presign, callerProfile } from '../_shared/r2.ts';

/**
 * play — hands a signed, expiring video URL to an enrolled student.
 *
 * The check happens here, on the server, with the service key. The browser
 * never learns the storage key, and the URL it does get stops working in
 * two hours. Row level security already protects the tables; this protects
 * the file itself.
 */
const URL_TTL_SECONDS = 60 * 60 * 2;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const caller = await callerProfile(req);
    if (!caller) return json({ error: 'not signed in' }, 401);

    const { lesson_id } = await req.json().catch(() => ({}));
    if (!lesson_id) return json({ error: 'lesson_id required' }, 400);

    const { admin, profile } = caller;

    const { data: lesson } = await admin
      .from('lessons')
      .select('id, course_id, status, is_free_preview')
      .eq('id', lesson_id)
      .maybeSingle();

    if (!lesson) return json({ error: 'no such lesson' }, 404);
    if (lesson.status !== 'ready') return json({ error: 'not ready' }, 409);

    // Admins and free previews skip the enrolment check. Everyone else
    // must hold a live, unrevoked, unexpired enrolment in the course.
    let allowed = profile.role === 'admin' || lesson.is_free_preview;

    if (!allowed) {
      const { data: enrolment } = await admin
        .from('enrollments')
        .select('id, expires_at, revoked_at')
        .eq('user_id', profile.id)
        .eq('course_id', lesson.course_id)
        .is('revoked_at', null)
        .maybeSingle();

      allowed = Boolean(
        enrolment && (!enrolment.expires_at || new Date(enrolment.expires_at) > new Date())
      );
    }

    if (!allowed) return json({ error: 'not enrolled' }, 403);

    const { data: source } = await admin
      .from('lesson_sources')
      .select('storage_key')
      .eq('lesson_id', lesson_id)
      .maybeSingle();

    if (!source?.storage_key) return json({ error: 'no video attached' }, 404);

    const url = await presign(source.storage_key, 'GET', URL_TTL_SECONDS);
    return json({ url, expires_in: URL_TTL_SECONDS });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
