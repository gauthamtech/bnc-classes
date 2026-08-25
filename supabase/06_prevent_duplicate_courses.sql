-- =========================================================
-- Stop the same course being created twice.
--
-- Tapping "Add course" twice used to make two rows. A student
-- enrolled in both then saw the class listed twice on their
-- home screen, with no way to tell which was which.
--
-- enrollments already had unique (user_id, course_id), so the
-- duplication was never in enrolment — it was in courses.
--
-- Run once, in the SQL editor. Safe to re-run.
-- =========================================================

-- ---------------------------------------------------------
-- STEP 1 — find duplicates. The index below CANNOT be created
-- while any exist, and the error Postgres gives is not obvious.
-- Run this first; if it returns rows, clear them, then run the
-- rest of the file.
-- ---------------------------------------------------------
select grade, lower(title) as title, count(*) as copies,
       array_agg(id order by created_at) as ids
  from courses
 group by grade, lower(title)
having count(*) > 1;

-- To clear one: keep the FIRST id from the array above (the
-- original) and delete the rest. Deleting a course cascades to
-- its lessons and enrolments, so prefer the admin panel's
-- "Hide course from students" if you are not certain.
--
--   delete from courses where id = 'PASTE-THE-LATER-ID';

-- ---------------------------------------------------------
-- STEP 2 — the constraint.
--
-- lower(title) so "Physics" and "physics" collide too; typing
-- case is not a meaningful difference to a student reading a
-- list. Scoped to grade, because "Full Year Physics" is a
-- perfectly reasonable name in both Grade 9 and Grade 11.
-- ---------------------------------------------------------
create unique index if not exists courses_grade_title_uniq
  on courses (grade, lower(title));

-- The app maps the resulting error code 23505 to a readable
-- sentence in Courses.tsx, rather than showing Postgres's raw
-- "duplicate key value violates unique constraint" text.
