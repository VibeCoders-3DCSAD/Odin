import { StyleSheet } from "react-native";

export const dashboardColors = {
  page: "#EFEBE3",
  brand: "#013220",
  green: "#004D1B",
  ink: "#1B1C1A",
  secondary: "#414942",
  border: "#414942",
  divider: "#DBD7CD",
  surface: "#FFFFFF",
  mint: "#E9F6EF",
  pink: "#FCEDEF",
  expenseIcon: "#B1004C",
  error: "#8A0000",
  warning: "#722C00",
  warningFill: "#FDF3E7",
  track: "#DBD7CD",
} as const;

export const dashboardStyles = StyleSheet.create({
  card: {
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: dashboardColors.border,
    backgroundColor: dashboardColors.surface,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: "Manrope",
    fontWeight: "800",
    fontSize: 15,
    color: dashboardColors.ink,
  },
  action: {
    fontFamily: "Manrope",
    fontWeight: "700",
    fontSize: 12.5,
    color: dashboardColors.green,
  },
});
