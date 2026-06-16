import express from "express";
import type { Request, Response, NextFunction } from "express";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import eligibilityProfileRoutes from "./routes/eligibility-profile.js";
import pushDeviceTokenRoutes from "./routes/push-device-tokens.js";

const app = express();

app.use(express.json());

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
  if (error.type === "entity.parse.failed" || error instanceof SyntaxError) {
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
