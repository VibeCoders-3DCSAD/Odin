import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/useAuthStore";
import { isValidPin } from "../helpers/pinPolicy";

export default function PinAccessScreen() {
  const phase = useAuthStore((state) => state.phase);
  const busy = useAuthStore((state) => state.busy);
  const error = useAuthStore((state) => state.error);
  const lockoutMs = useAuthStore((state) => state.lockoutMs);
  const recoveryVerified = useAuthStore((state) => state.recoveryVerified);
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const setup = phase === "enrollment-required";
  const verification = phase === "verification-required";
  const lockedOut = lockoutMs > 0;
  const seconds = Math.ceil(lockoutMs / 1000);
  const countdown = `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds / 60 % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  function submit() {
    if (setup) {
      if (!isValidPin(pin) || confirmation !== pin) { setInputError("Enter matching six-digit PINs."); return; }
      Alert.alert(recoveryVerified ? "Reset your PIN?" : "Protect offline access?",
        recoveryVerified ? "Your old PIN will stop working. Your saved records and unsynced changes will be preserved."
          : "Budgie will encrypt local financial data and replace its unencrypted copy after checking the encrypted copy. Records and unsynced changes will be preserved. Keep this PIN private.",
        [{ text: "Cancel", style: "cancel" }, { text: recoveryVerified ? "Reset PIN" : "Enable PIN", onPress: () => {
          const value = pin; setPin(""); setConfirmation("");
          void useAuthStore.getState().setupPin(value);
        } }]);
    } else {
      const value = pin; setPin("");
      void useAuthStore.getState().submitPin(value);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F2] justify-center px-7">
      <View className="gap-5">
        <Text className="text-3xl font-bold text-[#013220]">
          {verification ? "Verify your account" : setup ? recoveryVerified ? "Set a new PIN" : "Create your PIN" : "Unlock Budgie"}
        </Text>
        <Text className="text-base text-[#414942]">
          {verification ? "Connect to the internet to renew offline access for 30 days. Your local records and unsynced changes are safe."
            : setup ? "Use six digits to protect this account, online and offline."
              : "Enter your six-digit PIN to open your account."}
        </Text>
        {!verification && <>
          <TextInput accessibilityLabel={setup ? "Create six-digit PIN" : "Six-digit PIN"}
            value={pin} onChangeText={(value) => { setPin(value.replace(/[^0-9]/g, "").slice(0, 6)); setInputError(null); }}
            secureTextEntry keyboardType="number-pad" maxLength={6} autoCorrect={false}
            autoComplete="off" editable={!busy && !lockedOut} placeholder="6-digit PIN"
            className="border border-[#899489] rounded-xl p-4 text-xl bg-white text-[#013220]" />
          {setup && <TextInput accessibilityLabel="Confirm six-digit PIN" value={confirmation}
            onChangeText={(value) => setConfirmation(value.replace(/[^0-9]/g, "").slice(0, 6))}
            secureTextEntry keyboardType="number-pad" maxLength={6} autoComplete="off" editable={!busy}
            placeholder="Confirm PIN" className="border border-[#899489] rounded-xl p-4 text-xl bg-white text-[#013220]" />}
        </>}
        {lockedOut && !verification && <Text accessibilityRole="timer" className="text-base text-[#D9001F]">Try again in {countdown}</Text>}
        {(inputError || error) && <Text accessibilityRole="alert" className="text-base text-[#D9001F]">{inputError || error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={verification ? "Verify online" : setup ? "Save PIN" : "Unlock"}
          disabled={busy || (!verification && (lockedOut || !isValidPin(pin) || (setup && !isValidPin(confirmation))))}
          onPress={verification ? () => { void useAuthStore.getState().verifyOnline(); } : submit}
          className="bg-[#013220] rounded-xl p-4 items-center disabled:opacity-50">
          {busy ? <View className="flex-row items-center gap-3"><ActivityIndicator color="white" />
            <Text className="text-white font-bold text-base">{setup ? "Setting up PIN…" : "Unlocking…"}</Text></View>
            : <Text className="text-white font-bold text-base">{verification ? "Verify online" : setup ? "Save PIN" : "Unlock"}</Text>}
        </Pressable>
        {!setup && <Pressable accessibilityRole="button" onPress={() => {
          if (verification) useAuthStore.setState({ phase: "recovery", error: null });
          else void useAuthStore.getState().startRecovery();
        }} className="p-3 items-center">
          <Text className="text-[#013220] font-bold">{verification ? "Sign in to verify" : "Forgot PIN? Verify online"}</Text>
        </Pressable>}
      </View>
    </SafeAreaView>
  );
}
