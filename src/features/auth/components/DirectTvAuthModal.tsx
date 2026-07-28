import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';
import type { WebViewSource } from 'react-native-webview/lib/WebViewTypes';
import { getDeveloperToken } from '../../../api/apple-music/getDeveloperToken';
import { setMusicUserToken } from '../../../api/apple-music/musicUserToken';
import { useTheme } from '../../../theme';
import { radius, spacing } from '../../../theme/layout';

export type DirectTvAuthModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
};

// Spatial navigation for Apple's login pages (D-pad support)
const SPATIAL_NAV_JS = `
  (function() {
    if (window.__spatialNavInstalled) return;
    window.__spatialNavInstalled = true;

    function getFocusableElements() {
      return Array.from(document.querySelectorAll('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'))
        .filter(function(el) {
          return !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        });
    }
    
    function focusNext(direction) {
      var elements = getFocusableElements();
      if (elements.length === 0) return;
      var currentIndex = elements.indexOf(document.activeElement);
      if (currentIndex === -1) {
        currentIndex = direction === 1 ? 0 : elements.length - 1;
      } else if (direction === 1) {
        currentIndex = (currentIndex + 1) % elements.length;
      } else {
        currentIndex = (currentIndex - 1 + elements.length) % elements.length;
      }
      elements[currentIndex].focus();
    }
    
    window.addEventListener('keydown', function(e) {
      if (['ArrowDown', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        focusNext(1);
      } else if (['ArrowUp', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault();
        focusNext(-1);
      }
    }, true);

    // Scroll focused input into view (debounced, only once per focus)
    document.addEventListener('focusin', function(e) {
      var el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        setTimeout(function() { el.scrollIntoView({ block: 'nearest' }); }, 350);
      }
    }, true);

    // Auto-focus first interactive element when DOM changes (handles OTP screen)
    var focusTimer = null;
    var observer = new MutationObserver(function() {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(function() {
        var elements = getFocusableElements();
        if (elements.length > 0) {
          var active = document.activeElement;
          if (!active || active === document.body || !elements.includes(active)) {
            var firstInput = elements.find(function(el) { return el.tagName === 'INPUT'; });
            (firstInput || elements[0]).focus();
          }
        }
      }, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  })();
  true;
`;

