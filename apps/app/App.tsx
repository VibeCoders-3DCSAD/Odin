import "./global.css";

import { StatusBar } from "expo-status-bar";
import AuthExperience from "./components/AuthExperience";

export default function App() {
  return (
    <>
      <AuthExperience
        google={{
          enabled: false,
          helperText: "Email and password are live here. Google sign-in stays on native dev builds for now.",
        }}
      />
      <StatusBar style="dark" />
    </>
  );
}
