import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isConfigured, type Profile } from './supabase';
import { RECOVERY_EVENT } from './shell';

/** How many phones or computers one account may be used on. */
export const MAX_DEVICES = 2;

/**
 * Nothing may hang forever. A free Supabase project sleeps after a few days
 * idle and takes several seconds to wake, and a phone on bad signal can stall
 * a request indefinitely. Without this a button sits on "Please wait" with no
 * way back.
 */
export async function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('The server is taking too long. Check your connection and try again.')),
      ms
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * The app's own address, without the hash route or query. Needed because
 * routing uses the hash and the build may live in a subfolder, so
 * window.location.origin would send people to the wrong place after a
 * Google sign-in or a password reset.
 */
export function appUrl() {
  return window.location.href.split('#')[0].split('?')[0];
}

type DeviceState = 'checking' | 'ok' | 'blocked';

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  configured: boolean;
  device: DeviceState;
  recovery: boolean;
  clearRecovery: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

function deviceId() {
  let id = localStorage.getItem('bnc_device_id');
  if (!id) {
    id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2) + Date.now());
    localStorage.setItem('bnc_device_id', id);
  }
  return id;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [device, setDevice] = useState<DeviceState>('checking');
  const [recovery, setRecovery] = useState(false);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', userId).maybeSingle();

    // The profile is created by a database trigger on first sign-in. On a
    // fast first login the row can lag the session, so retry once.
    if (!error && !data) {
      await new Promise((r) => setTimeout(r, 700));
      const retry = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      const p = (retry.data as Profile) ?? null;
      setProfile(p);
      return p;
    }
    const p = (data as Profile) ?? null;
    setProfile(p);
    return p;
  }

  /**
   * One account, a small number of devices. This is the cheapest piracy
   * control in the product: sharing a login with eight friends costs more
   * revenue than downloading ever will. Admins are exempt.
   */
  async function checkDevice(userId: string, role: string | undefined) {
    if (role === 'admin') return setDevice('ok');

    const id = deviceId();
    const { data, error } = await supabase
      .from('devices').select('id, device_hash').eq('user_id', userId);

    if (error) return setDevice('ok');   // never lock somebody out on a network blip

    const mine = data?.find((d) => d.device_hash === id);
    if (mine) {
      await supabase.from('devices')
        .update({ last_seen_at: new Date().toISOString() }).eq('id', mine.id);
      return setDevice('ok');
    }

    if ((data?.length ?? 0) >= MAX_DEVICES) return setDevice('blocked');

    await supabase.from('devices').insert({
      user_id: userId,
      device_hash: id,
      label: navigator.userAgent.slice(0, 80),
    });
    setDevice('ok');
  }

  useEffect(() => {
    if (!isConfigured) { setReady(true); return; }
    let alive = true;

    // If auth never answers, show the sign-in screen rather than the splash
    // forever. Being asked to sign in again beats a frozen logo.
    const failsafe = setTimeout(() => { if (alive) setReady(true); }, 8000);

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user) {
        const p = await loadProfile(data.session.user.id);
        if (alive) await checkDevice(data.session.user.id, p?.role);
      }
      if (alive) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, next) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(next);
      if (next?.user) {
        const p = await loadProfile(next.user.id);
        if (alive) await checkDevice(next.user.id, p?.role);
      } else {
        setProfile(null);
        setDevice('checking');
      }
      setReady(true);
    });

    // In the Android shell a reset link comes back through the native bridge,
    // which establishes the session with setSession — that fires SIGNED_IN, not
    // PASSWORD_RECOVERY, so the gate below would never open. shell.ts raises
    // this instead.
    const onRecovery = () => { if (alive) setRecovery(true); };
    window.addEventListener(RECOVERY_EVENT, onRecovery);

    return () => {
      alive = false;
      clearTimeout(failsafe);
      sub.subscription.unsubscribe();
      window.removeEventListener(RECOVERY_EVENT, onRecovery);
    };
  }, []);

  const value: AuthState = {
    ready, session, profile, device, recovery,
    configured: isConfigured,
    clearRecovery: () => setRecovery(false),
    refreshProfile: async () => {
      if (session?.user) await loadProfile(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
      setDevice('checking');
      setRecovery(false);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
