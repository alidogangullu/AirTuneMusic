import { NativeModules, NativeEventEmitter } from 'react-native';

const { TVLinkServer } = NativeModules;
const eventEmitter = new NativeEventEmitter(TVLinkServer);

export interface TokenReceivedEvent {
  code: string;
  musicUserToken: string;
}

export const startLocalServer = async (devToken: string, port: number = 8080): Promise<string> => {
  if (!TVLinkServer) {
    console.warn('TVLinkServer module not found');
    return '127.0.0.1';
  }

  try {
    return await TVLinkServer.startServer(port, devToken);
  } catch (err) {
    console.warn('TVLinkServer start failed:', err);
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
