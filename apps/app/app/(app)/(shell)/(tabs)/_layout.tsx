import { Tabs } from "expo-router";
import { ShellTabBar } from "../../../../features/shell/components/ShellTabBar";

// Each tab page draws its own top bar; the shared tab bar floats over them. Hidden tabs are frozen
// so background sync updates do not re-render them.
export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, freezeOnBlur: true }} tabBar={({ state }) => <ShellTabBar focusedTab={state.routes[state.index]?.name} />}>
    <Tabs.Screen name="dashboard" />
    <Tabs.Screen name="money" />
    <Tabs.Screen name="activity" />
    <Tabs.Screen name="plan" />
  </Tabs>;
}
