import * as Network from "expo-network";
import { create } from "zustand";

interface ConnectivityState {
  online: boolean;
}

export const useConnectivityStore = create<ConnectivityState>(() => ({
  online: true,
}));

let subscription: { remove: () => void } | null = null;

export function startConnectivityPolling() {
  if (subscription) return;
  subscription = Network.addNetworkStateListener(({ isConnected, isInternetReachable }) => {
    useConnectivityStore.setState({
      online: isConnected !== false && isInternetReachable !== false,
    });
  });
  Network.getNetworkStateAsync().then(({ isConnected, isInternetReachable }) => {
    useConnectivityStore.setState({
      online: isConnected !== false && isInternetReachable !== false,
    });
  });
}

export function stopConnectivityPolling() {
  subscription?.remove();
  subscription = null;
}
