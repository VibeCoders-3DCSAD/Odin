import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Modal, Pressable, View } from "react-native";

type ActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  backdropColor?: string;
  accessibilityLabel?: string;
};

/** Keeps the backdrop fade independent from the sheet's vertical slide. */
export function ActionSheet({ visible, onClose, children, backdropColor = "rgba(0,0,0,0.4)", accessibilityLabel = "Close" }: ActionSheetProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetOffset = useRef(new Animated.Value(1000)).current;
  const [sheetHeight, setSheetHeight] = useState(0);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.setValue(0);
      sheetOffset.setValue(1000);
      const openTimer = setTimeout(() => {
        const openingAnimation = Animated.parallel([
          Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(sheetOffset, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]);
        openingAnimation.start();
      }, 0);
      return () => clearTimeout(openTimer);
    }

    const closingAnimation = Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetOffset, { toValue: sheetHeight || 1000, duration: 220, useNativeDriver: true }),
    ]);
    const closeTimer = setTimeout(() => setMounted(false), 220);
    closingAnimation.start();
    return () => {
      clearTimeout(closeTimer);
      closingAnimation.stop();
    };
  }, [backdropOpacity, sheetOffset, visible]);

  return (
    // Drawn under the system bars: on Android the modal window otherwise stops above the navigation bar, and
    // BottomSheetSurface's safe-area padding then doubles the space below the sheet.
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: backdropOpacity }}>
          <Pressable accessibilityLabel={accessibilityLabel} onPress={onClose} style={{ flex: 1, backgroundColor: backdropColor }} />
        </Animated.View>
        <Animated.View onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)} style={{ width: "100%", transform: [{ translateY: sheetOffset }] }}>
          {mounted ? children : null}
        </Animated.View>
      </View>
      </Modal>
  );
}
