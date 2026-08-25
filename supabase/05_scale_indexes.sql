-- =========================================================
-- Indexes for a real student body.
--
-- Not urgent at 50 students, cheap insurance at 1000. Run it
-- once; safe to re-run.
-- =========================================================

-- Admin search uses ilike '%name%', which a normal index cannot help.
-- Trigram indexes can.
create extension if not exists pg_trgm;

create index if not exists profiles_name_trgm
  on profiles using gin (full_name gin_trgm_ops);

create index if not exists profiles_email_trgm
  on profiles using gin (email gin_trgm_ops);

create index if not exists profiles_phone_trgm
  on profiles using gin (phone gin_trgm_ops);

-- student_code is looked up exactly as often as it is searched.
create index if not exists profiles_code
  on profiles (student_code);

-- The hot path: "which courses is this student in", run on every app open.
create index if not exists enrollments_user_live
  on enrollments (user_id)
  where revoked_at is null;

-- Progress is the biggest table long term: one row per student per video.
-- 1000 students across 400 videos is 400k rows, so this one matters.
create index if not exists progress_user
  on progress (user_id);

create index if not exists progress_user_done
  on progress (user_id)
  where completed_at is not null;

-- Devices are read on every sign-in.
create index if not exists devices_user
  on devices (user_id);

analyze profiles;
analyze enrollments;
analyze progress;
analyze devices;
