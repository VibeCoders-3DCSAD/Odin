import { Redirect } from "expo-router";
import { ROUTES } from "../../../../../routes";

export default function PlanIndex() {
  return <Redirect href={ROUTES.planDebts} />;
}
