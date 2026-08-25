import type { CapacitorConfig } from '@capacitor/cli';

/**
 * iOS shell configuration.
 *
 * The Android app is a hand-written native project in D:\BNC App\android and is
 * NOT managed by Capacitor — it works, FLAG_SECURE is verified, and rewriting it
 * to share a toolchain would risk the one thing that is proven. Capacitor exists
 * here only to produce the iOS project.
 */
const config: CapacitorConfig = {
  appId: 'com.bncphysics.classes',
  appName: 'BNC Classes',

  // Same bundled build the APK ships. No hosted URL, on either platform.
  webDir: 'dist',

  ios: {
    // Matches the web app's ground colour, so there is no white flash between
    // the launch screen and the first paint.
    backgroundColor: '#060814',
    // Lets the page use the full screen; safe-area insets are already handled
    // in styles.css via env(safe-area-inset-*).
    contentInset: 'never',
    // Videos play inline rather than being taken over by the system player,
    // which would escape the capture protection entirely.
    limitsNavigationsToAppBoundDomains: false,
  },

  server: {
    // capacitor:// gives WKWebView a stable secure origin, which localStorage —
    // and therefore the Supabase session — needs to survive a relaunch.
    iosScheme: 'capacitor',
  },
};

export default config;
