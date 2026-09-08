import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { ForecastUpstreamError, ForecastValidationError, getMlForecast, parseForecastRequest } from "../services/forecastService.js";

const router = Router();

router.post("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  try {
    const forecastRequest = parseForecastRequest(request.body);
    const payload = await getMlForecast(request.userId!, forecastRequest);
    response.status(200).json({ payload });
  } catch (error) {
    if (error instanceof ForecastValidationError) {
      response.status(400).json({ error: "Bad Request", message: "Invalid forecast request" });
      return;
    }
    const status = error instanceof ForecastUpstreamError ? error.status : 503;
    console.error("Forecast request failed", {
      user_id: request.userId,
      request_id: request.header("x-request-id")?.slice(0, 128) ?? null,
      transaction_count: Array.isArray(request.body?.historicalTransactions) ? request.body.historicalTransactions.length : 0,
      http_status: status,
      error_class: error instanceof Error ? error.constructor.name : "UnknownError",
    });
    response.status(status === 422 ? 422 : status >= 500 ? 503 : 502).json({
      error: "Service Unavailable",
      message: "Forecast information is temporarily unavailable",
    });
  }
});

export default router;
