import type { Href } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { parseRouteId } from "../../../lib/routeParams";
import { useSession } from "../../auth/components/AccessProvider";
import { shellPalette as palette } from "../theme";
import { InnerPage } from "./InnerPage";
import { useShellPage } from "./PageScroll";

// A userId-scoped read: anything falsy means the record is gone or belongs to someone else.
// Keep it stable (module scope or a repository function): it is an effect dependency.
export type LoadOwnedRecord = (userId: string, id: string) => Promise<unknown>;

type Status = "loading" | "found" | "missing";

type Props = {
  // The raw [id] route param: untrusted until it is id-shaped and loads for this user.
  id: string | string[] | undefined;
  load: LoadOwnedRecord;
  // Completes "This … can't be opened".
  noun: string;
  onClose: () => void;
  children: (id: string) => ReactNode;
};

// Renders children only for a record this user owns; anything else gets a not-found state with a way back.
export function OwnedRecord({ id: rawId, load, noun, onClose, children }: Props) {
  const { userId } = useSession();
  const id = parseRouteId(rawId);
  const [status, setStatus] = useState<Status>(id ? "loading" : "missing");

  useEffect(() => {
    if (!id) { setStatus("missing"); return; }
    let active = true;
    setStatus("loading");
    load(userId, id)
      .then((record) => { if (active) setStatus(record ? "found" : "missing"); })
      .catch(() => { if (active) setStatus("missing"); });
    return () => { active = false; };
  }, [id, load, userId]);

  if (status === "found" && id) return <>{children(id)}</>;
  if (status === "loading") {
    return <View className="flex-1 items-center justify-center py-16"><ActivityIndicator color={palette.brand} /></View>;
  }
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink, textAlign: "center" }}>
        This {noun} can't be opened
      </Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 8, textAlign: "center" }}>
        It may have been deleted or is no longer available.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onClose}
        style={{ marginTop: 20, minHeight: 48, paddingHorizontal: 28, borderRadius: 14, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>Go back</Text>
      </Pressable>
    </View>
  );
}

function OwnedRecordWithBack(props: Omit<Props, "onClose">) {
  const { goBack } = useShellPage();
  return <OwnedRecord {...props} onClose={goBack} />;
}

// Inner page for an [id] route whose not-found button goes Back like the header does.
export function OwnedRecordPage({ title, fallbackHref, ...record }: Omit<Props, "onClose"> & { title: string; fallbackHref: Href }) {
  return <InnerPage title={title} fallbackHref={fallbackHref}><OwnedRecordWithBack {...record} /></InnerPage>;
}
