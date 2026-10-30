import { ArrowsClockwise, Cloud } from "phosphor-react-native";
import { ActivityIndicator, Pressable } from "react-native";
import { useSync } from "../../sync/SyncProvider";
import { shellPalette as palette } from "../theme";

export function SyncStatusIcon({ size }: { size: number }) {
  const { syncing, queueCount } = useSync();
  if (syncing) return <ActivityIndicator size="small" color={palette.mut} />;
  if (queueCount > 0) return <ArrowsClockwise size={size} color="#C25E00" weight="bold" />;
  return <Cloud size={size} color="#0B8A55" weight="bold" />;
}

export function SyncButton() {
  const { syncing, queueCount, handleSync } = useSync();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={queueCount > 0 ? `${queueCount} unsynced changes` : "Synced"}
      onPress={handleSync}
      disabled={syncing}
      hitSlop={8}
    >
      <SyncStatusIcon size={20} />
    </Pressable>
  );
}
