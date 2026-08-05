import { NativeModules, NativeEventEmitter } from 'react-native';

const { TVLinkServer } = NativeModules;
const eventEmitter = new NativeEventEmitter(TVLinkServer);

const SERVER_START_TIMEOUT_MS = 3000;

export interface TokenReceivedEvent {
  code: string;
  musicUserToken: string;
}

export const startLocalServer = async (devToken: string, port: number = 8080): Promise<string> => {
  if (!TVLinkServer) {
    console.warn('TVLinkServer module not found');
    return '127.0.0.1';
  }

  const startPromise = TVLinkServer.startServer(port, devToken) as Promise<string>;
  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error('TVLinkServer start timed out')), SERVER_START_TIMEOUT_MS);
  });

  try {
    return await Promise.race([startPromise, timeoutPromise]);
  } catch (err) {
    console.warn('TVLinkServer start fell back after timeout/error:', err);
    try {
      return await getLocalIp();
    } catch {
      return '127.0.0.1';
    }
  }
};

export const stopLocalServer = () => {
  if (!TVLinkServer) return;
  TVLinkServer.stopServer();
};

export const getLocalIp = async (): Promise<string> => {
  if (!TVLinkServer) return '127.0.0.1';
  return await TVLinkServer.getLocalIpAddress();
};

export const onTokenReceived = (callback: (event: TokenReceivedEvent) => void) => {
  const subscription = eventEmitter.addListener('onTokenReceived', callback);
  return () => subscription.remove();
};
