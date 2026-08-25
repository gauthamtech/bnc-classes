import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

type Props = { lessonId: string; onDone: () => void };

/** Storage path is derived from the lesson id, so the player can find it
 *  without reading the private lesson_sources table. */
export const storageKeyFor = (lessonId: string) => `lessons/${lessonId}`;

/** Reads duration locally, so students see run times with no transcoding. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const url = URL.createObjectURL(file);
    const done = (d: number | null) => { URL.revokeObjectURL(url); resolve(d); };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    v.src = url;
  });
}

export function Uploader({ lessonId, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    setPct(0);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Session expired. Sign in again.');

      const duration = await readDuration(file);
      const key = storageKeyFor(lessonId);
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      await supabase.from('lessons').update({ status: 'uploading' }).eq('id', lessonId);

      // Storage REST directly, rather than supabase-js, purely to get a
      // real progress bar out of XHR. upsert lets a re-upload replace.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', `${base}/storage/v1/object/videos/${key}`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('apikey', anon);
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) return resolve();
          let msg = `Upload failed (${xhr.status})`;
          if (xhr.status === 413) msg = 'File is too large. Free storage allows 50 MB per file.';
          try {
            const b = JSON.parse(xhr.responseText);
            if (b?.message) msg = b.message;
          } catch { /* keep the status message */ }
          reject(new Error(msg));
        };
        xhr.onerror = () => reject(new Error('Connection dropped during upload.'));
        xhr.onabort = () => reject(new Error('Upload cancelled.'));
        xhr.send(file);
      });

      const src = await supabase.from('lesson_sources').upsert(
        { lesson_id: lessonId, storage_key: key, size_bytes: file.size },
        { onConflict: 'lesson_id' }
      );
      if (src.error) throw new Error(src.error.message);

      const upd = await supabase.from('lessons').update({
        status: 'ready',
        duration_sec: duration ? Math.round(duration) : null,
      }).eq('id', lessonId);
      if (upd.error) throw new Error(upd.error.message);

      setPct(null);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPct(null);
      await supabase.from('lessons').update({ status: 'draft' }).eq('id', lessonId);
      onDone();
    } finally {
      xhrRef.current = null;
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (pct !== null) {
    return (
      <div className="up">
        <div className="up__bar"><span style={{ width: `${pct}%` }} /></div>
        <span className="up__pct">{pct}%</span>
        <button className="pill pill--danger" onClick={() => xhrRef.current?.abort()}>stop</button>
      </div>
    );
  }

  return (
    <div className="up">
      <input
        ref={inputRef} type="file" accept="video/*"
        id={`file-${lessonId}`} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }}
      />
      <label className="pill" htmlFor={`file-${lessonId}`} style={{ cursor: 'pointer' }}>
        upload video
      </label>
      {error && <span className="up__err">{error}</span>}
    </div>
  );
}
