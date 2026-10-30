import type { Href } from "expo-router";

type RouteMap = { readonly [key: string]: Href | RouteMap };

// Every navigable path in one place; screens call router.push(ROUTES.dashboard)
// instead of hardcoding strings. Authenticated routes live in app/(app)/, a group
// that shares a guarded layout without adding a URL segment. Typed routes check each
// entry against the files in app/, so add a path here when its screen lands.
export const ROUTES = {
  login: "/login",
  registration: "/registration",
  forgotPassword: "/forgot-password",
  userOnboarding: "/user-onboarding",
  dashboard: "/dashboard",
} as const satisfies RouteMap;
