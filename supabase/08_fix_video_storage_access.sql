-- =========================================================
-- Let students actually play videos.
--
-- THE BUG
-- The policy from 04 decided access by querying lesson_sources:
--
--   exists (select 1 from lesson_sources ls join lessons l ...)
--
-- but lesson_sources is "admins only", and RLS on a referenced
-- table still applies inside another table's policy expression.
-- So for a student that subquery matched nothing, the policy
-- denied, createSignedUrl failed, and the player showed
-- "This lesson has no video attached yet" for every lesson.
--
-- Admins never saw it: is_admin() short-circuits first.
--
-- THE FIX
-- The storage key is 'lessons/<lesson_id>' (storageKeyFor in
-- Uploader.tsx), so the lesson id is already in the object name.
-- No lookup through lesson_sources is needed at all.
--
-- The check goes in a SECURITY DEFINER function, matching
-- is_admin() and has_course_access(), so it reads lessons
-- without tripping that table's own policy.
--
-- Run AFTER 07. Safe to re-run.
-- =========================================================

create or replace function can_read_lesson_video(object_name text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from lessons l
     where l.id::text = split_part(object_name, '/', 2)
       -- Same three conditions students face everywhere else:
       -- finished uploading, and either free or paid for.
       and l.status = 'ready'
       and (l.is_free_preview or has_course_access(l.course_id))
  );
$$;

drop policy if exists "read videos when enrolled" on storage.objects;

create policy "read videos when enrolled"
  on storage.objects for select
  using (
    bucket_id = 'videos'
    and (is_admin() or can_read_lesson_video(name))
  );

-- Verify as a STUDENT account, not yours. Signed in as an admin
-- everything passes on the is_admin() branch and proves nothing.
