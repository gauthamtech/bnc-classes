-- =========================================================
-- Video storage inside Supabase, for testing and demos.
--
-- Free plan limits: 1 GB total, and 50 MB per file. Fine for
-- short clips and showing the client. Real lessons move to R2
-- later; only the upload and playback calls change, nothing
-- else in the app.
-- =========================================================

insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

-- Postgres has no "create policy if not exists", so drop first. This makes
-- the whole file safe to run again when you cannot remember whether you did.
drop policy if exists "admins upload videos"   on storage.objects;
drop policy if exists "admins replace videos"  on storage.objects;
drop policy if exists "admins delete videos"   on storage.objects;
drop policy if exists "read videos when enrolled" on storage.objects;

-- Only admins put files in.
create policy "admins upload videos"
  on storage.objects for insert
  with check (bucket_id = 'videos' and is_admin());

create policy "admins replace videos"
  on storage.objects for update
  using (bucket_id = 'videos' and is_admin());

create policy "admins delete videos"
  on storage.objects for delete
  using (bucket_id = 'videos' and is_admin());

-- The same enrolment rule as the rest of the app, applied to the file
-- itself. A student can only sign a URL for a video that belongs to a
-- course they are enrolled in. Postgres decides, not the browser.
create policy "read videos when enrolled"
  on storage.objects for select
  using (
    bucket_id = 'videos'
    and (
      is_admin()
      or exists (
        select 1
          from lesson_sources ls
          join lessons l on l.id = ls.lesson_id
         where ls.storage_key = storage.objects.name
           and (l.is_free_preview or has_course_access(l.course_id))
      )
    )
  );
