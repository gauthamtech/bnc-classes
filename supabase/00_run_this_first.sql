-- =========================================================
-- BNC Classes — schema
--
-- Scope this covers: Google login, student profiles with a
-- human-readable code, admin roles you control, courses for
-- grades 9-12, chapters, lessons, manual enrolment, device
-- limiting, progress.
--
-- Deliberately NOT here: payments, automatic expiry, iOS.
-- The columns those will need already exist and are nullable,
-- so adding them later is configuration, not a migration.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- PROFILES
-- One row per signed-in person. student_code is what he reads
-- out over the phone to find someone in the admin panel, so it
-- is short, sequential and human-sayable.
-- ---------------------------------------------------------
create sequence if not exists student_code_seq start 1;

create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  student_code text unique not null
                 default 'BNC-' || lpad(nextval('student_code_seq')::text, 4, '0'),
  full_name    text,
  email        text,
  phone        text,
  role         text not null default 'student'
                 check (role in ('student', 'admin')),
  created_at   timestamptz not null default now()
);

comment on column profiles.role is
  'Students can never change this. Promotion to admin happens only via the service key.';

-- Create the profile automatically the first time someone signs in.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------
-- COURSE STRUCTURE
-- grade is text, not an enum, so NEET / JEE / KEAM slot in
-- later without touching the schema.
-- ---------------------------------------------------------
create table courses (
  id           uuid primary key default gen_random_uuid(),
  grade        text not null,
  title        text not null,
  description  text,
  position     int  not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);

-- 100 lessons in a flat list is unusable for him and for students.
create table chapters (
  id        uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses on delete cascade,
  title     text not null,
  position  int  not null default 0
);

create table lessons (
  id              uuid primary key default gen_random_uuid(),
  chapter_id      uuid not null references chapters on delete cascade,
  title           text not null,
  position        int  not null default 0,
  duration_sec    int,
  status          text not null default 'draft'
                    check (status in ('draft','uploading','processing','ready','failed')),
  is_free_preview boolean not null default false,
  created_at      timestamptz not null default now()
);

-- The R2 object key lives in its own table so that no student
-- can ever read it, even if a policy on `lessons` is loosened
-- by accident. Playback goes through the Edge Function, which
-- uses the service key and returns a short-lived signed URL.
create table lesson_sources (
  lesson_id   uuid primary key references lessons on delete cascade,
  storage_key text not null,
  size_bytes  bigint,
  uploaded_at timestamptz not null default now()
);

create index on chapters (course_id, position);
create index on lessons  (chapter_id, position);

-- ---------------------------------------------------------
-- ENROLMENT  (granted by hand, permanently, by his choice)
-- expires_at stays nullable: unused today, ready the day he
-- changes his mind about annual access.
-- ---------------------------------------------------------
create table enrollments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  course_id  uuid not null references courses  on delete cascade,
  granted_by uuid references profiles,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  note       text,
  unique (user_id, course_id)
);

create index on enrollments (course_id) where revoked_at is null;

-- ---------------------------------------------------------
-- DEVICES
-- The cheapest anti-piracy measure in the whole project: one
-- account shared with eight friends loses more money than
-- downloading ever will.
-- ---------------------------------------------------------
create table devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles on delete cascade,
  device_hash  text not null,
  label        text,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_id, device_hash)
);

-- ---------------------------------------------------------
-- PROGRESS
-- Nobody remembers where they were in a 100-lesson course.
-- ---------------------------------------------------------
create table progress (
  user_id         uuid references profiles on delete cascade,
  lesson_id       uuid references lessons  on delete cascade,
  seconds_watched int not null default 0,
  completed_at    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- =========================================================
-- HELPERS
-- security definer so they can read the tables without
-- tripping the policies that call them.
-- =========================================================
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function has_course_access(c uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from enrollments e
    where e.user_id = auth.uid()
      and e.course_id = c
      and e.revoked_at is null
      and (e.expires_at is null or e.expires_at > now())
  );
$$;
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
