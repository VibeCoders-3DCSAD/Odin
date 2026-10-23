package expo.modules.odinpincrypto

import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

internal object PinKeyDerivation {
  fun derive(password: String, saltHex: String, iterations: Int): String {
    require(password.matches(Regex("[0-9]{6}:[0-9a-f]{64}"))) { "Invalid PIN derivation input." }
    require(saltHex.matches(Regex("[0-9a-f]{32}"))) { "Invalid PIN salt." }
    require(iterations == 600_000) { "Unsupported PIN work factor." }
    val salt = saltHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    val chars = password.toCharArray()
    val spec = PBEKeySpec(chars, salt, iterations, 256)
    try {
      val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
      try {
        return bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
      } finally {
        bytes.fill(0)
      }
    } finally {
      spec.clearPassword()
      chars.fill('\u0000')
      salt.fill(0)
    }
  }
}
