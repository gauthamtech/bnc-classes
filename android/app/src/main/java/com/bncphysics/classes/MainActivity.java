package com.bncphysics.classes;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/**
 * The whole native app.
 *
 * It exists for one reason: FLAG_SECURE. A website cannot stop a student screen
 * recording a lesson; an Android activity can, at the operating-system level,
 * and the recording comes out black. Everything else here is in service of that
 * one activity behaving like a real app rather than a browser tab.
 */
public class MainActivity extends AppCompatActivity {

    /** Appended to the user agent so the web build knows it is inside the shell. */
    private static final String UA_TAG = "BNCApp/1.0";

    /** Where Google sign-in returns to. A private scheme, not a web address. */
    private static final String CALLBACK_SCHEME = "bncapp";
    private static final String CALLBACK_HOST = "auth-callback";

    /** Bundled assets are served from here so the page has a secure origin. */
    private static final String ASSET_ORIGIN = "https://appassets.androidplatform.net";

    private WebView web;
    private View errorView;
    private WebViewAssetLoader assetLoader;

    /** Set when the callback arrives before the page is ready to receive it. */
    @Nullable private String pendingAuthFragment;
    private boolean pageReady = false;

    /** <input type="file"> in the admin uploader. Dead without this. */
    @Nullable private ValueCallback<Uri[]> fileCallback;
    private ActivityResultLauncher<Intent> filePicker;

    /** Fullscreen video. WebView hands the player over as a detached view. */
    @Nullable private View fullscreenView;
    @Nullable private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        // Swap the splash theme for the real one before the first frame.
        setTheme(R.style.Theme_BNC);
        super.onCreate(savedInstanceState);

