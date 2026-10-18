import { useContext, type ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

type BottomSheetSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  bottomSpacing?: number;
};

export function BottomSheetSurface({
  children,
  style,
  bottomSpacing = 0,
}: BottomSheetSurfaceProps) {
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;

  return (
    <Pressable
      onPress={() => {}}
      testID="bottom-sheet-safe-area"
      style={[style, { paddingBottom: bottomSpacing + bottom }]}
    >
      {children}
    </Pressable>
  );
}
