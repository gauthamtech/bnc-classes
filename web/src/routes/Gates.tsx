import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, MAX_DEVICES } from '../lib/useAuth';
import { LOGO } from '../lib/assets';

/**
 * Shown when an account is already in use on its allowed number of devices.
 * The student is not accused of anything: they are told what happened and
 * exactly who can fix it.
 */
export function DeviceBlocked() {
  const { profile, signOut } = useAuth();

  return (
    <main className="signin">
      <img src={LOGO} alt="BNC" width={382} height={136} />

      <div className="stack">
        <h1>Already in use elsewhere</h1>
        <p>
          This account is signed in on {MAX_DEVICES} devices, which is the limit.
          Ask BNC to remove an old phone and then sign in again.
        </p>
      </div>

      <div className="code">
        <span className="code__label">Your student code</span>
        <span className="code__value">{profile?.student_code ?? '—'}</span>
      </div>

      <button className="btn btn--ghost btn--block" onClick={() => void signOut()}>
        Sign out
      </button>
    </main>
  );
}

/**
 * Reached from the reset link in the email. Supabase has already put a
 * recovery session in place by the time this renders, so all that is left
 * is choosing a new password.
 */
export function SetPassword() {
  const { clearRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== again) return setError('The two passwords do not match.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');

    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) return setError(error.message);
    setDone(true);
  }

  if (done) {
    return (
      <main className="signin">
        <img src={LOGO} alt="BNC" width={382} height={136} />
        <div className="notice notice--ok">Password changed.</div>
        <button className="btn btn--primary btn--block" onClick={clearRecovery}>
          Continue to your classes
        </button>
      </main>
    );
  }

  return (
    <main className="signin">
      <img src={LOGO} alt="BNC" width={382} height={136} />

      <div className="stack">
        <h1>Choose a new password</h1>
        <p>Pick something you will remember. At least 6 characters.</p>
      </div>

      {error && <div className="notice notice--bad">{error}</div>}

      <form onSubmit={onSubmit} className="authform">
        <div className="field">
          <label htmlFor="p1">New password</label>
          <input id="p1" type="password" value={password} minLength={6} required
                 autoComplete="new-password"
                 onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p2">Type it again</label>
          <input id="p2" type="password" value={again} minLength={6} required
                 autoComplete="new-password"
                 onChange={(e) => setAgain(e.target.value)} />
        </div>
        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>

      <div className="authlinks">
        <button type="button" onClick={() => void signOut()}>Cancel and sign out</button>
      </div>
    </main>
  );
}
