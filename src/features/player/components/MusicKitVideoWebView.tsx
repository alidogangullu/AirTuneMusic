import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface MusicKitVideoWebViewRef {
  playQueue: (ids: string[], startIndex: number) => void;
  pause: () => void;
  play: () => void;
  stop: () => void;
  seekTo: (positionMs: number) => void;
  skipToNext: () => void;
  skipToPrevious: () => void;
}

interface Props {
  developerToken: string;
  musicUserToken: string | null;
  onPlaybackStateChanged?: (state: string) => void;
  onTrackChanged?: (info: { id: string; title: string; artistName: string; artworkUrl: string | null; duration: number }) => void;
  onProgressChanged?: (data: { position: number; duration: number }) => void;
  onQueueIndexChanged?: (index: number) => void;
  onError?: (message: string) => void;
}

export const MusicKitVideoWebView = forwardRef<MusicKitVideoWebViewRef, Props>(
  ({ developerToken, musicUserToken, onPlaybackStateChanged, onTrackChanged, onProgressChanged, onQueueIndexChanged, onError }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const [scriptError, setScriptError] = useState(false);

    const inject = (js: string) => webViewRef.current?.injectJavaScript(`${js}\ntrue;`);

    useImperativeHandle(ref, () => ({
      playQueue: (ids: string[], startIndex: number) => {
        const safeIndex = Math.max(0, Math.min(startIndex, ids.length - 1));
        inject(`
          (async function() {
            if (!window.music) return;
            window._videoIds = ${JSON.stringify(ids)};
            window._videoIndex = ${safeIndex};
            await window._playCurrentVideo();
          })();
        `);
      },
      pause: () => inject('if (window.music) window.music.pause();'),
      play: () => inject('if (window.music) window.music.play();'),
      stop: () => inject('if (window.music) window.music.stop();'),
      seekTo: (positionMs: number) => inject(`
        if (window.music) window.music.seekToTime(${positionMs / 1000}).catch(function(){});
      `),
      skipToNext: () => inject(`
        if (window._videoIds && window._videoIndex < window._videoIds.length - 1) {
          window._videoIndex++;
          window._playCurrentVideo();
        }
      `),
      skipToPrevious: () => inject(`
        if (window._videoIds && window._videoIndex > 0) {
          window._videoIndex--;
          window._playCurrentVideo();
        }
      `),
    }));

    const validUserToken = musicUserToken && musicUserToken !== 'null' ? musicUserToken : '';

    const injectedJS = `
      try {
        window.onerror = function(msg) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: msg }));
          return true;
        };

        document.body.style.cssText = 'margin:0;padding:0;background:#000;overflow:hidden;width:100vw;height:100vh;';
        document.documentElement.style.cssText = 'margin:0;padding:0;background:#000;overflow:hidden;width:100%;height:100%;';

        var style = document.createElement('style');
        style.textContent = 'video,audio{position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;object-fit:contain!important;margin:0!important;padding:0!important;}';
        document.head.appendChild(style);

        var vc = document.createElement('div');
        vc.id = 'vc';
        vc.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;overflow:hidden;';
        document.body.appendChild(vc);

        var mk = document.createElement('script');
        mk.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
        mk.onload = function() {
          MusicKit.configure({
            developerToken: ${JSON.stringify(developerToken)},
            app: { name: 'AirTuneMusic', build: '1.0' }
          }).then(function() {
            window.music = MusicKit.getInstance();
            window.music.videoContainerElement = document.getElementById('vc');

            var userToken = ${JSON.stringify(validUserToken)};
            if (userToken) window.music.musicUserToken = userToken;

            window._videoIds = [];
            window._videoIndex = 0;

            window._playCurrentVideo = async function() {
              if (!window._videoIds || window._videoIds.length === 0) return;
              var id = window._videoIds[window._videoIndex];
              try {
                await window.music.setQueue({ musicVideo: id, startPlaying: true });
                await window.music.play();
              } catch(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Queue: ' + e.message }));
              }
            };

            window.music.addEventListener('playbackStateDidChange', function(event) {
              var s = event.state;
              var name = 'stopped';
              if (s === 1) name = 'loading';
              if (s === 2) name = 'playing';
              if (s === 3) name = 'paused';
              if (s === 4) name = 'stopped';
              if (s === 5) {
                // completed — advance queue
                if (window._videoIndex < window._videoIds.length - 1) {
                  window._videoIndex++;
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'queueIndex', index: window._videoIndex }));
                  window._playCurrentVideo();
                  return;
                }
                name = 'stopped';
              }
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'state', state: name }));
            });

            window.music.addEventListener('nowPlayingItemDidChange', function() {
              var item = window.music.nowPlayingItem;
              if (!item || !item.attributes) return;
              var attrs = item.attributes;
              var artworkUrl = attrs.artwork && attrs.artwork.url
                ? attrs.artwork.url.replace('{w}', '600').replace('{h}', '600')
                : null;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'track',
                id: item.id,
                title: attrs.name || '',
                artistName: attrs.artistName || '',
                artworkUrl: artworkUrl,
                duration: attrs.durationInMillis || 0,
              }));
            });

            window.music.addEventListener('playbackTimeDidChange', function() {
              var pos = window.music.currentPlaybackTime;
              var dur = window.music.currentPlaybackDuration;
              if (pos !== undefined) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'progress',
                  position: pos * 1000,
                  duration: (dur || 0) * 1000,
                }));
              }
            });

            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
          }).catch(function(err) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Config: ' + err.message }));
          });
        };
        mk.onerror = function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'MusicKit script failed to load' }));
        };
        document.head.appendChild(mk);
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Init: ' + e.message }));
      }
      true;
    `;

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'state' && onPlaybackStateChanged) {
          onPlaybackStateChanged(data.state);
        } else if (data.type === 'track' && onTrackChanged) {
          onTrackChanged({ id: data.id, title: data.title, artistName: data.artistName, artworkUrl: data.artworkUrl, duration: data.duration });
        } else if (data.type === 'progress' && onProgressChanged) {
          onProgressChanged({ position: data.position, duration: data.duration });
        } else if (data.type === 'queueIndex' && onQueueIndexChanged) {
          onQueueIndexChanged(data.index);
        } else if (data.type === 'error') {
          if (data.error.includes('MusicKit script failed to load')) {
            setScriptError(true);
          }
          onError?.(data.error);
          console.error('[VideoWebView]', data.error);
        }
      } catch (e) {
        console.warn('[VideoWebView] parse error', e);
      }
    };

    if (scriptError) {
      return (
        <View style={[styles.webview, styles.errorContainer]}>
          <Text style={styles.errorText}>Failed to load MusicKit SDK</Text>
        </View>
      );
    }

    return (
      <WebView
        ref={webViewRef}
        style={styles.webview}
        source={{ html: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#000;"></body></html>', baseUrl: 'https://apple.com' }}
        injectedJavaScript={injectedJS}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsProtectedMedia={true}
        focusable={false}
        onMessage={handleMessage}
      />
    );
  },
);

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
});
