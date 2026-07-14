import { create } from "zustand";

interface ConnectivityState {
  online: boolean;
}

export const useConnectivityStore = create<ConnectivityState>(() => ({
  online: true,
}));

export function startConnectivityPolling() {
  useConnectivityStore.setState({ online: true });
}

export function stopConnectivityPolling() {}
