import { useLocalSearchParams } from "expo-router";
import LoginScreen from "../features/auth/LoginScreen";

export default function Login() {
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  return <LoginScreen noticeKey={notice} />;
}
