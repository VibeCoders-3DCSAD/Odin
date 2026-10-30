import { Slot, usePathname } from "expo-router";
import { TabPage } from "../../../../../features/shell/components/TabPage";
import { hubs, SCROLL_TO_END_PAGES } from "../../../../../features/shell/helpers/shellNavigation";

// The hub title and segment row stay put while the selected segment renders below them.
export default function PlanLayout() {
  const pathname = usePathname();
  return <TabPage tab="plan" hub={{ hub: hubs.plan, pathname }} showScrollToEnd={SCROLL_TO_END_PAGES.has(pathname)}>
    <Slot />
  </TabPage>;
}
