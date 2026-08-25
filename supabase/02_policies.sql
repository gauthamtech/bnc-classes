-- =========================================================
-- BNC Classes — row level security
--
-- The rule the whole app rests on: a student can only read a
-- lesson whose course they are actively enrolled in. This is
-- enforced in the database, not in the app, so a bug in the
-- front end cannot leak content.
-- =========================================================

alter table profiles       enable row level security;
alter table courses        enable row level security;
alter table chapters       enable row level security;
alter table lessons        enable row level security;
alter table lesson_sources enable row level security;
alter table enrollments    enable row level security;
alter table devices        enable row level security;
alter table progress       enable row level security;

-- ---------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------
create policy "read own profile"
  on profiles for select
  using (id = auth.uid() or is_admin());

-- Note the with-check: a student may edit their name and phone
-- but the row must still be theirs. Role is not in this policy
-- at all, and there is no update policy that permits changing
-- it, so self-promotion to admin is impossible from the client.
create policy "update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admins update any profile"
  on profiles for update
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------
-- COURSES  — published courses are browsable by any signed-in
-- user so they can see what exists before enrolling.
-- ---------------------------------------------------------
create policy "read published courses"
  on courses for select
  using (is_published or is_admin());

create policy "admins write courses"
  on courses for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------
-- CHAPTERS  — visible only with course access.
-- ---------------------------------------------------------
create policy "read chapters of enrolled courses"
  on chapters for select
  using (has_course_access(course_id) or is_admin());

create policy "admins write chapters"
  on chapters for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------
-- LESSONS  — the core rule. Free previews are the one way in
-- without enrolment, so he can show a sample lesson publicly.
-- ---------------------------------------------------------
create policy "read lessons of enrolled courses"
  on lessons for select
  using (
    is_admin()
    or is_free_preview
    or exists (
      select 1 from chapters c
      where c.id = lessons.chapter_id
        and has_course_access(c.course_id)
    )
  );

create policy "admins write lessons"
  on lessons for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------
-- LESSON SOURCES  — admins only, ever.
-- Students never touch this table. Playback goes through the
-- Edge Function, which runs with the service key and bypasses
-- RLS after checking access itself.
-- ---------------------------------------------------------
create policy "admins only"
  on lesson_sources for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------
-- ENROLMENTS  — students read their own, only admins grant.
-- ---------------------------------------------------------
create policy "read own enrolments"
  on enrollments for select
  using (user_id = auth.uid() or is_admin());

create policy "admins manage enrolments"
  on enrollments for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------
-- DEVICES  — a student can register and see their own; only an
-- admin can delete one, which is the "I got a new phone" reset.
-- ---------------------------------------------------------
create policy "read own devices"
  on devices for select
  using (user_id = auth.uid() or is_admin());

create policy "register own device"
  on devices for insert
  with check (user_id = auth.uid());

create policy "touch own device"
  on devices for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "admins remove devices"
  on devices for delete
  using (is_admin());

-- ---------------------------------------------------------
-- PROGRESS  — entirely the student's own.
-- ---------------------------------------------------------
create policy "own progress"
  on progress for all
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid());
