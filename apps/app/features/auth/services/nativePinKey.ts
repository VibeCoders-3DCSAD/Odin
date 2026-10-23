import { requireOptionalNativeModule } from "expo";
import { AccessError } from "../../../lib/helpers/accessErrors";
import { tracePinStep } from "../../../lib/helpers/pinSetupTrace";

interface PinCryptoModule {
  deriveKeyAsync(password: string, saltHex: string, iterations: number): Promise<string>;
}

const nativeCrypto = requireOptionalNativeModule<PinCryptoModule>("OdinPinCrypto");
const DERIVATION_TIMEOUT_MS = 30_000;

export async function derivePinKey(pin: string, deviceSecret: string, salt: string): Promise<string> {
  if (!nativeCrypto) throw new AccessError("Install the updated app build to finish PIN setup. Your saved records are safe.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const key = await tracePinStep("crypto.native-pbkdf2", () => Promise.race([
      nativeCrypto.deriveKeyAsync(`${pin}:${deviceSecret}`, salt, 600000),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AccessError("PIN protection took too long. Please try again.")), DERIVATION_TIMEOUT_MS);
      }),
    ]));
    if (!/^[0-9a-f]{64}$/.test(key)) throw new AccessError("PIN protection could not be completed. Please try again.");
    return key;
  } finally { if (timer) clearTimeout(timer); }
}
