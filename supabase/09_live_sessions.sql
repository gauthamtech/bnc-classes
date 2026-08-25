-- =========================================================
-- Live classes
--
-- Runs on the website (bncphysics.com/live), not the app, but
-- uses the SAME database, the same accounts and the same
-- enrolment rule as recorded courses.
--
-- Access model, in one line: you can only see or join a live
-- class for a course you are actively enrolled in, and Postgres
-- decides that, not the browser.
-- =========================================================

create table if not exists live_sessions (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses on delete cascade,
  title        text not null,
  -- The Daily room this class happens in. Never enough on its own:
  -- joining still needs a short-lived token minted server side.
  room_name    text not null,
  starts_at    timestamptz,
  status       text not null default 'scheduled'
                 check (status in ('scheduled','live','ended')),
  started_at   timestamptz,
  ended_at     timestamptz,
  created_by   uuid references profiles,
  created_at   timestamptz not null default now()
);

create index if not exists live_sessions_course on live_sessions (course_id);
create index if not exists live_sessions_live
  on live_sessions (course_id) where status = 'live';

alter table live_sessions enable row level security;

-- Students see live classes only for courses they are enrolled in.
create policy "read live sessions of enrolled courses"
  on live_sessions for select
  using (is_admin() or has_course_access(course_id));

-- Only admins schedule, start or end a class.
create policy "admins manage live sessions"
  on live_sessions for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------
-- Attendance. Useful to him, and it is also the audit trail
-- if a student later claims they could not get in.
-- ---------------------------------------------------------
create table if not exists live_attendance (
  session_id uuid references live_sessions on delete cascade,
  user_id    uuid references profiles on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table live_attendance enable row level security;

create policy "read own attendance"
  on live_attendance for select
  using (user_id = auth.uid() or is_admin());

create policy "record own attendance"
  on live_attendance for insert
  with check (user_id = auth.uid());
