import type { Href } from "expo-router";
import { ROUTES } from "../../routes";

// The only way to link to a Money record page; each route re-checks the id and its owner.
export const incomeSourceHref = (id: string): Href => ({ pathname: ROUTES.incomeSource, params: { id } });
export const billerHref = (id: string): Href => ({ pathname: ROUTES.biller, params: { id } });
export const billerEditHref = (id: string): Href => ({ pathname: ROUTES.billerEdit, params: { id } });
export const billerRecordHref = (id: string): Href => ({ pathname: ROUTES.billerRecord, params: { id } });
