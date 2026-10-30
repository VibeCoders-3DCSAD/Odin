import { View } from "react-native";
import AuthExperience from "../components/AuthExperience";
import { useAccess } from "../features/auth/components/AccessProvider";
import { signOutGoogle, startGoogleSignIn } from "../features/auth/services/googleSignIn";
import { useAuthStore } from "../features/auth/stores/useAuthStore";

export default function Login() {
  const { links } = useAccess();
  const authError = useAuthStore((state) => state.error);
  return <View className="flex-1">
    <AuthExperience
      authError={authError}
      google={{ signIn: startGoogleSignIn, signOut: signOutGoogle }}
      isPasswordRecovery={links.isPasswordRecovery} isResolvingRecoveryToken={links.isResolvingRecoveryToken}
      recoveryRefreshToken={links.recoveryRefreshToken ?? undefined} recoveryToken={links.recoveryToken ?? undefined}
      verificationToken={links.verificationToken ?? undefined}
      onAuthenticated={useAuthStore.getState().acceptLogin}
      onLoggedOut={() => { void useAuthStore.getState().lock(); }} />
  </View>;
}
