import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface MusicKitWebPlayerRef {
  playStation: (stationId: string) => void;
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
  onTrackChanged?: (track: any) => void;
  onCapabilitiesChanged?: (data: { canSkipToNext: boolean; canSkipToPrevious: boolean }) => void;
  onProgressChanged?: (data: { position: number; duration: number; buffered: number }) => void;
  onQueueChanged?: (queue: any[]) => void;
}

export const MusicKitWebView = forwardRef<MusicKitWebPlayerRef, Props>(
  ({ developerToken, musicUserToken, onPlaybackStateChanged, onTrackChanged, onCapabilitiesChanged, onProgressChanged, onQueueChanged }, ref) => {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      playStation: (stationId: string) => {
        const safeStationId = JSON.stringify(stationId);
        webViewRef.current?.injectJavaScript(`
          (async function() {
            if (window.music) {
              async function attempt(retryCount) {
                try {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Console Warn: Authorizing before setting queue...' }));
                  await window.music.authorize();
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Console Warn: Setting queue for station ID: ' + ${safeStationId} }));
                  await window.music.setQueue({ url: "https://music.apple.com/station/" + ${safeStationId}, startPlaying: true });
                } catch(e) {
                  if (e.message.includes('Content restricted') && retryCount > 0) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Queue Error: Content restricted. Retrying in 1s...' }));
                    setTimeout(() => attempt(retryCount - 1), 1000);
                  } else {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Queue Error: ' + e.message }));
                  }
                }
              }
              attempt(1);
            }
          })();
          true;
        `);
      },
      pause: () => {
        webViewRef.current?.injectJavaScript(`
          if (window.music) window.music.pause();
          true;
        `);
      },
      play: () => {
        webViewRef.current?.injectJavaScript(`
          if (window.music) window.music.play();
          true;
        `);
      },
      stop: () => {
        webViewRef.current?.injectJavaScript(`
          if (window.music) window.music.stop();
          true;
        `);
      },
      seekTo: (positionMs: number) => {
        webViewRef.current?.injectJavaScript(`
          if (window.music) {
            var timeSec = ${positionMs} / 1000;
            window.music.seekToTime(timeSec).catch(function(e){});
          }
          true;
        `);
      },
      skipToNext: () => {
        webViewRef.current?.injectJavaScript(`
          if (window.music) window.music.skipToNextItem().catch(function(e){});
          true;
        `);
      },
      skipToPrevious: () => {
        webViewRef.current?.injectJavaScript(`
          if (window.music) window.music.skipToPreviousItem().catch(function(e){});
          true;
        `);
      }
    }), [developerToken, musicUserToken, onPlaybackStateChanged, onTrackChanged, onCapabilitiesChanged, onProgressChanged, onQueueChanged]);

    const validUserToken = musicUserToken && musicUserToken !== 'null' ? musicUserToken : '';

    const injectedJS = `
      try {
        window.onerror = function(msg, url, line) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Global Error: ' + msg }));
          return true;
        };
        console.error = function(msg) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Console Error: ' + msg }));
        };
        
        document.body.innerHTML = '';
        
        var mk = document.createElement('script');
        mk.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
        mk.onload = function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Console Warn: Starting MusicKit Config' }));
          MusicKit.configure({
            developerToken: ${JSON.stringify(developerToken)},
            app: {
              name: 'AirTuneMusic',
              build: '1.0'
            }
          }).then(() => {
            window.music = MusicKit.getInstance();
            var userToken = ${JSON.stringify(validUserToken)};
            if (userToken) {
              window.music.musicUserToken = userToken;
            }
            
            // Ensure authorization is settled before proceeding
            window.music.authorize().then(() => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Console Warn: MusicKit Authorized Successfully' }));
            }).catch(e => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Authorize Error: ' + e.message }));
            });
            
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Console Warn: MusicKit Configured Successfully' }));

            function postQueue() {
              if (!window.music || !window.music.queue || !window.music.queue.items) return;
              var items = window.music.queue.items.map(function(item, index) {
                var attrs = item.attributes || {};
                return {
                  id: item.id || '',
                  title: attrs.name || 'Station Track',
                  artistName: attrs.artistName || attrs.stationProviderName || 'Apple Music Radio',
                  albumTitle: attrs.albumName || '',
                  artworkUrl: attrs.artwork && attrs.artwork.url ? attrs.artwork.url.replace('{w}', '600').replace('{h}', '600') : null,
                  duration: attrs.durationInMillis || 0,
                  trackIndex: index,
                  playbackQueueId: index
                };
              });
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'queue', queue: items }));
            }

            function postTrackInfo() {
              var item = window.music.nowPlayingItem;
              if (item && item.attributes) {
                var attrs = item.attributes;
                
                var pId = 0;
                if (window.music.queue && window.music.queue.items) {
                   var idx = window.music.queue.items.findIndex(function(i) { return i.id === item.id; });
                   if (idx > -1) pId = idx;
                }

                var trackInfo = {
                  id: item.id,
                  title: attrs.name || 'Live Radio',
                  artistName: attrs.artistName || attrs.stationProviderName || 'Apple Music Radio',
                  albumTitle: attrs.albumName || '',
                  artworkUrl: attrs.artwork && attrs.artwork.url ? attrs.artwork.url.replace('{w}', '600').replace('{h}', '600') : null,
                  duration: attrs.durationInMillis || (window.music.currentPlaybackDuration ? window.music.currentPlaybackDuration * 1000 : 0),
                  playbackQueueId: pId,
                  trackIndex: pId
                };
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'track', track: trackInfo }));
              }
              postCapabilities();
              postQueue();
            }

            function postCapabilities() {
              if (!window.music) return;
              var next = true;
              var prev = true;
              if (typeof window.music.canSkipToNext === 'boolean') next = window.music.canSkipToNext;
              if (typeof window.music.canSkipToPrevious === 'boolean') prev = window.music.canSkipToPrevious;
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capabilities', canSkipToNext: next, canSkipToPrevious: prev }));
            }

            window.music.addEventListener('playbackStateDidChange', (event) => {
              let stateName = 'stopped';
              if (event.state === 1) stateName = 'loading';
              if (event.state === 2) {
                stateName = 'playing';
                postTrackInfo();
              }
              if (event.state === 3) stateName = 'paused';
              if (event.state === 4) stateName = 'stopped';
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'state', state: stateName }));
            });

            window.music.addEventListener('playbackTimeDidChange', (event) => {
              if (!window.music) return;
              var pos = window.music.currentPlaybackTime;
              var dur = window.music.currentPlaybackDuration;
              if (pos === undefined && window.music.currentPlaybackProgress) {
                 pos = window.music.currentPlaybackProgress * dur;
              }
              if (pos !== undefined) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({ 
                   type: 'progress', 
                   position: pos * 1000,
                   duration: (dur || 0) * 1000,
                 }));
              }
            });

            window.music.addEventListener('nowPlayingItemDidChange', postTrackInfo);
            window.music.addEventListener('metadataDidChange', postTrackInfo);
            window.music.addEventListener('capabilitiesChanged', postCapabilities);
            window.music.addEventListener('mediaSkipAvailable', postCapabilities);
            window.music.addEventListener('queueItemsDidChange', postQueue);
            window.music.addEventListener('queuePositionDidChange', postQueue);
          }).catch(err => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Config Error: ' + err.message }));
          });
        };
        document.head.appendChild(mk);
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'Inject Error: ' + e.message }));
      }
      true;
    `;

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'state' && onPlaybackStateChanged) {
          onPlaybackStateChanged(data.state);
        } else if (data.type === 'track' && onTrackChanged) {
          onTrackChanged(data.track);
        } else if (data.type === 'capabilities' && onCapabilitiesChanged) {
          onCapabilitiesChanged(data);
        } else if (data.type === 'progress' && onProgressChanged) {
          onProgressChanged({ position: data.position, duration: data.duration, buffered: 0 });
        } else if (data.type === 'queue' && onQueueChanged) {
          onQueueChanged(data.queue);
        } else if (data.type === 'error') {
          console.warn('[MusicKit Web Error]', data.error);
        }
      } catch (e) {
        console.warn('[MusicKit] Failed to parse WebView message:', e);
      }
    };

    return (
      <View style={styles.container} pointerEvents="none">
        <WebView
          ref={webViewRef}
          source={{ uri: 'https://apple.com' }}
          injectedJavaScript={injectedJS}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsProtectedMedia={true}
          onMessage={handleMessage}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
    zIndex: -9999,
  },
});
