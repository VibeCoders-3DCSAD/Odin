import type { Href } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSession } from "../../auth/components/AccessProvider";
import { parseRouteId } from "../../../lib/routeParams";
import { shellPalette as palette } from "../theme";
import { InnerPage } from "./InnerPage";
import { useShellPage } from "./PageScroll";

// Resolves to true only when the id names a record this user can open. Keep it stable (module scope):
// it is an effect dependency.
export type OwnsRecord = (userId: string, id: string) => Promise<boolean>;

type Props = {
  title: string;
  fallbackHref: Href;
  // The raw [id] route param: untrusted until it passes parseRouteId and owns().
  id: string | string[] | undefined;
  owns: OwnsRecord;
  notFoundMessage: string;
  children: (id: string) => ReactNode;
};

type Status = "loading" | "found" | "missing";

function OwnedRecord({ id: rawId, owns, notFoundMessage, children }: Omit<Props, "title" | "fallbackHref">) {
  const { userId } = useSession();
  const { goBack } = useShellPage();
  const id = parseRouteId(rawId);
  const [status, setStatus] = useState<Status>(id ? "loading" : "missing");

  useEffect(() => {
    if (!id) { setStatus("missing"); return; }
    let active = true;
    setStatus("loading");
    owns(userId, id)
      .then((owned) => { if (active) setStatus(owned ? "found" : "missing"); })
      .catch(() => { if (active) setStatus("missing"); });
    return () => { active = false; };
  }, [id, owns, userId]);

  if (status === "found" && id) return <>{children(id)}</>;
  if (status === "loading") return <View style={{ paddingTop: 32, alignItems: "center" }}><ActivityIndicator color={palette.brand} /></View>;
  return (
    <View style={{ paddingTop: 32, alignItems: "center" }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 17, color: palette.ink, textAlign: "center" }}>{notFoundMessage}</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 19, color: palette.mut, marginTop: 8, textAlign: "center" }}>
        It may have been deleted or is not available on this device.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack}
        style={{ marginTop: 20, minHeight: 48, paddingHorizontal: 28, borderRadius: 14, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>Go back</Text>
      </Pressable>
    </View>
  );
}

// Inner page for an [id] route: renders children only once the id is well formed and owned by this user,
// otherwise a not-found state whose button goes Back like the header does.
export function OwnedRecordPage({ title, fallbackHref, ...record }: Props) {
  return <InnerPage title={title} fallbackHref={fallbackHref}><OwnedRecord {...record} /></InnerPage>;
}
