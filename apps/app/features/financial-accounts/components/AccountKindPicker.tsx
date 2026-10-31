import React from "react";
import { Pressable, Text, View } from "react-native";
import type { FinancialAccountKind } from "../../../local-db/repositories/foundations/financialFoundations";
import { ACCOUNT_KINDS, KIND_LABELS } from "../helpers/accountKinds";
import { P } from "../helpers/accountsTheme";
import { kindIcon } from "./accountKindIcon";

export function AccountKindPicker({ kind, onChange }: { kind: FinancialAccountKind; onChange: (kind: FinancialAccountKind) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {ACCOUNT_KINDS.map((k) => (
        <Pressable
          key={k}
          onPress={() => onChange(k)}
          accessibilityRole="radio"
          accessibilityLabel={KIND_LABELS[k]}
          accessibilityState={{ checked: kind === k }}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: kind === k ? P.brand : P.card, gap: 6 }}
        >
          {kindIcon(k, 16, kind === k ? P.white : P.ink2)}
          <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: kind === k ? P.white : P.ink2 }}>{KIND_LABELS[k]}</Text>
        </Pressable>
      ))}
    </View>
  );
}
