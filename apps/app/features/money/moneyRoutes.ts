import type { Href } from "expo-router";
import { ROUTES } from "../../routes";

// The only way to link to a Money record page; each route re-checks the id and its owner.
export const incomeSourceHref = (id: string): Href => ({ pathname: ROUTES.incomeSource, params: { id } });
