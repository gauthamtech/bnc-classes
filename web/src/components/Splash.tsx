import { useEffect, useRef, useState } from 'react';
import { LOGO } from '../lib/assets';

/**
 * Brand splash.
 *
 * MIN_MS is the only knob. It is a *minimum*, not a timer: the splash
 * leaves as soon as the app is ready, but never so fast that the logo
 * flashes. Set it to 3000 if the client insists on three seconds, but
 * be aware students open this app daily and a fixed gate on every
 * launch becomes the most disliked part of the app by week two.
 */
const MIN_MS = 1500;
const FADE_MS = 420;

export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);

  // Held in a ref so a new inline callback from the parent cannot
  // retrigger the fade effect and cancel its own timer.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_MS);
    return () => clearTimeout(t);
  }, []);

  // Decide to leave.
  useEffect(() => {
    if (ready && minElapsed) setLeaving(true);
  }, [ready, minElapsed]);

  // Unmount after the fade. Kept separate from the decision above:
  // when both lived in one effect, setting `leaving` re-ran the effect
  // and the cleanup cancelled the timer that dismisses the splash.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => onDoneRef.current(), FADE_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  return (
    <div className="splash" data-leaving={leaving} role="status" aria-label="Loading BNC Classes">
      <div className="splash__mark">
        <img src={LOGO} alt="BNC" width={382} height={136} />
        <span className="splash__tag">Physics Classes</span>
      </div>
    </div>
  );
}
