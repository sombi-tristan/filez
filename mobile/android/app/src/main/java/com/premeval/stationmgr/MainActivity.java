package com.premeval.stationmgr;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

/**
 * The app carries the screens as files (npm run build:android in filez-web): one page per address,
 * such as auth/login.html, and dashboard.html for every /dashboard address (its Ionic app routes
 * the rest). Capacitor answers any address without a file extension with index.html, so loading
 * /auth/login or /dashboard/stations/1 would open the wrong screen. This points such an address at
 * its page before Capacitor serves it, as electron/resolve.js does in the desktop app. Capacitor
 * still serves the page, so it still adds its bridge script to it.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.setWebViewClient(
            new BridgeWebViewClient(bridge) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    Uri page = pageFor(request.getUrl());
                    return super.shouldInterceptRequest(view, page == null ? request : new PageRequest(request, page));
                }
            }
        );
    }

    /** The page file for an app address without a file extension, or null to leave the address as it is. */
    private Uri pageFor(Uri url) {
        String path = url.getPath();
        String last = url.getLastPathSegment();
        if (!"localhost".equals(url.getHost()) || path == null || path.equals("/") || last == null || last.contains(".")) {
            return null;
        }
        String trimmed = path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
        String file = trimmed.equals("/dashboard") || trimmed.startsWith("/dashboard/") ? "/dashboard.html" : trimmed + ".html";
        return hasAsset("public" + file) ? url.buildUpon().path(file).build() : null;
    }

    private boolean hasAsset(String name) {
        try (InputStream ignored = getAssets().open(name)) {
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    /** The same request, asking for another address. */
    private static class PageRequest implements WebResourceRequest {

        private final WebResourceRequest request;
        private final Uri url;

        PageRequest(WebResourceRequest request, Uri url) {
            this.request = request;
            this.url = url;
        }

        @Override
        public Uri getUrl() {
            return url;
        }

        @Override
        public boolean isForMainFrame() {
            return request.isForMainFrame();
        }

        @Override
        public boolean isRedirect() {
            return request.isRedirect();
        }

        @Override
        public boolean hasGesture() {
            return request.hasGesture();
        }

        @Override
        public String getMethod() {
            return request.getMethod();
        }

        @Override
        public Map<String, String> getRequestHeaders() {
            return request.getRequestHeaders();
        }
    }
}
