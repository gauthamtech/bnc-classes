import { supabase } from './supabase';

/**
 * Bridge to the Android shell.
 *
 * ⚠️ THE OAUTH HALF OF THIS IS CURRENTLY DORMANT. Google sign-in was removed in
 * favour of email only, and nothing now produces a `bncapp://auth-callback`
 * redirect — so `authRedirectTo`, `AUTH_CALLBACK` and `window.__bncAuth` are
 * unused. They are kept, along with the matching handling in MainActivity and
 * the manifest intent-filter, because re-enabling Google is otherwise a
 * multi-file change across both the web app and the native shell.
 *
 * RECOVERY_EVENT below is NOT dormant — password reset uses it.
 *
 * How it worked, for whoever turns it back on: Google refuses OAuth inside a
 * plain WebView, so sign-in left the app for a Chrome Custom Tab. That tab
 * cannot navigate back into a WebView, so Supabase redirected to a private
 * scheme the shell registers; Android routed it to MainActivity, which called
 * `window.__bncAuth` with the token fragment. Deliberately not tied to any web
 * address, so it worked whether the build was hosted or bundled in the APK.
 */
const UA_TAG = 'BNCApp/';
export const AUTH_CALLBACK = 'bncapp://auth-callback';

/** Raised when the shell delivers a password-recovery link. */
export const RECOVERY_EVENT = 'bnc:recovery';

/** True when running inside the native shell rather than a browser. */
export function inShell() {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes(UA_TAG);
}

/**
 * Where Supabase should send the user after Google sign-in. Inside the shell
 * that is the custom scheme; in a browser it is the page they started on.
 */
export function authRedirectTo(webFallback: string) {
  return inShell() ? AUTH_CALLBACK : webFallback;
}

/**
 * Called by MainActivity with the raw fragment Supabase returned, e.g.
 * "access_token=…&refresh_token=…&expires_in=3600".
 *
 * The tokens are handed to supabase-js rather than written into storage
 * directly, so the session is created and refreshed by the same library that
 * manages it everywhere else.
 */
export function installShellAuthBridge() {
  if (typeof window === 'undefined') return;

  (window as any).__bncAuth = async (fragment: string) => {
    try {
      const p = new URLSearchParams(
        fragment.startsWith('#') ? fragment.slice(1) : fragment
      );

      const access_token = p.get('access_token');
      const refresh_token = p.get('refresh_token');

      if (!access_token || !refresh_token) {
        // An error comes back on the same channel — surface it rather than
        // leaving the student on a sign-in screen that silently did nothing.
        const desc = p.get('error_description') ?? p.get('error');
        if (desc) console.warn('[shell auth]', desc);
        return false;
      }

      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        console.warn('[shell auth]', error.message);
        return false;
      }

      // A reset link arrives through this same channel. setSession fires
      // SIGNED_IN rather than PASSWORD_RECOVERY, so without this the student
      // lands on their classes instead of the "choose a new password" screen
      // and the reset silently does nothing.
      if (p.get('type') === 'recovery') {
        window.dispatchEvent(new CustomEvent(RECOVERY_EVENT));
      }
      return true;
    } catch (e) {
      console.warn('[shell auth]', e);
      return false;
    }
  };
}
