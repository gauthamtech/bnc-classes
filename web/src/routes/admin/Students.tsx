import { useEffect, useRef, useState } from 'react';
import { supabase, type Course, type Profile } from '../../lib/supabase';
import { useAuth, MAX_DEVICES } from '../../lib/useAuth';
import { IconSearch, IconChevronDown, IconDeviceReset } from '../../components/Icons';

type Enrolment = { id: string; user_id: string; course_id: string; revoked_at: string | null };
type Device = { id: string; user_id: string; label: string | null; last_seen_at: string };

/**
 * Devices are stored as a raw user-agent string, which is unreadable. Pull the
 * handset model out of it so the admin sees "SM-A536E" rather than 80
 * characters of Mozilla boilerplate — it is what the student will say when
 * asked which phone they are on.
 */
function deviceName(label: string | null) {
  if (!label) return 'Unknown device';
  const android = label.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|\))/i);
  if (android) return android[1].trim();
  if (/iPhone/i.test(label)) return 'iPhone';
  if (/iPad/i.test(label)) return 'iPad';
  if (/Windows/i.test(label)) return 'Windows PC';
  if (/Macintosh|Mac OS/i.test(label)) return 'Mac';
  if (/Linux/i.test(label)) return 'Linux';
  return 'Unknown device';
}

