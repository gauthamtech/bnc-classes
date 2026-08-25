import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Course } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import { IconChevronRight, IconPlay } from '../components/Icons';

type EnrolledCourse = Course & { lesson_count: number; watched: number };

type Resume = {
  lessonId: string;
  title: string;
  grade: string;
  courseTitle: string;
  seconds: number;
  duration: number | null;
};

/** "12:04 remaining" — minutes and seconds, because a lesson is rarely hours. */
function fmtRemaining(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')} remaining`;
}

export function Home() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<EnrolledCourse[] | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;

    let alive = true;

    (async () => {
      // Filter by user_id explicitly. RLS alone is NOT enough here: the policy
      // is `user_id = auth.uid() or is_admin()`, so an admin session gets every
      // enrolment row in the system and the same course renders once per
      // enrolled student. RLS is the security boundary, not the query.
      const [enr, done, last] = await Promise.all([
        supabase
          .from('enrollments')
          .select('course:courses(*, lessons(count))')
          .eq('user_id', uid)
          .is('revoked_at', null),

        // Only completed rows, and only the course id — this is a count, so
        // pulling titles and timestamps would be bandwidth for nothing.
        supabase
          .from('progress')
          .select('lesson:lessons!inner(course_id)')
          .eq('user_id', uid)
          .not('completed_at', 'is', null),

        // The single most recent unfinished lesson. !inner drops rows whose
        // lesson RLS filtered out — a video since hidden, or a course
        // unpublished — so a stale card can never point at something gone.
        supabase
          .from('progress')
          .select('seconds_watched, lesson:lessons!inner(id, title, duration_sec, course:courses!inner(grade, title))')
          .eq('user_id', uid)
          .is('completed_at', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!alive) return;

      if (enr.error) {
        setError(enr.error.message);
        setCourses([]);
        return;
      }

      const watchedByCourse = new Map<string, number>();
      for (const row of (done.data ?? []) as any[]) {
        const cid = row.lesson?.course_id;
        if (cid) watchedByCourse.set(cid, (watchedByCourse.get(cid) ?? 0) + 1);
      }

      const rows = (enr.data ?? [])
        .map((r: any) => r.course)
        .filter(Boolean)
        .map((c: any) => ({
          ...c,
          lesson_count: c.lessons?.[0]?.count ?? 0,
          watched: watchedByCourse.get(c.id) ?? 0,
        }))
        .sort((a: EnrolledCourse, b: EnrolledCourse) => a.position - b.position);

      setCourses(rows);

      const l = (last.data as any)?.lesson;
      // Under five seconds is a tap, not a watch. Resuming from it would be
      // noise at the top of the screen.
      if (l && ((last.data as any).seconds_watched ?? 0) > 5) {
        setResume({
          lessonId: l.id,
          title: l.title,
          grade: l.course?.grade ?? '',
          courseTitle: l.course?.title ?? '',
          seconds: (last.data as any).seconds_watched ?? 0,
          duration: l.duration_sec ?? null,
        });
      } else {
        setResume(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile?.id]);

  const firstName = profile?.full_name?.split(' ')[0];
  const isAdmin = profile?.role === 'admin';

  const pct = resume?.duration
    ? Math.min(100, Math.round((resume.seconds / resume.duration) * 100))
    : null;

  return (
    <div className="shell page">
      <h2 className="page__title">{firstName ? `Hello, ${firstName}` : 'Your classes'}</h2>
      <p className="page__sub">
        {courses === null
          ? 'Loading your classes…'
          : courses.length > 0
            ? 'Pick up where you stopped.'
            : ' '}
      </p>

      {error && <div className="notice notice--bad">{error}</div>}

      {/* Continue watching — the answer to "what do I watch next", before any tap. */}
      {resume && (
        <section className="sec">
          <h3 className="sec__h">Continue watching</h3>
          <Link className="cont" to={`/lesson/${resume.lessonId}`}>
            <div className="cont__art">
              <div className="cont__over">
                <div className="cont__id">
                  {resume.grade && (
                    <span className="cont__eyebrow">Grade {resume.grade} Physics</span>
                  )}
                  <span className="cont__title">{resume.title}</span>
                </div>
                <span className="cont__play"><IconPlay size={22} /></span>
              </div>
            </div>
            <div className="cont__foot">
              <div className="cont__meta">
                <span>
                  {resume.duration
                    ? fmtRemaining(resume.duration - resume.seconds)
                    : resume.courseTitle}
                </span>
                {pct !== null && <span className="cont__pct">{pct}%</span>}
              </div>
              <div className="bar">
                <span style={{ width: `${pct ?? 0}%` }} />
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* An admin has no enrolments of their own, and telling them to get
          approved by themselves is nonsense. Point them at the panel. */}
      {courses !== null && courses.length === 0 && isAdmin && (
        <div className="empty">
          <h3>You are signed in as an admin</h3>
          <p>
            Admin accounts are not enrolled in classes. Create a course, then
            enrol students into it.
          </p>
          <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
            <Link className="btn btn--primary btn--block" to="/admin/courses">Create a course</Link>
            <Link className="btn btn--ghost btn--block" to="/admin">Manage students</Link>
          </div>
        </div>
      )}

      {courses !== null && courses.length === 0 && !isAdmin && (
        <div className="empty">
          <h3>No classes yet</h3>
          <p>
            Your account is ready. Once BNC enrols you, your classes appear
            here automatically.
          </p>

          <div className="code">
            <span className="code__label">Give this code to BNC</span>
            <span className="code__value">{profile?.student_code ?? '—'}</span>
          </div>

          <p className="muted">
            Read the code out on the phone, or send it on WhatsApp.
          </p>
        </div>
      )}

      {courses !== null && courses.length > 0 && (
        <section className="sec">
          <h3 className="sec__h">Your classes</h3>
          <div className="courses">
            {courses.map((c) => {
              const p = c.lesson_count > 0
                ? Math.round((c.watched / c.lesson_count) * 100)
                : 0;
              return (
                <Link className="course" key={c.id} to={`/course/${c.id}`}>
                  <div className="course__top">
                    <div>
                      <span className="course__grade">Grade {c.grade}</span>
                      <span className="course__title">{c.title}</span>
                    </div>
                    <span className="course__go"><IconChevronRight size={20} /></span>
                  </div>

                  <div className="course__prog">
                    <div className="course__meta">
                      <span>{c.watched} of {c.lesson_count} watched</span>
                      <span className={p === 100 ? 'is-done' : undefined}>{p}%</span>
                    </div>
                    <div className="bar"><span style={{ width: `${p}%` }} /></div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
