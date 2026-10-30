import { create } from "zustand";

type ShellChromeState = {
  // Activity edits a transaction in place; the shell hides its top bar and tab bar meanwhile.
  activityEditing: boolean;
  setActivityEditing: (editing: boolean) => void;
};

export const useShellChromeStore = create<ShellChromeState>((set) => ({
  activityEditing: false,
  setActivityEditing: (activityEditing) => set({ activityEditing }),
}));
