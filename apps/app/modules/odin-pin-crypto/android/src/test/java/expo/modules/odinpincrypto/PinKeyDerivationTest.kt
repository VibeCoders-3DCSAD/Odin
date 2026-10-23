package expo.modules.odinpincrypto

import org.junit.Assert.assertEquals
import org.junit.Test

class PinKeyDerivationTest {
  @Test
  fun derivesCompatibleKeyWithLeadingZeroPin() {
    val key = PinKeyDerivation.derive("001234:" + "a".repeat(64), "b".repeat(32), 600_000)
    assertEquals("02eaf99478d7e622d56ddee11d737a5c30c0e1bfdf133fdc6cf929ebceef4938", key)
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsReducedWorkFactor() {
    PinKeyDerivation.derive("001234:" + "a".repeat(64), "b".repeat(32), 1)
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsMalformedSalt() {
    PinKeyDerivation.derive("001234:" + "a".repeat(64), "invalid", 600_000)
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsMalformedPassword() {
    PinKeyDerivation.derive("invalid", "b".repeat(32), 600_000)
  }
}
