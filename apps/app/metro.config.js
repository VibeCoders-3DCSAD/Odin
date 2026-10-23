const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker loads its database engine as a WebAssembly asset.
config.resolver.assetExts.push("wasm");

// Noble 1.8's browser map redirects ./crypto to ./crypto.js, which is absent
// from its export map. Resolve its browser adapter directly before that redirect.
const nobleBrowserCrypto = path.join(path.dirname(require.resolve("@noble/hashes/crypto")), "crypto.js");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  return context.resolveRequest(context,
    moduleName === "@noble/hashes/crypto" ? nobleBrowserCrypto : moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
});
