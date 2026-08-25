-- =========================================================
-- Make the admin panel's "hidden" toggle actually hide.
--
-- The lessons policy checked enrolment but never `status`, so
-- a video toggled to "hidden" was still readable, still listed,
-- and still playable by any enrolled student. The pill in the
-- admin panel said "hidden" and meant nothing.
--
-- status is one of: draft, uploading, processing, ready, failed.
-- Only 'ready' should reach a student. That also stops a lesson
-- being opened while it is still uploading.
--
-- Run once, in the SQL editor. Safe to re-run.
-- =========================================================

drop policy if exists "read lessons of enrolled courses" on lessons;

create policy "read lessons of enrolled courses"
  on lessons for select
  using (
    is_admin()
    or (
      status = 'ready'
      and (is_free_preview or has_course_access(course_id))
    )
  );

-- Note the status gate sits OUTSIDE the free-preview branch on
-- purpose: a free preview that has not finished uploading is not
-- something to show a stranger either.
