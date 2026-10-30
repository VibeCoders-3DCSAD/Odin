import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

// Counts how often the page has come back into focus. Keying content by it remounts the screen on every
// return, so it reloads its data as each visit did under the old single-page shell.
export function useRefocusKey() {
  const [visits, setVisits] = useState(0);
  const focusedBefore = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focusedBefore.current) setVisits((value) => value + 1);
    focusedBefore.current = true;
  }, []));
  return visits;
}