        // THE POINT OF THE ENTIRE APP. Set before any content exists, so there
        // is no frame in which a recording could catch the window.
        //
        // Always true in a release build. Only a debug build made with
        // -PallowCapture=true skips it, so that screens can be captured for
        // visual QA — otherwise every screenshot, including the developer's,
        // comes out black.
        if (BuildConfig.SECURE_SCREEN) {
            getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE);
        }

        setContentView(R.layout.activity_main);
        web = findViewById(R.id.web);
        errorView = findViewById(R.id.error);
        Button retry = findViewById(R.id.retry);
        retry.setOnClickListener(v -> {
            errorView.setVisibility(View.GONE);
            web.setVisibility(View.VISIBLE);
            web.reload();
        });

        filePicker = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (fileCallback == null) return;
                    fileCallback.onReceiveValue(
                            WebChromeClient.FileChooserParams.parseResult(
                                    result.getResultCode(), result.getData()));
                    fileCallback = null;
                });

        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        configureWebView();
        wireBackButton();

        if (savedInstanceState == null) {
            web.loadUrl(startUrl());
        } else {
            web.restoreState(savedInstanceState);
        }

        handleAuthCallback(getIntent());
        warnIfRooted();
    }

    private String startUrl() {
        return BuildConfig.LOAD_BUNDLED
                ? ASSET_ORIGIN + "/assets/app/index.html"
                : BuildConfig.REMOTE_URL;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // the Supabase session lives here
        s.setUserAgentString(s.getUserAgentString() + " " + UA_TAG);
        s.setSupportMultipleWindows(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        // No long-press callout, no text selection on the player.
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);

        // Videos must not be downloadable. Swallowing the download rather than
        // handing it to the system is the whole point.
        web.setDownloadListener((url, ua, disp, mime, size) -> { /* deliberately nothing */ });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return assetLoader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri url = req.getUrl();
                String host = url.getHost() == null ? "" : url.getHost();

                // Google refuses OAuth inside a plain WebView. Sign-in has to
                // happen in a real browser, so hand it to a Custom Tab.
                if (isSignIn(url, host)) {
                    openCustomTab(url);
                    return true;
                }

                // Anything off our own origins is an outside link — let the
                // system browser have it rather than trapping the student in
                // an app with no address bar and no way back.
                if (isOurs(host)) return false;
                openExternally(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                pageReady = true;
                flushPendingAuth();
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest req,
                                        android.webkit.WebResourceError err) {
                // Only the main document. A failed image should not blank the app.
                if (!req.isForMainFrame()) return;
                web.setVisibility(View.GONE);
                errorView.setVisibility(View.VISIBLE);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            /**
             * Tapping fullscreen on a <video> does nothing at all unless this is
             * implemented — WebView hands the player back as a detached view and
             * expects the app to place it. Without it the control appears to be
             * broken, which on a video product is the first thing anyone tries.
             */
            @Override
            public void onShowCustomView(View v, CustomViewCallback cb) {
                if (fullscreenView != null) {
                    cb.onCustomViewHidden();
                    return;
                }
                fullscreenView = v;
                fullscreenCallback = cb;

                ((FrameLayout) getWindow().getDecorView()).addView(
                        v, new FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
                setVideoImmersive(true);
            }

            @Override
            public void onHideCustomView() {
                if (fullscreenView == null) return;
                ((FrameLayout) getWindow().getDecorView()).removeView(fullscreenView);
                fullscreenView = null;
                web.setVisibility(View.VISIBLE);
                setVideoImmersive(false);
                if (fullscreenCallback != null) {
                    fullscreenCallback.onCustomViewHidden();
                    fullscreenCallback = null;
                }
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    filePicker.launch(params.createIntent());
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });
    }

    private boolean isSignIn(Uri url, String host) {
        if (host.endsWith("accounts.google.com")) return true;
        // Supabase's OAuth entry point, whatever the project ref.
        String path = url.getPath() == null ? "" : url.getPath();
        return host.endsWith("supabase.co") && path.startsWith("/auth/v1/authorize");
    }

    private boolean isOurs(String host) {
        return host.isEmpty()
                || host.equals("appassets.androidplatform.net")
                || host.endsWith("bncphysics.com")
                || host.endsWith("supabase.co");
    }

    private void openCustomTab(Uri url) {
        try {
            CustomTabsIntent tab = new CustomTabsIntent.Builder()
                    .setShowTitle(false)
                    .setUrlBarHidingEnabled(true)
                    .build();
            tab.launchUrl(this, url);
        } catch (Exception e) {
            // No browser capable of Custom Tabs. Falling back beats failing.
            openExternally(url);
        }
    }

    private void openExternally(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (Exception ignored) { /* nothing can open it; stay put */ }
    }

    // -----------------------------------------------------------------
    // Sign-in callback
    // -----------------------------------------------------------------

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAuthCallback(intent);
    }

    private void handleAuthCallback(@Nullable Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if (!CALLBACK_SCHEME.equals(data.getScheme())) return;
        if (!CALLBACK_HOST.equals(data.getHost())) return;

        // Supabase returns the tokens in the fragment. Some flows use the
        // query string instead, so accept either.
        String payload = data.getFragment();
        if (payload == null || payload.isEmpty()) payload = data.getQuery();
        if (payload == null || payload.isEmpty()) return;

        pendingAuthFragment = payload;
        flushPendingAuth();
    }

    /**
     * Hands the tokens to the page. The web build exposes window.__bncAuth,
     * which calls supabase.auth.setSession — so the session is established by
     * the same library that manages it everywhere else, rather than by writing
     * storage from native code.
     */
    private void flushPendingAuth() {
        if (pendingAuthFragment == null || !pageReady) return;
        String js = "window.__bncAuth && window.__bncAuth("
                + JSONObject.quote(pendingAuthFragment) + ")";
        web.evaluateJavascript(js, null);
        pendingAuthFragment = null;
    }

    // -----------------------------------------------------------------
    // Navigation and lifecycle
    // -----------------------------------------------------------------

    /** Hides the status and navigation bars while a video is fullscreen.
     *  Not named setImmersive — Activity already defines that. */
    private void setVideoImmersive(boolean on) {
        WindowInsetsControllerCompat c =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (on) {
            c.hide(WindowInsetsCompat.Type.systemBars());
            c.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            c.show(WindowInsetsCompat.Type.systemBars());
        }
    }

    private void wireBackButton() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Back must leave fullscreen first, not navigate the page away
                // from underneath the player.
                if (fullscreenView != null) {
                    WebChromeClient c = web.getWebChromeClient();
                    if (c != null) c.onHideCustomView();
                    return;
                }
                if (web.canGoBack()) {
                    web.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            ((LinearLayout) web.getParent()).removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }

    // -----------------------------------------------------------------
    // Root check
    // -----------------------------------------------------------------

    /**
     * A warning, not a lock.
     *
     * Blocking rooted devices outright reads well in a feature list, but the
     * detection is heuristic and a false positive means a paying student cannot
     * open the app at all — a support call BNC has to field. Anyone determined
     * enough to root a phone will also defeat a native check, so the honest
     * value here is deterrence, not prevention.
     *
     * To make it a hard block, replace the dismiss button with finish().
     */
    private void warnIfRooted() {
        if (!RootCheck.looksRooted()) return;
        new AlertDialog.Builder(this)
                .setTitle(R.string.root_title)
                .setMessage(R.string.root_body)
                .setPositiveButton(R.string.root_ok, null)
                .setCancelable(true)
                .show();
    }

    /** Kept for the JavaScript bridge referenced by proguard-rules.pro. */
    public static class Bridge {
        @android.webkit.JavascriptInterface
        public String platform() {
            return "android-" + Build.VERSION.SDK_INT;
        }
    }
}
