package ru.anigalaxy.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/**
 * AniGalaxy: нативная оболочка вокруг сайта anigalaxy.space.
 * Своё окно без адресной строки, экран загрузки, офлайн-экран,
 * полноэкранный плеер, загрузка файлов и системная кнопка «назад».
 */
public class MainActivity extends Activity {

    private static final String HOST = "anigalaxy.space";
    private static final String HOME = "https://" + HOST + "/?source=app";
    private static final int BG = 0xFF07070C;
    private static final int ACCENT = 0xFF3B82F6;
    private static final int FILE_REQ = 7;

    private FrameLayout root;
    private WebView web;
    private ProgressBar bar;
    private View splash;
    private View offline;
    private View fullView;
    private WebChromeClient.CustomViewCallback fullCallback;
    private ValueCallback<Uri[]> fileCallback;
    private boolean splashGone = false;
    private boolean mainFailed = false;
    private final Handler ui = new Handler(Looper.getMainLooper());

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.setStatusBarColor(BG);
        w.setNavigationBarColor(BG);
        w.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);

        root = new FrameLayout(this);
        root.setBackgroundColor(BG);

        web = new WebView(this);
        web.setBackgroundColor(BG);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        if (Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(false);
        // Сайт узнаёт приложение по этой метке (например, чтобы не предлагать «установить PWA»)
        s.setUserAgentString(s.getUserAgentString() + " AniGalaxyApp/" + BuildConfig.VERSION_NAME);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, ua, cd, mime, len) -> openExternal(Uri.parse(url)));

        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setProgressTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        bar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.TRANSPARENT));
        bar.setIndeterminate(false);
        bar.setVisibility(View.GONE);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(-1, dp(3));
        bp.gravity = Gravity.TOP;
        bp.topMargin = -dp(1);
        root.addView(bar, bp);

        offline = buildOffline();
        offline.setVisibility(View.GONE);
        root.addView(offline, new FrameLayout.LayoutParams(-1, -1));

        splash = buildSplash();
        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));

        setContentView(root);

        if (state != null) web.restoreState(state);
        else web.loadUrl(urlFrom(getIntent()));

        // Если сеть медленная — всё равно убираем заставку, страница дорисуется сама
        ui.postDelayed(this::hideSplash, 7000);
    }

    private String urlFrom(Intent i) {
        Uri d = i != null ? i.getData() : null;
        if (d != null && isOurs(d)) return d.toString();
        return HOME;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri d = intent.getData();
        if (d != null && isOurs(d)) web.loadUrl(d.toString());
    }

    private static boolean isOurs(Uri u) {
        String h = u.getHost();
        return h != null && (h.equals(HOST) || h.endsWith("." + HOST));
    }

    /* ----------------------------- Заставка ----------------------------- */

    private View buildSplash() {
        FrameLayout f = new FrameLayout(this);
        f.setBackgroundColor(BG);
        f.setClickable(true);

        View glow = new View(this);
        GradientDrawable g = new GradientDrawable();
        g.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        g.setColors(new int[]{0x553B82F6, 0x183B82F6, 0x003B82F6});
        g.setGradientRadius(dp(220));
        glow.setBackground(g);
        FrameLayout.LayoutParams gp = new FrameLayout.LayoutParams(dp(460), dp(460));
        gp.gravity = Gravity.CENTER;
        gp.bottomMargin = dp(70);
        f.addView(glow, gp);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);

        ImageView cat = new ImageView(this);
        cat.setImageResource(R.drawable.splash_cat);
        cat.setAdjustViewBounds(true);
        col.addView(cat, new LinearLayout.LayoutParams(dp(190), dp(235)));

        TextView name = new TextView(this);
        name.setText("AniGalaxy");
        name.setTextColor(Color.WHITE);
        name.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        name.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
        name.setLetterSpacing(-0.03f);
        LinearLayout.LayoutParams np = new LinearLayout.LayoutParams(-2, -2);
        np.topMargin = dp(18);
        col.addView(name, np);

        TextView sub = new TextView(this);
        sub.setText("аниме · карточки · кланы");
        sub.setTextColor(0x80FFFFFF);
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(-2, -2);
        sp.topMargin = dp(4);
        col.addView(sub, sp);

        ProgressBar spin = new ProgressBar(this);
        spin.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(dp(26), dp(26));
        pp.topMargin = dp(34);
        col.addView(spin, pp);

        FrameLayout.LayoutParams cp = new FrameLayout.LayoutParams(-2, -2);
        cp.gravity = Gravity.CENTER;
        f.addView(col, cp);

        // мягкое «дыхание» маскота
        cat.setTranslationY(dp(6));
        cat.animate().translationY(-dp(6)).setDuration(1400).setInterpolator(new DecelerateInterpolator())
                .withEndAction(() -> cat.animate().translationY(dp(6)).setDuration(1400).start()).start();
        return f;
    }

    private void hideSplash() {
        if (splashGone || splash == null) return;
        splashGone = true;
        splash.animate().alpha(0f).setDuration(260).withEndAction(() -> {
            root.removeView(splash);
            splash = null;
        }).start();
    }

    /* ---------------------------- Нет сети ----------------------------- */

    private View buildOffline() {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER);
        col.setBackgroundColor(BG);
        col.setPadding(dp(32), 0, dp(32), 0);
        col.setClickable(true);

        ImageView cat = new ImageView(this);
        cat.setImageResource(R.drawable.splash_cat);
        cat.setAlpha(0.85f);
        col.addView(cat, new LinearLayout.LayoutParams(dp(130), dp(160)));

        TextView t = new TextView(this);
        t.setText("Нет соединения");
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        t.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
        t.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(-2, -2);
        tp.topMargin = dp(18);
        col.addView(t, tp);

        TextView d = new TextView(this);
        d.setText("Проверьте интернет и попробуйте ещё раз — мы сохраним место, где вы остановились.");
        d.setTextColor(0x80FFFFFF);
        d.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        d.setGravity(Gravity.CENTER);
        d.setLineSpacing(0, 1.2f);
        LinearLayout.LayoutParams dpp = new LinearLayout.LayoutParams(-2, -2);
        dpp.topMargin = dp(8);
        col.addView(d, dpp);

        TextView btn = new TextView(this);
        btn.setText("Повторить");
        btn.setTextColor(Color.WHITE);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        btn.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{0xFF2563EB, 0xFF3B82F6});
        bg.setCornerRadius(dp(999));
        btn.setBackground(bg);
        btn.setPadding(dp(34), dp(13), dp(34), dp(13));
        LinearLayout.LayoutParams bpp = new LinearLayout.LayoutParams(-2, -2);
        bpp.topMargin = dp(26);
        col.addView(btn, bpp);
        btn.setOnClickListener(v -> {
            mainFailed = false;
            offline.setVisibility(View.GONE);
            web.reload();
        });
        return col;
    }

    private boolean online() {
        ConnectivityManager c = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (c == null) return true;
        NetworkInfo n = c.getActiveNetworkInfo();
        return n != null && n.isConnected();
    }

    /* ------------------------- Ссылки и страницы ------------------------ */

    private void openExternal(Uri u) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException ignored) { }
    }

    /** true — ссылку открыли снаружи (Telegram, почта, магазины, intent://) */
    private boolean routeOutside(Uri u) {
        String sc = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
        if (sc.equals("http") || sc.equals("https")) {
            String h = u.getHost() == null ? "" : u.getHost().toLowerCase();
            if (h.equals("t.me") || h.endsWith(".t.me") || h.equals("telegram.me") || h.equals("vk.com") || h.equals("m.vk.com")
                    || h.equals("play.google.com") || h.equals("apps.rustore.ru") || h.equals("www.youtube.com") || h.equals("youtu.be")) {
                openExternal(u);
                return true;
            }
            return false; // всё остальное (сайт, оплата, вход) — внутри приложения
        }
        if (sc.equals("intent")) {
            try {
                Intent i = Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME);
                startActivity(i);
            } catch (Exception e) {
                String fb = u.getQueryParameter("browser_fallback_url");
                if (fb != null) web.loadUrl(fb);
            }
            return true;
        }
        if (sc.equals("about") || sc.equals("data") || sc.equals("blob") || sc.equals("javascript")) return false;
        openExternal(u); // tg:, mailto:, tel:, market:, sberpay: и т. п.
        return true;
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            return routeOutside(r.getUrl());
        }

        @Override
        public void onPageStarted(WebView v, String url, Bitmap fav) {
            bar.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView v, String url) {
            bar.setVisibility(View.GONE);
            CookieManager.getInstance().flush();
            if (!mainFailed) {
                offline.setVisibility(View.GONE);
                ui.postDelayed(MainActivity.this::hideSplash, 150);
            }
        }

        @Override
        public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
            if (!r.isForMainFrame()) return;
            mainFailed = true;
            hideSplash();
            offline.setVisibility(View.VISIBLE);
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView v, int p) {
            bar.setProgress(p);
            if (p >= 100) bar.setVisibility(View.GONE);
            if (p >= 70 && !mainFailed) hideSplash();
        }

        /* Полноэкранное видео из плеера */
        @Override
        public void onShowCustomView(View view, CustomViewCallback cb) {
            if (fullView != null) { cb.onCustomViewHidden(); return; }
            fullView = view;
            fullCallback = cb;
            ((FrameLayout) getWindow().getDecorView()).addView(view, new FrameLayout.LayoutParams(-1, -1));
            setFullscreenBars(true);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        @Override
        public void onHideCustomView() {
            exitFull();
        }

        /* Окна, открытые через window.open / target=_blank */
        @Override
        public boolean onCreateWindow(WebView v, boolean dialog, boolean user, Message msg) {
            WebView tmp = new WebView(MainActivity.this);
            tmp.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView t, WebResourceRequest r) {
                    Uri u = r.getUrl();
                    if (!routeOutside(u)) web.loadUrl(u.toString());
                    t.destroy();
                    return true;
                }
            });
            WebView.WebViewTransport tr = (WebView.WebViewTransport) msg.obj;
            tr.setWebView(tmp);
            msg.sendToTarget();
            return true;
        }

        /* Выбор файла: аватар, обложка клана */
        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = cb;
            try {
                startActivityForResult(p.createIntent(), FILE_REQ);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
            return true;
        }
    }

    private void exitFull() {
        if (fullView == null) return;
        ((FrameLayout) getWindow().getDecorView()).removeView(fullView);
        fullView = null;
        if (fullCallback != null) fullCallback.onCustomViewHidden();
        fullCallback = null;
        setFullscreenBars(false);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @SuppressWarnings("deprecation")
    private void setFullscreenBars(boolean on) {
        View d = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = d.getWindowInsetsController();
            if (c == null) return;
            if (on) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            } else {
                c.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            }
        } else {
            d.setSystemUiVisibility(on
                    ? View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    : 0);
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_REQ && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    /* ------------------------------ Жизнь ------------------------------- */

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (fullView != null) { exitFull(); return; }
        if (offline.getVisibility() == View.VISIBLE && web.canGoBack()) {
            offline.setVisibility(View.GONE);
            mainFailed = false;
        }
        if (web.canGoBack()) { web.goBack(); return; }
        super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (mainFailed && online()) {
            mainFailed = false;
            offline.setVisibility(View.GONE);
            web.reload();
        }
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        ui.removeCallbacksAndMessages(null);
        if (web != null) {
            ((ViewGroup) web.getParent()).removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }
}
