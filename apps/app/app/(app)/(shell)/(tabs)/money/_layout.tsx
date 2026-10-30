import { Slot, usePathname } from "expo-router";
import { TabPage } from "../../../../../features/shell/components/TabPage";
import { hubs, SCROLL_TO_END_PAGES } from "../../../../../features/shell/helpers/shellNavigation";

// The hub title and segment row stay put while the selected segment renders below them.
export default function MoneyLayout() {
  const pathname = usePathname();
  return <TabPage tab="money" hub={{ hub: hubs.money, pathname }} showScrollToEnd={SCROLL_TO_END_PAGES.has(pathname)}>
    <Slot />
  </TabPage>;
}
