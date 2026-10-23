package expo.modules.odinpincrypto

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OdinPinCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OdinPinCrypto")

    // Expo AsyncFunction dispatches this CPU work to its native module queue.
    AsyncFunction("deriveKeyAsync") { password: String, saltHex: String, iterations: Int ->
      PinKeyDerivation.derive(password, saltHex, iterations)
    }
  }
}
