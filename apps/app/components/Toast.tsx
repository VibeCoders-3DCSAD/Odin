import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

type ToastColor = "danger" | "success" | "warning";
type ToastPosition = "top" | "down";

interface ToastOptions {
  color?: ToastColor;
  position?: ToastPosition;
  size?: "sm" | "md" | "lg";
}

const COLORS: Record<ToastColor, string> = {
  danger: "#D9001F",
  success: "#0B8A55",
  warning: "#B8860B",
};

const SIZES = {
  sm: { paddingV: 10, paddingH: 14, fontSize: 12.5 },
  md: { paddingV: 14, paddingH: 18, fontSize: 14 },
  lg: { paddingV: 16, paddingH: 22, fontSize: 15.5 },
};

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions | ToastColor) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [color, setColor] = useState<ToastColor>("danger");
  const [position, setPosition] = useState<ToastPosition>("down");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const autoDismiss = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (autoDismiss.current) clearTimeout(autoDismiss.current);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  }, [opacity]);

  const showToast = useCallback(
    (msg: string, options?: ToastOptions | ToastColor) => {
      const resolved = typeof options === "string"
        ? { color: options === "success" ? "success" as const : "danger" as const }
        : options ?? {};
      setMessage(msg);
      setColor(resolved.color ?? "danger");
      setPosition(resolved.position ?? "down");
      setSize(resolved.size ?? "md");
      setVisible(true);
      if (autoDismiss.current) clearTimeout(autoDismiss.current);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      autoDismiss.current = setTimeout(dismiss, 2500);
    },
    [opacity, dismiss],
  );

  const s = SIZES[size];
  const isTop = position === "top";

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={{ flex: 1 }}>
        {children}
        {visible ? (
          <Animated.View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              [isTop ? "top" : "bottom"]: isTop ? 60 : 100,
              left: 20,
              right: 20,
              opacity,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: COLORS[color],
              borderRadius: 12,
              paddingLeft: s.paddingH,
              paddingRight: 4,
              paddingVertical: s.paddingV,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Text
              style={{
                flex: 1,
                color: "#FFFFFF",
                fontSize: s.fontSize,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {message}
            </Text>
            <Pressable
              onPress={dismiss}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", lineHeight: 18 }}>
                ✕
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}
