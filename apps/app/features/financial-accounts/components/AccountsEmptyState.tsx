import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Wallet } from "phosphor-react-native";
import { P } from "../helpers/accountsTheme";

export function AccountsEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 18, paddingTop: 22 }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#959592", alignItems: "center", justifyContent: "center" }}>
        <Wallet size={30} color={P.ink2} />
      </View>
      <Text style={{ marginTop: 14, fontSize: 15, fontFamily: "Manrope", fontWeight: "700", color: P.ink }}>No accounts yet</Text>
      <Text style={{ marginTop: 4, fontSize: 12, fontFamily: "Manrope", lineHeight: 18, color: P.ink2, textAlign: "center" }}>Add an account to see your cash position.</Text>
      <TouchableOpacity
        onPress={onAdd}
        testID="add-account"
        accessibilityLabel="Add account"
        style={{ width: "100%", minHeight: 50, marginTop: 14, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: P.brand }}
      >
        <Text style={{ fontSize: 14, fontFamily: "Manrope", fontWeight: "800", color: P.white }}>Add an account</Text>
      </TouchableOpacity>
    </View>
  );
}
