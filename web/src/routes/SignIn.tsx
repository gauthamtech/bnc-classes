import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { LOGO } from '../lib/assets';
import { withTimeout } from '../lib/useAuth';
import { RECOVERY_EVENT } from '../lib/shell';

type Mode = 'signin' | 'signup' | 'forgot' | 'code' | 'confirm';

/**
 * Supabase's email OTP length is a project setting, not a constant — this
 * project currently sends 8 digits. Accept the whole documented range rather
 * than pinning a number the dashboard can change out from under the app.
 */
const OTP_MIN = 6;
const OTP_MAX = 10;

/** Supabase's raw errors are for developers. Students get plain language. */
function humanise(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password do not match. Check and try again.';
  if (m.includes('already registered')) return 'This email already has an account. Sign in instead.';
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters.';
  if (m.includes('unable to validate email')) return 'That email address does not look right.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first, then sign in.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('token has expired') || m.includes('otp_expired') || m.includes('expired'))
    return 'That code has expired. Send yourself a new one.';
  if (m.includes('invalid') && m.includes('token')) return 'That code is not right. Check the email and try again.';
  return message;
}

export function SignIn() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
    setCode('');
  }

  async function resendSignupCode() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error } = await withTimeout(
        supabase.auth.resend({ type: 'signup', email: email.trim() })
      );
      if (error) throw new Error(error.message);
      setCode('');
      setNotice('A new code is on its way.');
    } catch (e) {
      setError(humanise(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'forgot') {
        // No redirectTo, deliberately. Recovery is a six-digit code, not a
        // link: the app has no web address, and a link can be opened on a
        // different device from the one that asked for it. A code works from
        // any inbox, on any machine.
        const { error } = await withTimeout(
          supabase.auth.resetPasswordForEmail(email.trim())
        );
        if (error) throw new Error(error.message);
        setMode('code');
        setNotice('If that email has an account, a code is on its way.');
        return;
      }

      if (mode === 'code') {
        const { error } = await withTimeout(
          supabase.auth.verifyOtp({
            email: email.trim(),
            token: code.trim(),
            type: 'recovery',
          })
        );
        if (error) throw new Error(error.message);

        // The code establishes a session, which would otherwise drop the
        // student straight into their classes with the old password intact.
        // This raises the same signal the Android bridge uses, so the
        // "choose a new password" gate opens instead.
        window.dispatchEvent(new CustomEvent(RECOVERY_EVENT));
        return;
      }

      if (mode === 'confirm') {
        const { error } = await withTimeout(
          supabase.auth.verifyOtp({
            email: email.trim(),
            token: code.trim(),
            type: 'signup',
          })
        );
        if (error) throw new Error(error.message);
        // Confirming signs them in. Nothing else to do — App.tsx swaps to the
        // authenticated shell as soon as the session lands.
        return;
      }

      if (mode === 'signup') {
        const { data, error } = await withTimeout(
          supabase.auth.signUp({
            email: email.trim(), password,
            options: { data: { full_name: name.trim() } },
          })
        );
        if (error) throw new Error(error.message);

        // With "Confirm email" on, signUp returns no session — Supabase has
        // emailed a code. Without confirmation on, the session exists already
        // and the app drops straight in. Handle both, because that setting can
        // be changed in the dashboard without anyone touching this file.
        if (!data.session) {
          setMode('confirm');
          setNotice('Account created. Enter the code we just emailed you.');
        }
        return;
      }

      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password })
      );

      // Someone who signed up, closed the app, and came back would otherwise
      // hit "email not confirmed" with no way to enter their code — the code
      // screen is only reachable straight after signing up. Send a fresh code
      // and put them on it.
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          await supabase.auth.resend({ type: 'signup', email: email.trim() });
          setMode('confirm');
          setNotice('Your email is not confirmed yet. We have sent a new code.');
          return;
        }
        throw new Error(error.message);
      }
    } catch (e) {
      setError(humanise(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === 'signup' ? 'Create your account'
    : mode === 'forgot' ? 'Reset your password'
    : mode === 'code' ? 'Enter your code'
    : mode === 'confirm' ? 'Confirm your email'
    : 'Physics classes, on your phone';

  const blurb =
    mode === 'signup' ? 'Your teacher enrols you in a class once your account exists.'
    : mode === 'forgot' ? 'Enter your email and we will send you a code.'
    : mode === 'code' ? `We sent a code to ${email.trim() || 'your email'}. It expires in an hour.`
    : mode === 'confirm' ? `We sent a code to ${email.trim() || 'your email'}. Enter it to finish creating your account.`
    : 'Sign in to reach the classes you have been enrolled in.';

  const asksForPassword = mode === 'signin' || mode === 'signup';
  /** Both code screens share one input; only the verifyOtp type differs. */
  const entersCode = mode === 'code' || mode === 'confirm';

  return (
    <main className="signin">
      <img src={LOGO} alt="BNC" width={382} height={136} />

      <div className="stack">
        <h1>{title}</h1>
        <p>{blurb}</p>
      </div>

      {error && <div className="notice notice--bad">{error}</div>}
      {notice && <div className="notice notice--ok">{notice}</div>}

      <form onSubmit={onSubmit} className="authform">
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name" value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="name" placeholder="Your name" required
            />
          </div>
        )}

        {!entersCode && (
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" inputMode="email" placeholder="you@example.com" required
            />
          </div>
        )}

        {entersCode && (
          <div className="field">
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              className="otp"
              value={code}
              // Digits only — students paste from the email and pick up spaces.
              // Length is NOT fixed at 6: Supabase's OTP length is a dashboard
              // setting (this project sends 8), and hard-coding it here would
              // break the form the day somebody changes it.
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_MAX))}
              inputMode="numeric"
              // Lets Android and iOS offer the code straight from the notification.
              autoComplete="one-time-code"
              placeholder="Code from your email"
              maxLength={OTP_MAX}
              required
              autoFocus
            />
            <small>Check your inbox, and your spam folder.</small>
          </div>
        )}

        {asksForPassword && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              minLength={6} required
            />
          </div>
        )}

        <button
          className="btn btn--primary btn--block"
          type="submit"
          disabled={busy || (entersCode && code.length < OTP_MIN)}
        >
          {busy ? 'Please wait…'
            : mode === 'signup' ? 'Create account'
            : mode === 'forgot' ? 'Send me a code'
            : mode === 'code' ? 'Verify code'
            : mode === 'confirm' ? 'Confirm email'
            : 'Sign in'}
        </button>
      </form>

      <div className="authlinks">
        {mode === 'signin' && (
          <>
            <button type="button" onClick={() => reset('signup')}>New here? Create an account</button>
            <button type="button" onClick={() => reset('forgot')}>Forgot your password?</button>
          </>
        )}
        {mode === 'signup' && (
          <button type="button" onClick={() => reset('signin')}>Already have an account? Sign in</button>
        )}
        {mode === 'forgot' && (
          <button type="button" onClick={() => reset('signin')}>Back to sign in</button>
        )}
        {mode === 'code' && (
          <>
            <button type="button" onClick={() => reset('forgot')}>Send a new code</button>
            <button type="button" onClick={() => reset('signin')}>Back to sign in</button>
          </>
        )}
        {mode === 'confirm' && (
          <>
            <button type="button" onClick={() => void resendSignupCode()}>Send a new code</button>
            <button type="button" onClick={() => reset('signin')}>Back to sign in</button>
          </>
        )}
      </div>
    </main>
  );
}