export function DirectTvAuthModal({
  visible,
  onClose,
  onSuccess,
}: DirectTvAuthModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [devToken, setDevToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [closeBtnFocused, setCloseBtnFocused] = useState(false);
  // Main WebView source (our MusicKit JS page)
  const [mainSource, setMainSource] = useState<WebViewSource | null>(null);
  // Popup WebView URL (Apple's login page)
  const [popupUrl, setPopupUrl] = useState<string | null>(null);
  const mainWebviewRef = useRef<WebView>(null);
  const popupWebviewRef = useRef<WebView>(null);
  // The mock window object ID so we can route postMessages back correctly
  const popupOriginRef = useRef<string>('https://authorize.music.apple.com');

  useEffect(() => {
    if (!visible) return;
    setDevToken(null);
    setLoading(true);
    setMainSource(null);
    setPopupUrl(null);

    let isCancelled = false;
    getDeveloperToken()
      .then(token => {
        if (!isCancelled) {
          setDevToken(token);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => { isCancelled = true; };
  }, [visible]);

  // Build main HTML that uses MusicKit and intercepts window.open
  useEffect(() => {
    if (!devToken) return;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apple Music Sign In</title>
  <script>
    // Intercept window.open — tell React Native to show the popup WebView
    // Return a real mock window that MusicKit will use to communicate with the popup
    window.open = function(url, name, features) {
      var mockWin = {
        closed: false,
        location: { href: url || '' },
        focus: function() {},
        close: function() { mockWin.closed = true; },
        // When MusicKit calls popup.postMessage(...) from the parent side, ignore — not needed
        postMessage: function() {},
      };
      if (url && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_POPUP', url: String(url) }));
      }
      return mockWin;
    };

    document.addEventListener('musickitloaded', function() {
      try {
        MusicKit.configure({ developerToken: "${devToken}" });
        setTimeout(function() {
          if (typeof startAuth === 'function') startAuth();
        }, 300);
      } catch (err) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AUTH_ERROR', error: String(err) }));
        }
      }
    });
  </script>
  <script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js" async></script>
  <style>
    body { background: transparent; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, sans-serif; }
    #status { font-size: 0.9rem; color: #aaa; }
  </style>
</head>
<body>
  <div id="status">${t('common.loading')}</div>
  <script>
    async function startAuth() {
      try {
        var music = MusicKit.getInstance();
        var token = await music.authorize();
        if (token && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TOKEN', token: token }));
        }
      } catch (err) {
        document.getElementById('status').textContent = 'Cancelled.';
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AUTH_ERROR', error: String(err) }));
        }
      }
    }
  </script>
</body>
</html>`;
    setMainSource({ html, baseUrl: 'https://music.apple.com' });
  }, [devToken, t]);

  // Main WebView message handler
  const handleMainMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'OPEN_POPUP' && data.url) {
        console.log('[DirectTvAuth] Opening popup WebView:', data.url);
        try {
          const urlMatch = data.url.match(/^(https?:\/\/[^/]+)/);
          popupOriginRef.current = urlMatch ? urlMatch[1] : 'https://authorize.music.apple.com';
        } catch {
          popupOriginRef.current = 'https://authorize.music.apple.com';
        }
        setPopupUrl(data.url);
      } else if (data.type === 'TOKEN' && data.token) {
        console.log('[DirectTvAuth] Token received!');
        setMusicUserToken(data.token);
        onSuccess(data.token);
        onClose();
      } else if (data.type === 'AUTH_ERROR') {
        console.log('[DirectTvAuth] Auth error:', data.error);
        onClose();
      }
    } catch {
      // ignore non-json
    }
  };

  const handlePopupMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'DEBUG') {
        console.log('[DirectTvAuth] Popup opener debug — openerWorking:', data.openerWorking, 'openerNull:', data.openerNull);
        return;
      }

      // NOTE: POPUP_TOKEN from fetch interception is intentionally NOT handled here
      // because those are intermediate Apple-internal tokens, not the actual Music User Token.
      // The real MUT comes via OPENER_MSG (window.opener.postMessage).

      if (data.type === 'CLOSE_POPUP') {
        console.log('[DirectTvAuth] Popup closed. lastToken prefix:', data.lastToken ? String(data.lastToken).substring(0, 20) : 'none');
        setPopupUrl(null);

        // 1) Use lastSeenToken from fetch/XHR interception (last captured = most likely final MUT)
        if (data.lastToken && typeof data.lastToken === 'string' && data.lastToken.length > 40) {
          console.log('[DirectTvAuth] Using lastToken from HTTP interception');
          setMusicUserToken(data.lastToken);
          onSuccess(data.lastToken);
          onClose();
          return;
        }

        // 2) Check if OPENER_MSG already delivered the token to main WebView's MusicKit
        mainWebviewRef.current?.injectJavaScript(`
          (function() {
            try {
              var music = MusicKit.getInstance();
              if (music && music.musicUserToken) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TOKEN', token: music.musicUserToken }));
                return;
              }
            } catch(e) {}
          })();
          true;
        `);

        // 2) Try to extract Music User Token from popup's localStorage data
        const storageData: Record<string, string> = data.localStorage || {};
        const tokenKeys = ['mk-music-user-token', 'music-user-token', 'MusicUserToken', 'musicUserToken', 'DSID', 'mme_digital_token'];
        for (const key of tokenKeys) {
          if (storageData[key]) {
            console.log('[DirectTvAuth] Token found in localStorage:', key);
            setMusicUserToken(storageData[key]);
            onSuccess(storageData[key]);
            onClose();
            return;
          }
        }
        // Try any key that looks like a token (long alphanumeric string)
        for (const [key, value] of Object.entries(storageData)) {
          if (typeof value === 'string' && value.length > 40 && !value.startsWith('{') && key !== 'developerToken') {
            console.log('[DirectTvAuth] Potential token found in localStorage key:', key);
            setMusicUserToken(value);
            onSuccess(value);
            onClose();
            return;
          }
        }
        console.log('[DirectTvAuth] localStorage keys from popup:', Object.keys(storageData));

      } else if (data.type === 'OPENER_MSG') {
        // Apple's popup sent the real Music User Token via window.opener.postMessage
        console.log('[DirectTvAuth] OPENER_MSG received — forwarding to MusicKit');
        const senderOrigin = popupOriginRef.current;
        const rawPayload = data.payload;
        // rawPayload may be a JSON string (object stringified) or a plain string.
        // We must inject the ORIGINAL value (not double-stringified) so MusicKit parses it correctly.
        let payloadExpr: string;
        try {
          JSON.parse(rawPayload); // if parseable, it's a JSON value — inject as-is
          payloadExpr = rawPayload;
        } catch {
          payloadExpr = JSON.stringify(rawPayload); // plain string — wrap in quotes
        }
        mainWebviewRef.current?.injectJavaScript(`
          (function() {
            try {
              window.dispatchEvent(new MessageEvent('message', {
                data: ${payloadExpr},
                origin: ${JSON.stringify(senderOrigin)}
              }));
              // Poll MusicKit for the resolved token
              var attempts = 0;
              var poll = setInterval(function() {
                attempts++;
                try {
                  var music = MusicKit.getInstance();
                  if (music && music.musicUserToken) {
                    clearInterval(poll);
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TOKEN', token: music.musicUserToken }));
                  }
                } catch(e) {}
                if (attempts > 20) clearInterval(poll);
              }, 250);
            } catch(e) {}
          })();
          true;
        `);
      }
    } catch {
      // ignore
    }
  };

  // Injected into Apple's login popup page
  const POPUP_PAGE_JS = `
    (function() {
      ${SPATIAL_NAV_JS}

      var rnBridge = window.ReactNativeWebView;

      // Track the LAST token seen in any fetch/XHR response.
      // We use the last one (not first) because Apple may return intermediate tokens
      // before the final Music User Token.
      var lastSeenToken = null;

      function tryExtractToken(text) {
        if (!text || typeof text !== 'string') return;
        try {
          // Parse the response as JSON to handle all Unicode escapes properly
          var parsed = JSON.parse(text);
          var candidates = [
            parsed['music-user-token'],
            parsed['musicUserToken'],
            parsed && parsed.params && parsed.params['music-user-token'],
            parsed && parsed.params && parsed.params['musicUserToken'],
          ];
          for (var i = 0; i < candidates.length; i++) {
            var t = candidates[i];
            if (t && typeof t === 'string' && t.length > 40 && t.startsWith('0.')) {
              lastSeenToken = t;
              rnBridge.postMessage(JSON.stringify({ type: 'DEBUG', msg: 'Token candidate from JSON parse', prefix: t.substring(0, 20) }));
            }
          }
        } catch(e) {
          // Fallback: regex on raw text, then JSON-decode the captured value
          var match = text.match(/"(?:music-user-token|musicUserToken)"\\s*:\\s*"([^"]+)"/);
          if (match && match[1] && match[1].length > 40) {
            try {
              var decoded = JSON.parse('"' + match[1] + '"');
              if (decoded.startsWith('0.')) { lastSeenToken = decoded; }
            } catch(e2) {
              if (match[1].startsWith('0.')) { lastSeenToken = match[1]; }
            }
          }
        }
      }

      // Intercept fetch
      var origFetch = window.fetch;
      window.fetch = function() {
        return origFetch.apply(this, arguments).then(function(response) {
          try { response.clone().text().then(tryExtractToken).catch(function(){}); } catch(e) {}
          return response;
        });
      };

      // Intercept XHR
      var origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
          try { tryExtractToken(this.responseText); } catch(e) {}
        });
        return origSend.apply(this, arguments);
      };

      // Create the fake opener
      var openerObj = {
        postMessage: function(data, targetOrigin) {
          try {
            var payload = (typeof data === 'string') ? data : JSON.stringify(data);
            rnBridge.postMessage(JSON.stringify({ type: 'OPENER_MSG', payload: payload }));
          } catch(e) {
            rnBridge.postMessage(JSON.stringify({ type: 'DEBUG', msg: 'opener.postMessage threw: ' + String(e) }));
          }
        },
        location: { href: 'https://music.apple.com/', origin: 'https://music.apple.com', hostname: 'music.apple.com' },
        closed: false, focus: function() {}, close: function() {}, document: {}
      };

      var openerWorking = false;
      var strategies = [
        function() { window.opener = openerObj; },
        function() { Object.defineProperty(window, 'opener', { value: openerObj, writable: true, configurable: true }); },
        function() { Object.defineProperty(window, 'opener', { get: function() { return openerObj; }, configurable: true }); }
      ];
      for (var i = 0; i < strategies.length; i++) {
        try {
          strategies[i]();
          if (window.opener && typeof window.opener.postMessage === 'function') { openerWorking = true; break; }
        } catch(e) {}
      }
      rnBridge.postMessage(JSON.stringify({ type: 'DEBUG', openerWorking: openerWorking, openerNull: window.opener === null }));

      // Override window.close — send lastSeenToken and localStorage
      window.close = function() {
        var storageData = {};
        try {
          for (var k = 0; k < localStorage.length; k++) {
            var key = localStorage.key(k);
            if (key) storageData[key] = localStorage.getItem(key);
          }
        } catch(e) {}
        rnBridge.postMessage(JSON.stringify({
          type: 'CLOSE_POPUP',
          localStorage: storageData,
          lastToken: lastSeenToken
        }));
      };
    })();
    true;
  `;


  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.screenBackground }]}>
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={[styles.headerTitle, { color: colors.cardTitleText }]}>
              {t('auth.directTvModalTitle')}
            </Text>
            <Text style={[styles.headerHint, { color: colors.textMuted }]}>
              {t('auth.directTvHint')}
            </Text>
          </View>

          <Pressable
            style={({ focused }) => [
              styles.closeBtn,
              { backgroundColor: colors.glassButtonBg, borderColor: colors.glassButtonBorder },
              focused && styles.closeBtnFocused,
            ]}
            onPress={onClose}
            onFocus={() => setCloseBtnFocused(true)}
            onBlur={() => setCloseBtnFocused(false)}
            focusable={true}
            hasTVPreferredFocus={false}>
            <Text
              style={[
                styles.closeBtnText,
                { color: colors.alertRed },
                closeBtnFocused && { color: colors.onDarkTextPrimary },
              ]}>
              {t('common.close')}
            </Text>
          </Pressable>
        </View>

        {loading || !mainSource ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.alertRed} />
          </View>
        ) : (
          <WebView
            ref={mainWebviewRef}
            source={mainSource}
            style={styles.webview}
            onMessage={handleMainMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            focusable={true}
            hasTVPreferredFocus={true}
            onLoadEnd={() => { mainWebviewRef.current?.requestFocus(); }}
          />
        )}

        {/* Popup WebView — Apple's login page */}
        {popupUrl && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', zIndex: 10, elevation: 10 }]}>
            <WebView
              ref={popupWebviewRef}
              source={{ uri: popupUrl }}
              style={{ flex: 1 }}
              onMessage={handlePopupMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              focusable={true}
              hasTVPreferredFocus={true}
              injectedJavaScriptBeforeContentLoaded={POPUP_PAGE_JS}
              injectedJavaScriptForMainFrameOnly={false}
              onLoadEnd={() => { popupWebviewRef.current?.requestFocus(); }}
              onNavigationStateChange={() => {
                // Delay to let the new page render before stealing focus
                setTimeout(() => { popupWebviewRef.current?.requestFocus(); }, 200);
              }}
            />
            <Pressable
              style={({ focused }) => [
                {
                  position: 'absolute',
                  top: spacing.xl,
                  right: spacing.xl,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  backgroundColor: colors.glassButtonBg,
                  borderWidth: 1,
                  borderColor: colors.glassButtonBorder,
                  borderRadius: radius.md,
                },
                focused && { backgroundColor: colors.alertRed, borderColor: colors.alertRed },
              ]}
              onPress={() => { setPopupUrl(null); onClose(); }}
              onFocus={() => setCloseBtnFocused(true)}
              onBlur={() => setCloseBtnFocused(false)}
              focusable={true}
              hasTVPreferredFocus={false}>
              <Text style={{
                color: closeBtnFocused ? colors.onDarkTextPrimary : colors.alertRed,
                fontWeight: '700',
              }}>
                {t('common.close')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitleGroup: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerHint: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  closeBtnFocused: {
    backgroundColor: '#f0535b',
    borderColor: '#f0535b',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
  },
});
