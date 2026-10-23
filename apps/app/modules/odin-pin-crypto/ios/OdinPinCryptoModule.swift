import CommonCrypto
import ExpoModulesCore
import Foundation

public class OdinPinCryptoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OdinPinCrypto")

    AsyncFunction("deriveKeyAsync") { (password: String, saltHex: String, iterations: Int) -> String in
      guard password.utf8.count == 71, saltHex.utf8.count == 32,
            password.range(of: "^[0-9]{6}:[0-9a-f]{64}$", options: .regularExpression) != nil,
            saltHex.range(of: "^[0-9a-f]{32}$", options: .regularExpression) != nil,
            iterations == 600_000 else {
        throw Exception(name: "InvalidPinDerivationInput", description: "Invalid PIN derivation input.")
      }
      var salt = stride(from: 0, to: saltHex.count, by: 2).map { offset -> UInt8 in
        let start = saltHex.index(saltHex.startIndex, offsetBy: offset)
        let end = saltHex.index(start, offsetBy: 2)
        return UInt8(saltHex[start..<end], radix: 16)!
      }
      var input = Array(password.utf8)
      var output = [UInt8](repeating: 0, count: 32)
      defer {
        input.withUnsafeMutableBytes { $0.initializeMemory(as: UInt8.self, repeating: 0) }
        salt.withUnsafeMutableBytes { $0.initializeMemory(as: UInt8.self, repeating: 0) }
        output.withUnsafeMutableBytes { $0.initializeMemory(as: UInt8.self, repeating: 0) }
      }
      let status = input.withUnsafeBytes { inputBytes in
        salt.withUnsafeBytes { saltBytes in
          output.withUnsafeMutableBytes { outputBytes in
            CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2),
              inputBytes.baseAddress!.assumingMemoryBound(to: Int8.self), input.count,
              saltBytes.baseAddress!.assumingMemoryBound(to: UInt8.self), salt.count,
              CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(iterations),
              outputBytes.baseAddress!.assumingMemoryBound(to: UInt8.self), 32)
          }
        }
      }
      guard status == kCCSuccess else {
        throw Exception(name: "PinDerivationFailed", description: "PIN protection could not be completed.")
      }
      return output.map { String(format: "%02x", $0) }.joined()
    }
  }
}
