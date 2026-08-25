import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { IconLessons, IconStudents, IconCourses, IconProfile } from './Icons';

/**
 * Bottom tab bar.
 *
 * Two tabs for a student — Lessons and Profile. The Stitch designs carried four
 * (Formulas and Practice), but neither feature exists, and a tab that leads
 * nowhere is worse than no tab.
 *
 * Admins get two more: Students and Courses. Navigation used to live in the top
 * bar, which put the two most-used admin screens behind a target at the very top
 * of a six-inch phone. Thumbs live at the bottom.
 */
type Tab = {
  to: string;
  label: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  /** Matches nested routes, so /course/x keeps Lessons lit. */
  match: (path: string) => boolean;
};

const STUDENT_TABS: Tab[] = [
  {
    to: '/', label: 'Lessons', Icon: IconLessons,
    match: (p) => p === '/' || p.startsWith('/course') || p.startsWith('/lesson'),
  },
  {
    to: '/account', label: 'Profile', Icon: IconProfile,
    match: (p) => p === '/account',
  },
];

const ADMIN_TABS: Tab[] = [
  STUDENT_TABS[0],
  {
    to: '/admin', label: 'Students', Icon: IconStudents,
    match: (p) => p === '/admin',
  },
  {
    to: '/admin/courses', label: 'Courses', Icon: IconCourses,
    match: (p) => p === '/admin/courses',
  },
  STUDENT_TABS[1],
];

export function BottomNav() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const tabs = profile?.role === 'admin' ? ADMIN_TABS : STUDENT_TABS;

  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar__row">
        {tabs.map(({ to, label, Icon, match }) => {
          const on = match(pathname);
          return (
            <Link
              key={to}
              to={to}
              className="tabbar__item"
              data-on={on}
              aria-current={on ? 'page' : undefined}
            >
              <Icon size={22} />
              <span className="tabbar__label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
