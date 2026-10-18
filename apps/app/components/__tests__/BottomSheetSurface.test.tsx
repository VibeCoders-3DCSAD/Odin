import React from "react";
import { StyleSheet, Text } from "react-native";
import { render } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { BottomSheetSurface } from "../BottomSheetSurface";

describe("BottomSheetSurface", () => {
  it("adds the device bottom inset to the sheet spacing", () => {
    const view = render(
      <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 24, left: 0 }}>
        <BottomSheetSurface bottomSpacing={20} style={{ backgroundColor: "white" }}>
          <Text>Sheet actions</Text>
        </BottomSheetSurface>
      </SafeAreaInsetsContext.Provider>,
    );

    const surface = view.getByTestId("bottom-sheet-safe-area");
    expect(StyleSheet.flatten(surface.props.style)).toEqual(expect.objectContaining({
      paddingBottom: 44,
    }));
  });
});
