import cors from "cors";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import eligibilityProfileRoutes from "./routes/eligibility-profile.js";
import privacyRoutes from "./routes/privacy.js";
import pushDeviceTokenRoutes from "./routes/push-device-tokens.js";
import consentRoutes from "./routes/consents.js";
import dataExportRoutes from "./routes/data-export-requests.js";
import accountDeletionRoutes from "./routes/account-deletion-requests.js";
import categoryGroupRoutes from "./routes/category-groups.js";
import categoryRoutes from "./routes/categories.js";
import subcategoryRoutes from "./routes/subcategories.js";
import categoryRestrictionRoutes from "./routes/category-restrictions.js";
import subcategoryRestrictionRoutes from "./routes/subcategory-restrictions.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
app.use("/odin/api/privacy", privacyRoutes);
app.use("/odin/api", pushDeviceTokenRoutes);
app.use("/odin/api/consents", consentRoutes);
app.use("/odin/api", dataExportRoutes);
app.use("/odin/api", accountDeletionRoutes);
app.use("/odin/api/category-groups", categoryGroupRoutes);
app.use("/odin/api/categories", categoryRoutes);
app.use("/odin/api/subcategories", subcategoryRoutes);
app.use("/odin/api/category-restrictions", categoryRestrictionRoutes);
app.use("/odin/api/subcategory-restrictions", subcategoryRestrictionRoutes);

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
