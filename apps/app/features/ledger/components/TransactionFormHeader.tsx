import { Pressable, Text, View } from "react-native";
import { ArrowLeft } from "phosphor-react-native";
import { Banner, v4, v4Font } from "../../../components/BudgieForm";

type Props = {
  title: string;
  categoryPickerOpen: boolean;
  online: boolean;
  onBack: () => void;
};

// Back closes the category page when it is open, otherwise the whole form.
export default function TransactionFormHeader({ title, categoryPickerOpen, online, onBack }: Props) {
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingBottom: 8 }}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={categoryPickerOpen ? "Back to transaction form" : "Close transaction form"}
          style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
        >
          <ArrowLeft color={v4.ink} size={20} weight="bold" />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontFamily: v4Font, fontWeight: "800", fontSize: 16.5, letterSpacing: -0.2, color: v4.ink }}>
          {categoryPickerOpen ? "Select Category" : title}
        </Text>
      </View>

      {!online && !categoryPickerOpen ? (
        <View style={{ marginBottom: 12 }}>
          <Banner tone="warn">You're offline. Changes will sync when you reconnect.</Banner>
        </View>
      ) : null}
    </>
  );
}
