import React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { P } from "../helpers/accountsTheme";

type Props = Pick<TextInputProps, "value" | "onChangeText" | "placeholder" | "keyboardType"> & { invalid?: boolean };

export function AccountTextInput({ invalid = false, ...inputProps }: Props) {
  return (
    <TextInput
      {...inputProps}
      placeholderTextColor={P.muted}
      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: invalid ? P.error : P.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: P.ink, backgroundColor: P.card }}
    />
  );
}
