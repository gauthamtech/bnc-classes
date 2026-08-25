/**
 * Inline SVG icons.
 *
 * The Stitch designs use Material Symbols, which is a webfont download of a few
 * hundred KB for the handful of glyphs this app needs. These are drawn inline
 * instead: no network request, they inherit currentColor, and they scale with
 * the text around them.
 *
 * Stroke-based at 1.75 so they hold up against Outfit's weight without looking
 * heavier than the labels beside them.
 */
type Props = { size?: number; className?: string };

function Svg({ size = 24, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" className={className}
      fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconLessons = (p: Props) => (
  <Svg {...p}>
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 2.5 9 2.5 12 0v-5" />
  </Svg>
);

export const IconStudents = (p: Props) => (
  <Svg {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

export const IconCourses = (p: Props) => (
  <Svg {...p}>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </Svg>
);

export const IconProfile = (p: Props) => (
  <Svg {...p}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Svg>
);

export const IconSearch = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
);

export const IconChevronRight = (p: Props) => (
  <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
);

export const IconChevronDown = (p: Props) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);

export const IconPlus = (p: Props) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);

export const IconTrash = (p: Props) => (
  <Svg {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="m19 6-1 14H6L5 6" />
  </Svg>
);

export const IconEye = (p: Props) => (
  <Svg {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconEyeOff = (p: Props) => (
  <Svg {...p}>
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
    <path d="M6.06 6.06A13.6 13.6 0 0 0 2 11s3.6 7 10 7a9 9 0 0 0 5.94-2.06" />
    <path d="m2 2 20 20" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);

export const IconDeviceReset = (p: Props) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 2.6-6.36L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);

/** Solid, because a play control reads as a button rather than an outline. */
export const IconPlay = ({ size = 24, className }: Props) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" className={className}
    fill="currentColor" aria-hidden="true" focusable="false"
  >
    <path d="M8 5.14v13.72L19 12 8 5.14Z" />
  </svg>
);
