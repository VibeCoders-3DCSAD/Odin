import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";

interface ConnectivityState {
  online: boolean;
}

export const useConnectivityStore = create<ConnectivityState>(() => ({
  online: true,
}));

let unsubscribe: (() => void) | null = null;

export function startConnectivityPolling() {
  if (unsubscribe) return;
  unsubscribe = NetInfo.addEventListener(state => {
    useConnectivityStore.setState({ online: state.isConnected !== false && state.isInternetReachable !== false });
  });
}

export function stopConnectivityPolling() {
  unsubscribe?.();
  unsubscribe = null;
}
