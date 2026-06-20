const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME
  ?? (googleIosClientId
    ? `com.googleusercontent.apps.${googleIosClientId.replace(".apps.googleusercontent.com", "")}`
    : null);
const processWithArgv = process as typeof process & { argv?: string[] };
const expoCommand = processWithArgv.argv?.slice(2).join(" ").toLowerCase() ?? "";
const requiresIosGoogleConfig = (Boolean(process.env.EAS_BUILD) && process.env.EXPO_OS === "ios")
  || process.env.EXPO_OS === "ios"
  || /\b(run:ios)\b/.test(expoCommand);

if (requiresIosGoogleConfig && !googleIosUrlScheme) {
  throw new Error(
    "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID or EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is required for iOS builds with Google Sign-In.",
  );
}

const plugins = googleIosUrlScheme
  ? [["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }]]
  : [];

const config = {
  name: "app",
  slug: "app",
  version: "1.0.0",
  scheme: "odin",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.odin.finances",
  },
  android: {
    package: "com.odin.finances",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins,
};

export default config;
