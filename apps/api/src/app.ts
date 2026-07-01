import cors from "cors";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import eligibilityProfileRoutes from "./routes/eligibility-profile.js";
import pushDeviceTokenRoutes from "./routes/push-device-tokens.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/.well-known/apple-app-site-association", (_request: Request, response: Response) => {
  response.json({
    applinks: {
      apps: [],
      details: [{ appID: "TEAM_ID.com.odin.finances", paths: ["/auth/*"] }],
    },
  });
});

app.get("/.well-known/assetlinks.json", (_request: Request, response: Response) => {
  response.json([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.odin.finances",
      sha256_cert_fingerprints: [],
    },
  }]);
});

app.use((request: Request, response: Response, next: NextFunction) => {
  const start = Date.now();
  response.on("finish", () => {
    console.log(
      `${request.method} ${request.originalUrl} → ${response.statusCode} (${Date.now() - start}ms)`,
    );
  });
  next();
});

app.get("/health", (_request: Request, response: Response) => {
  response.status(200).json({
    service: "odin-api",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_request: Request, response: Response) => {
  response.status(200).json({
    message: "Odin API is running.",
  });
});

app.use("/odin/api/auth", authRoutes);
app.use("/odin/api/me", meRoutes);
app.use("/odin/api", eligibilityProfileRoutes);
app.use("/odin/api", pushDeviceTokenRoutes);

app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
  const parseError = error as Error & { type?: string };

  if (parseError.type === "entity.parse.failed" || error instanceof SyntaxError) {
    response.status(400).json({
      error: "Bad Request",
      message: "Invalid JSON in request body",
    });
    return;
  }

  console.error("Unhandled error:", error);
  response.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
});

export default app;
