import { useEffect, useState, type FormEvent } from 'react';
import { supabase, type Course } from '../../lib/supabase';
import { groupByPrefix } from '../Course';
import { Uploader, storageKeyFor } from '../../components/Uploader';
import {
  IconPlus, IconChevronDown, IconEye, IconEyeOff, IconTrash,
} from '../../components/Icons';

type Video = {
  id: string; course_id: string; title: string; position: number;
  duration_sec: number | null; status: string; is_free_preview: boolean;
};

const GRADES = ['9', '10', '11', '12'];

export function Courses() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [grade, setGrade] = useState('9');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [c, l] = await Promise.all([
      supabase.from('courses').select('*').order('grade').order('position'),
      supabase.from('lessons')
        .select('id,course_id,title,position,duration_sec,status,is_free_preview')
        .order('position'),
    ]);
    if (c.error || l.error) {
      setError((c.error ?? l.error)!.message);
      setCourses([]);
      return;
    }
    setCourses(c.data as Course[]);
    setVideos(l.data as Video[]);
  }

  useEffect(() => { void load(); }, []);

  async function addCourse(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setError(null);
    const { error } = await supabase.from('courses').insert({
      grade, title: title.trim(), position: courses?.length ?? 0, is_published: true,
    });
    // 23505 is the unique index from 06_prevent_duplicate_courses.sql. The raw
    // Postgres text is unreadable to him, so say what actually happened.
    if (error) {
      setError(error.code === '23505'
        ? `Grade ${grade} already has a course called "${title.trim()}".`
        : error.message);
    } else {
      setTitle('');
    }
    await load(); setBusy(false);
  }

  async function togglePublished(c: Course) {
    setError(null);
    const { error } = await supabase.from('courses')
      .update({ is_published: !c.is_published }).eq('id', c.id);
    if (error) setError(error.message);
    await load();
  }

  async function addVideo(courseId: string, value: string) {
    const count = videos.filter((v) => v.course_id === courseId).length;
    const { error } = await supabase.from('lessons')
      .insert({ course_id: courseId, title: value.trim(), position: count, status: 'draft' });
    if (error) setError(error.message);
    await load();
  }

  // Until upload exists, this is how a video becomes visible to students.
  async function toggleReady(v: Video) {
    const { error } = await supabase.from('lessons')
      .update({ status: v.status === 'ready' ? 'draft' : 'ready' }).eq('id', v.id);
    if (error) setError(error.message);
    await load();
  }

  async function remove(v: Video) {
    if (!confirm(`Delete "${v.title}"? This cannot be undone.`)) return;
    // Storage first. Deleting only the row leaves the file behind, silently
    // eating the 1 GB free quota with something no longer reachable.
    await supabase.storage.from('videos').remove([storageKeyFor(v.id)]);
    const { error } = await supabase.from('lessons').delete().eq('id', v.id);
    if (error) setError(error.message);
    await load();
  }

  /** Deleting a course cascades to its lessons and every enrolment into it,
   *  so the count goes in the prompt. Storage is cleared first, for the same
   *  reason as remove() above. */
  async function removeCourse(c: Course) {
    const mine = videos.filter((v) => v.course_id === c.id);
    const ok = confirm(
      `Delete "Grade ${c.grade} · ${c.title}"?\n\n` +
      `This also deletes ${mine.length} ${mine.length === 1 ? 'video' : 'videos'} ` +
      `and un-enrols every student from it. It cannot be undone.\n\n` +
      `To simply take it off students' screens instead, use "Hide course from students".`
    );
    if (!ok) return;

    setError(null);
    if (mine.length > 0) {
      await supabase.storage.from('videos').remove(mine.map((v) => storageKeyFor(v.id)));
    }
    const { error } = await supabase.from('courses').delete().eq('id', c.id);
    if (error) setError(error.message);
    setOpenCourse(null);
    await load();
  }

  return (
    <div className="shell page">
      <h2 className="page__title">Course structure</h2>
      <p className="page__sub">
        Name videos like <strong>Motion - 1</strong>, <strong>Motion - 2</strong>. Students see
        them grouped by that name automatically.
      </p>

      {error && <div className="notice notice--bad">{error}</div>}

      <form onSubmit={addCourse} className="panel newcourse">
        <div className="field">
          <label htmlFor="grade">Grade level</label>
          <select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">Course title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="e.g. Full Year Physics" autoComplete="off" />
        </div>
        <button className="btn btn--primary btn--block btn--icon" disabled={busy || !title.trim()}>
          <IconPlus size={18} />
          {busy ? 'Adding…' : 'Create course'}
        </button>
      </form>

      <div className="stack">
        {courses?.map((c) => {
          const mine = videos.filter((v) => v.course_id === c.id);
          const open = openCourse === c.id;
          const groups = groupByPrefix(mine as any);

          return (
            <div className="srow" key={c.id} data-open={open}>
              <button className="srow__head" onClick={() => setOpenCourse(open ? null : c.id)} aria-expanded={open}>
                <span className="srow__caret srow__caret--lead"><IconChevronDown size={20} /></span>
                <span className="srow__main">
                  <span className="srow__code">Grade {c.grade}</span>
                  <span className="srow__name">{c.title}</span>
                  <span className="srow__meta">
                    {mine.length} {mine.length === 1 ? 'video' : 'videos'}
                    {groups.length > 0 && ` · ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`}
                  </span>
                </span>
                {!c.is_published && <span className="chip chip--warn">Hidden</span>}
              </button>

              {open && (
                <div className="srow__body">
                  {groups.map(([label, items]) => (
                    <div className="chblock" key={label}>
                      <div className="chblock__head">
                        <span className="chblock__title">{label}</span>
                        <span className="chblock__count">{items.length}</span>
                      </div>
                      <div className="chblock__body">
                        {items.map((v: any) => {
                          const ready = v.status === 'ready';
                          return (
                            <div className="lrow" key={v.id} data-ready={ready}>
                              <div className="lrow__top">
                                <span className={`chip ${ready ? 'chip--on' : ''}`}>
                                  {ready ? 'Visible' : 'Hidden'}
                                </span>
                                <span className="lrow__t">{v.title}</span>
                              </div>

                              <div className="lrow__acts">
                                <button className="pill pill--icon" onClick={() => void toggleReady(v)}>
                                  {ready ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                  {ready ? 'Hide' : 'Show'}
                                </button>
                                <button
                                  className="pill pill--danger pill--icon"
                                  onClick={() => void remove(v)}
                                  aria-label={`Delete ${v.title}`}
                                >
                                  <IconTrash size={16} />
                                </button>
                              </div>

                              <Uploader lessonId={v.id} onDone={() => void load()} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {mine.length === 0 && <p className="muted">No videos yet.</p>}

                  <Adder placeholder="New video name, e.g. Motion - 1" onAdd={(v) => void addVideo(c.id, v)} />

                  <button className="btn btn--ghost btn--block" onClick={() => void togglePublished(c)}>
                    {c.is_published ? 'Hide course from students' : 'Show course to students'}
                  </button>

                  {/* Last, and visually separated: hiding is almost always the
                      right action, deleting is the one that cannot be undone. */}
                  <button className="btn btn--danger btn--block" onClick={() => void removeCourse(c)}>
                    Delete this course
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {courses !== null && courses.length === 0 && (
        <p className="muted">No courses yet. Add the first one above.</p>
      )}
    </div>
  );
}

function Adder({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form className="chadd" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v); setV(''); } }}>
      <input value={v} onChange={(e) => setV(e.target.value)}
             placeholder={placeholder} autoComplete="off" aria-label={placeholder} />
      <button className="btn btn--ghost" disabled={!v.trim()}>Add</button>
    </form>
  );
}
