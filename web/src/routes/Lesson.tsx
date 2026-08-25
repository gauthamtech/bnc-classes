import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import { fmtDuration } from './Course';
import { storageKeyFor } from '../components/Uploader';

type LessonRow = {
  id: string; title: string; position: number;
  duration_sec: number | null; status: string;
  course: { id: string; grade: string; title: string };
};

/**
 * Signs a short-lived URL for the video.
 *
 * Today that comes from Supabase Storage, where a policy on the bucket
 * applies the same enrolment rule as the rest of the app: Postgres decides
 * whether this student may sign a URL for this file, not the browser.
 *
 * When the videos move to R2, swap the body for the `play` Edge Function
 * (already written in supabase/functions/play). Nothing else changes.
 */
const URL_TTL_SECONDS = 60 * 60 * 2;

async function getPlaybackUrl(lessonId: string): Promise<string> {
  const { data, error } = await supabase
    .storage
    .from('videos')
    .createSignedUrl(storageKeyFor(lessonId), URL_TTL_SECONDS);

  if (error || !data?.signedUrl) throw new Error('NOT_READY');
  return data.signedUrl;
}

export function Lesson() {
  const { id } = useParams();
  const { profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  // Once a lesson is finished it stays finished. Held in a ref, not state, so
  // the timeupdate handler reads it without re-rendering the player.
  const completedAtRef = useRef<string | null>(null);
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // Route param changes without remounting the component, so per-lesson
    // state has to be cleared by hand or it leaks into the next video.
    completedAtRef.current = null;
    lastSave.current = 0;
    setResumeAt(null);
    setSrc(null);
    setVideoError(null);

    (async () => {
      const { data } = await supabase
        .from('lessons')
        .select('id,title,position,duration_sec,status,course:courses(id,grade,title)')
        .eq('id', id)
        .maybeSingle();

      if (!alive) return;
      setLesson((data as unknown as LessonRow) ?? null);
      setLoading(false);

      // Must filter by user_id. The progress policy is
      // `user_id = auth.uid() or is_admin()`, so without it an admin gets one
      // row per student who has watched this lesson — and maybeSingle() throws
      // outright the moment that is more than one.
      const prog = await supabase
        .from('progress').select('seconds_watched, completed_at')
        .eq('lesson_id', id)
        .eq('user_id', profile?.id ?? '')
        .maybeSingle();
      if (alive) {
        setResumeAt(prog.data?.seconds_watched ?? null);
        completedAtRef.current = prog.data?.completed_at ?? null;
      }

      if (data) {
        try {
          const url = await getPlaybackUrl(id!);
          if (alive) setSrc(url);
        } catch {
          if (alive) setVideoError('NOT_READY');
        }
      }
    })();
    return () => { alive = false; };
  }, [id, profile?.id]);

  // Saved every 15 seconds rather than only at the end, so closing the app
  // mid-lesson does not lose the place. Marked complete at 90%, because
  // nobody watches the credits.
  const lastSave = useRef(0);

  async function save(seconds: number) {
    if (!profile) return;
    await supabase.from('progress').upsert(
      {
        user_id: profile.id, lesson_id: id!,
        seconds_watched: Math.round(seconds),
        // Never clears a completion. Rewatching a finished lesson from the
        // start used to send null here and silently remove the tick. The
        // original timestamp is kept rather than refreshed.
        completed_at: completedAtRef.current,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    );
  }

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration || !profile) return;

    // timeupdate fires roughly four times a second. The throttle must apply
    // to every save except the single one that records completion, or the
    // last 10% of every video becomes hundreds of writes per student.
    const reached = v.currentTime / v.duration >= 0.9;
    const justCompleted = reached && !completedAtRef.current;
    const now = Date.now();
    if (!justCompleted && now - lastSave.current < 15000) return;

    if (justCompleted) completedAtRef.current = new Date().toISOString();
    lastSave.current = now;
    void save(v.currentTime);
  }

  // Pick up where they stopped. Anything in the last 20 seconds starts over.
  function onLoadedMetadata() {
    const v = videoRef.current;
    if (!v || !resumeAt) return;
    if (resumeAt > 5 && resumeAt < v.duration - 20) v.currentTime = resumeAt;
  }

  if (loading) return <div className="shell page"><p className="muted">Loading…</p></div>;

  if (!lesson) return (
    <div className="shell page">
      <h2>Not available</h2>
      <p className="page__sub">This lesson is not open to your account.</p>
      <Link className="btn btn--ghost" to="/">Back to your classes</Link>
    </div>
  );

  const course = lesson.course;

  return (
    <div className="shell page">
      <Link className="backlink" to={`/course/${course.id}`}>{course.title}</Link>

      <div className="player">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            onContextMenu={(e) => e.preventDefault()}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
          />
        ) : (
          <div className="player__empty">
            <p>
              {videoError === 'NOT_READY'
                ? 'This lesson has no video attached yet.'
                : 'Preparing the video…'}
            </p>
          </div>
        )}
      </div>

      <h2>{lesson.title}</h2>
      <p className="page__sub">
        Grade {course.grade} · {course.title}
        {lesson.duration_sec ? ` · ${fmtDuration(lesson.duration_sec)}` : ''}
      </p>

      <Link className="btn btn--ghost btn--block" to={`/course/${course.id}`}>
        Back to all lessons
      </Link>
    </div>
  );
}
