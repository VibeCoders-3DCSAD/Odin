import React from "react";
import { Pressable, Text, View } from "react-native";
import { CaretRight } from "phosphor-react-native";
import type { FinancialAccount } from "../../../local-db/repositories/foundations/financialFoundations";
import { accountDisplayAmount, accountIconPalette, formatPeso } from "../helpers/accountDisplay";
import { KIND_LABELS } from "../helpers/accountKinds";
import { P } from "../helpers/accountsTheme";
import { kindIcon } from "./accountKindIcon";

type Props = { account: FinancialAccount; negative: boolean; amountColor: string; isLast: boolean; onPress: () => void };

export function AccountTile({ account, negative, amountColor, isLast, onPress }: Props) {
  const creditCardDetails = account.kind === "credit_card" ? account.creditCardDetails : null;
  const amount = accountDisplayAmount(account);
  const iconPalette = accountIconPalette(account, negative);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${account.name} account actions`} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", minHeight: 56, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: "#E0DED6", backgroundColor: P.white }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: iconPalette.backgroundColor, alignItems: "center", justifyContent: "center", marginRight: 11 }}>
        {kindIcon(account.kind, 17, iconPalette.color)}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: P.ink }}>{account.name}</Text>
        <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: "Manrope", color: P.muted, marginTop: 1 }}>
          {negative ? "Negative balance" : creditCardDetails?.availableCreditCentavos != null ? "Available credit" : KIND_LABELS[account.kind] ?? account.kind}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
        <Text style={{ fontSize: 12.5, fontFamily: "Manrope", fontWeight: "700", fontVariant: ["tabular-nums"], color: amountColor }}>{formatPeso(amount)}</Text>
      </View>
      <CaretRight size={15} color={P.muted} style={{ marginLeft: 10 }} />
    </Pressable>
  );
}