/** "Today, 10:45 AM" / "Yesterday" / "12 Aug" — relative where it helps. */
function lastActive(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);

  if (sameDay) {
    return `Today, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function Students() {
  const { profile: me } = useAuth();
  const [students, setStudents] = useState<Profile[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Searching and paging happen in Postgres, not in the browser. Loading
   * every profile, enrolment and device to filter them here worked at ten
   * students and would have fetched thousands of rows at a thousand.
   */
  const PAGE = 50;

  /** Search responses can arrive out of order — "Ram" is slower to answer than
   *  "R" if the network hiccups, and the older reply would then overwrite the
   *  newer one. Only the most recent request is allowed to set state. */
  const reqRef = useRef(0);

  async function load(query = q) {
    const seq = ++reqRef.current;
    const needle = query.trim();

    let sel = supabase.from('profiles').select('*');
    if (needle) {
      const like = `%${needle}%`;
      sel = sel.or(
        `student_code.ilike.${like},full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`
      );
    }
    const p = await sel.order('created_at', { ascending: false }).limit(PAGE);
    if (seq !== reqRef.current) return;
    if (p.error) { setError(p.error.message); setStudents([]); return; }

    const rows = p.data as Profile[];
    const ids = rows.map((r) => r.id);

    // Only the people actually on screen.
    const [c, e, d] = await Promise.all([
      supabase.from('courses').select('*').order('position'),
      ids.length
        ? supabase.from('enrollments').select('id,user_id,course_id,revoked_at').in('user_id', ids)
        : Promise.resolve({ data: [], error: null } as any),
      ids.length
        ? supabase.from('devices').select('id,user_id,label,last_seen_at').in('user_id', ids)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (seq !== reqRef.current) return;
    if (c.error) { setError(c.error.message); return; }

    setStudents(rows);
    setCourses(c.data as Course[]);
    setEnrolments((e.data as Enrolment[]) ?? []);
    setDevices((d.data as Device[]) ?? []);
  }

  // Debounced, so typing a name does not fire a query per keystroke. This also
  // covers the first load, because the effect runs on mount with an empty
  // query — a separate mount effect just fetched the same rows twice.
  useEffect(() => {
    const t = setTimeout(() => { void load(q); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const filtered = students;

  function activeFor(userId: string) {
    return enrolments.filter((e) => e.user_id === userId && !e.revoked_at).map((e) => e.course_id);
  }

  async function toggle(userId: string, courseId: string, on: boolean) {
    const key = userId + courseId;
    setBusyKey(key);
    setError(null);

    if (on) {
      // upsert clears a previous revoke, because (user_id, course_id) is unique
      const { error } = await supabase
        .from('enrollments')
        .upsert(
          { user_id: userId, course_id: courseId, granted_by: me?.id ?? null, revoked_at: null },
          { onConflict: 'user_id,course_id' }
        );
      if (error) setError(error.message);
    } else {
      const { error } = await supabase
        .from('enrollments')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('course_id', courseId);
      if (error) setError(error.message);
    }

    await load();
    setBusyKey(null);
  }

  async function resetDevices(userId: string, name: string) {
    if (!confirm(`Sign ${name || 'this student'} out of all devices? They can sign in again straight away.`)) return;
    setError(null);
    const { error } = await supabase.from('devices').delete().eq('user_id', userId);
    if (error) setError(error.message);
    await load();
  }

  return (
    <div className="shell page">
      <h2 className="page__title">Admin — Students</h2>
      <p className="page__sub">
        {students === null
          ? 'Loading…'
          : students.length < PAGE
            ? `${students.length} ${students.length === 1 ? 'student' : 'students'} total`
            : `Showing the first ${PAGE}. Search to narrow it down.`}
      </p>

      {error && <div className="notice notice--bad">{error}</div>}

      <div className="search">
        <span className="search__i"><IconSearch size={20} /></span>
        <input
          id="q" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, code, phone…" autoComplete="off"
          aria-label="Search students"
        />
      </div>

      {courses.length === 0 && students !== null && (
        <div className="notice notice--bad">
          No courses exist yet. Create one in Courses before you can enrol anybody.
        </div>
      )}

      <div className="stack">
        {filtered?.map((s) => {
          const active = activeFor(s.id);
          const open = openId === s.id;
          const mine = devices.filter((d) => d.user_id === s.id);

          return (
            <div className="srow" key={s.id} data-open={open}>
              <button
                className="srow__head"
                onClick={() => setOpenId(open ? null : s.id)}
                aria-expanded={open}
              >
                <span className="srow__main">
                  <span className="srow__name">
                    {s.full_name || 'No name yet'}
                    {s.role === 'admin' && <em className="srow__tag">admin</em>}
                  </span>
                  <span className="srow__code">{s.student_code}</span>
                  <span className="srow__meta">
                    {s.email}{s.phone ? ` · ${s.phone}` : ''}
                  </span>
                </span>

                <span className="srow__right">
                  <span className="chip">
                    {active.length} {active.length === 1 ? 'Course' : 'Courses'}
                  </span>
                  <span className="srow__caret"><IconChevronDown size={20} /></span>
                </span>
              </button>

              {open && (
                <div className="srow__body">
                  <h4 className="subh">Enrolled courses</h4>
                  <div className="checks">
                    {courses.map((c) => {
                      const on = active.includes(c.id);
                      const key = s.id + c.id;
                      return (
                        <label className="check" key={c.id} data-hidden={!c.is_published}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={busyKey === key}
                            onChange={(e) => void toggle(s.id, c.id, e.target.checked)}
                          />
                          <span className="check__t">
                            <strong>Grade {c.grade}</strong> {c.title}
                          </span>
                          {/* Enrolling somebody into a hidden course leaves them
                              staring at "No classes yet" with no explanation.
                              Say so here, where the mistake is made. */}
                          {!c.is_published && <span className="chip chip--warn">Hidden</span>}
                        </label>
                      );
                    })}
                  </div>

                  <h4 className="subh">
                    Device security
                    <span className="chip">{mine.length}/{MAX_DEVICES} active</span>
                  </h4>

                  {mine.length === 0 ? (
                    <p className="muted">No devices signed in.</p>
                  ) : (
                    <div className="devs">
                      {mine.map((d) => (
                        <div className="dev" key={d.id}>
                          <span className="dev__n">{deviceName(d.label)}</span>
                          <span className="dev__t">Last active: {lastActive(d.last_seen_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="btn btn--danger btn--block btn--icon"
                    onClick={() => void resetDevices(s.id, s.full_name ?? '')}
                    disabled={mine.length === 0}
                  >
                    <IconDeviceReset size={18} />
                    Reset all devices
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered !== null && filtered.length === 0 && (
        <p className="muted">Nobody matches that search.</p>
      )}
    </div>
  );
}
