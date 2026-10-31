import React, { useState } from "react";
import { Modal, Pressable, Text } from "react-native";
import { Question } from "phosphor-react-native";
import { P } from "../helpers/accountsTheme";

export function InfoButton({ label, text }: { label: string; text: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`More information about ${label}`} onPress={() => setVisible(true)} hitSlop={8} style={{ marginLeft: 6 }}>
        <Question size={16} color={P.brand} weight="bold" />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable onPress={() => setVisible(false)} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" }}>
          <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 360, borderRadius: 16, padding: 20, backgroundColor: P.white }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>{label}</Text>
            <Text style={{ marginTop: 10, fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.ink2 }}>{text}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
