import { dashboardColors } from "../../dashboard/dashboardAppearance";
import { shellPalette } from "../theme";
import type { ShellTab } from "./shellNavigation";

// Home and Activity use the newer page colour behind their chrome; everything else uses the shell colour.
export function shellPageColor(tab: ShellTab | null) {
  if (tab === "dashboard" || tab === "activity") return dashboardColors.page;
  return shellPalette.shell;
}
