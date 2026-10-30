import { Redirect } from "expo-router";
import { ROUTES } from "../../../../../routes";

export default function MoneyIndex() {
  return <Redirect href={ROUTES.moneyAccounts} />;
}
