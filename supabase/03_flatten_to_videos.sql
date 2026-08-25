-- =========================================================
-- Drop the chapter level. A course now holds videos directly.
--
-- Videos are named "Motion - 1", "Motion - 2". The app groups
-- them for display by the text before the dash, so the naming
-- does the chaptering and nobody has to file anything twice.
--
-- Safe to run once, on the test data. Run in the SQL editor.
-- =========================================================

-- The old policy reads through chapters, so it goes first.
drop policy if exists "read lessons of enrolled courses" on lessons;

-- Point lessons straight at their course.
alter table lessons add column if not exists course_id uuid references courses on delete cascade;

update lessons l
   set course_id = c.course_id
  from chapters c
 where c.id = l.chapter_id
   and l.course_id is null;

-- Anything orphaned (a lesson whose chapter vanished) cannot be shown.
delete from lessons where course_id is null;

alter table lessons alter column course_id set not null;
alter table lessons drop column if exists chapter_id;

drop table if exists chapters cascade;

create index if not exists lessons_course_pos on lessons (course_id, position);

-- Same rule as before, one join shorter.
create policy "read lessons of enrolled courses"
  on lessons for select
  using (
    is_admin()
    or is_free_preview
    or has_course_access(course_id)
  );
