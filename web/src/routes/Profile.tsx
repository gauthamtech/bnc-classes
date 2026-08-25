import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';

export function Profile() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);

  // Keyed on the id, not the object. Supabase refreshes the token roughly
  // hourly, which reloads the profile and hands back a new object — depending
  // on that would wipe whatever the student was half-way through typing.
  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.id]);

  async function save() {
    if (!profile) return;
    setBusy(true);
    setMsg(null);

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
      .eq('id', profile.id);

    if (error) setMsg({ kind: 'bad', text: error.message });
    else {
      await refreshProfile();
      setMsg({ kind: 'ok', text: 'Saved.' });
    }
    setBusy(false);
  }

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '—';

  return (
    <div className="shell page">
      <h2 className="page__title">Your account</h2>
      <p className="page__sub">Manage your account details.</p>

      {/* Read-only identity. The student code leads, because it is the one
          thing BNC asks for over the phone. */}
      <div className="panel">
        <div className="idrow">
          <span className="idrow__k">Student code</span>
          <span className="idrow__code">{profile?.student_code ?? '—'}</span>
        </div>
        <div className="idrow">
          <span className="idrow__k">Email</span>
          <span className="idrow__v">{profile?.email ?? session?.user.email ?? '—'}</span>
        </div>
        <div className="idrow">
          <span className="idrow__k">Joined date</span>
          <span className="idrow__v">{joined}</span>
        </div>
      </div>

      {msg && <div className={`notice notice--${msg.kind}`}>{msg.text}</div>}

      <div className="panel">
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name as BNC knows it"
            autoComplete="name"
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10 digit mobile number"
            inputMode="numeric"
            autoComplete="tel"
          />
          <small>Used only so BNC can match you to your payment.</small>
        </div>

        <div className="stack">
          <button className="btn btn--primary btn--block" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button className="btn btn--ghost btn--block" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
