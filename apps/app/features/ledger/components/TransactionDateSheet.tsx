import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { v4, v4Font } from "../../../components/BudgieForm";
import { BottomSheetSurface } from "../../../components/BottomSheetSurface";
import { ActionSheet } from "../../../components/ActionSheet";

type Props = {
  visible: boolean;
  title: string;
  value: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
};

// Android shows its native dialog; iOS gets a spinner in a bottom sheet. Future dates are not selectable.
export default function TransactionDateSheet({ visible, title, value, onClose, onSelect }: Props) {
  if (Platform.OS === "android") {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={value}
        mode="date"
        maximumDate={new Date()}
        onChange={(_event, nextDate) => {
          onClose();
          if (nextDate) onSelect(nextDate);
        }}
      />
    );
  }

  return (
    <ActionSheet visible onClose={onClose} backdropColor="rgba(27,28,26,0.4)">
      <Pressable onPress={() => {}}>
        <BottomSheetSurface bottomSpacing={30} style={{ backgroundColor: v4.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: "#DBD7CD", alignSelf: "center", marginTop: 10 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10 }}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8}>
              <Text style={{ fontFamily: v4Font, fontWeight: "600", fontSize: 14, color: v4.mut }}>
                Cancel
              </Text>
            </Pressable>
            <Text style={{ fontFamily: v4Font, fontWeight: "800", fontSize: 16, color: v4.ink }}>
              {title}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" hitSlop={8}>
              <Text style={{ fontFamily: v4Font, fontWeight: "700", fontSize: 14, color: v4.brandMid }}>
                Done
              </Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={value}
            mode="date"
            maximumDate={new Date()}
            display="spinner"
            onChange={(_event, nextDate) => {
              if (nextDate) onSelect(nextDate);
            }}
          />
        </BottomSheetSurface>
      </Pressable>
    </ActionSheet>
  );
}
