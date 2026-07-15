import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform } from "react-native";

export default function KeyboardAvoider({ children }: { children: ReactNode }) {
  const [keyboardHidden, setKeyboardHidden] = useState(true);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardHidden(false));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHidden(true));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      enabled={!keyboardHidden}
      style={keyboardHidden ? { flexGrow: 1 } : { flex: 1 }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
