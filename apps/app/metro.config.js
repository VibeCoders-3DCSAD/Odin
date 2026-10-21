const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker loads its database engine as a WebAssembly asset.
config.resolver.assetExts.push("wasm");

module.exports = withNativeWind(config, {
  input: "./global.css",
});
