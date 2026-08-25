import { useEffect, useState } from 'react';

/**
 * Offline notice.
 *
 * Patchy mobile data is normal in Calicut, not an exception — so this is its own
 * state, not an error. DESIGN.md §"Error and offline states": three distinct
 * treatments, and this is the one that is nobody's fault.
 *
 * A banner rather than a full screen, deliberately: the app is bundled inside
 * the APK, so the interface itself keeps working offline. Anything already
 * loaded is still readable, and blanking the screen would take that away for no
 * reason. Only fresh data and video need the network.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline" role="status">
      <span className="offline__dot" aria-hidden="true" />
      You are offline. Your progress is saved and will sync.
    </div>
  );
}
