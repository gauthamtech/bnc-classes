import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';

type Video = {
  id: string; title: string; position: number;
  duration_sec: number | null; status: string; is_free_preview: boolean;
};
type CourseFull = { id: string; grade: string; title: string; description: string | null };

export function fmtDuration(sec: number | null) {
  if (!sec) return null;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * "Motion - 1" and "Motion - 2" belong together. The name carries the
 * grouping, so nobody has to file videos into folders as well as name
 * them. Anything without a dash falls into "Other lessons" rather than
 * being hidden.
 */
export function groupByPrefix(videos: Video[]) {
  const groups = new Map<string, Video[]>();
  for (const v of videos) {
    const m = v.title.match(/^(.+?)\s*[-–—]\s*\d+\s*$/);
    const key = m ? m[1].trim() : '__other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }
  const named = [...groups.entries()].filter(([k]) => k !== '__other');
  const other = groups.get('__other');
  if (other) named.push(['Other lessons', other]);
  return named;
}

export function Course() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [course, setCourse] = useState<CourseFull | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      // RLS returns nothing at all if this student is not enrolled.
      const [c, l, p] = await Promise.all([
        supabase.from('courses').select('id,grade,title,description').eq('id', id).maybeSingle(),
        // status is filtered here as well as in RLS. An admin passes the
        // policy's is_admin() branch, so without this the student-facing page
        // would show them drafts and a video count no student ever sees —
        // which is exactly how a "hidden" video gets missed in testing.
        supabase.from('lessons')
          .select('id,title,position,duration_sec,status,is_free_preview')
          .eq('course_id', id)
          .eq('status', 'ready')
          .order('position'),
        // user_id is filtered explicitly, not left to RLS: the progress policy
        // is `user_id = auth.uid() or is_admin()`, so an admin session would
        // otherwise collect every student's ticks and show them as its own.
        supabase.from('progress').select('lesson_id')
          .eq('user_id', profile?.id ?? '')
          .not('completed_at', 'is', null),
      ]);

      if (!alive) return;
      if (c.error) setError(c.error.message);
      setCourse((c.data as CourseFull) ?? null);
      setVideos((l.data as Video[]) ?? []);
      setDone(new Set((p.data ?? []).map((r: any) => r.lesson_id)));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, profile?.id]);

  if (loading) return <div className="shell page"><p className="muted">Loading…</p></div>;

  if (error) return (
    <div className="shell page"><div className="notice notice--bad">{error}</div></div>
  );

  if (!course) return (
    <div className="shell page">
      <h2>Not available</h2>
      <p className="page__sub">
        This class is not open to your account. If you have paid, ask BNC to enrol you.
      </p>
      <Link className="btn btn--ghost" to="/">Back to your classes</Link>
    </div>
  );

  const total = videos.length;
  const watched = videos.filter((v) => done.has(v.id)).length;
  const groups = groupByPrefix(videos);

  return (
    <div className="shell page">
      <Link className="backlink" to="/">Your classes</Link>

      <h2>{course.title}</h2>
      <p className="page__sub">
        Grade {course.grade} · {total} {total === 1 ? 'video' : 'videos'}
        {total > 0 && ` · ${watched} watched`}
      </p>

      {total > 0 && (
        <div className="bar" aria-label={`${watched} of ${total} videos watched`}>
          <span style={{ width: `${Math.round((watched / total) * 100)}%` }} />
        </div>
      )}

      {total === 0 && <p className="muted">No videos have been added to this class yet.</p>}

      <div className="chapters">
        {groups.map(([label, items]) => (
          <section className="chapter" key={label}>
            <h3 className="chapter__h">
              {label}
              <span className="chapter__count">{items.length}</span>
            </h3>

            <ol className="lessons">
              {items.map((v) => {
                const ready = v.status === 'ready';
                const body = (
                  <>
                    <span className="lesson__tick" data-done={done.has(v.id)} aria-hidden="true" />
                    <span className="lesson__main">
                      <span className="lesson__title">{v.title}</span>
                      <span className="lesson__meta">
                        {ready
                          ? fmtDuration(v.duration_sec) ?? 'Ready to watch'
                          : v.status === 'processing' ? 'Processing…' : 'Coming soon'}
                        {v.is_free_preview && ' · free preview'}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={v.id}>
                    {ready
                      ? <Link className="lesson" to={`/lesson/${v.id}`}>{body}</Link>
                      : <span className="lesson lesson--off">{body}</span>}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
