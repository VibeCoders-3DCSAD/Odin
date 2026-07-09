import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  pushOperations,
  pullChanges,
  registerDevice,
  isDeviceActive,
} from "../services/syncService.js";

const router = Router();

router.post(
  "/push",
  requireAuth,
  async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    try {
      const userId = request.userId!;
      const supabase = request.supabase!;

      const payload = request.body?.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        response.status(400).json({
          error: "Bad Request",
          message: "Request body must have a payload object",
        });
        return;
      }

      const { device_id, operations } = payload as {
        device_id?: string;
        operations?: unknown[];
      };

      if (!device_id || typeof device_id !== "string") {
        response.status(400).json({
          error: "Bad Request",
          message: "device_id is required",
        });
        return;
      }

      if (!Array.isArray(operations) || operations.length === 0) {
        response.status(400).json({
          error: "Bad Request",
          message: "operations must be a non-empty array",
        });
        return;
      }

      const active = await isDeviceActive(supabase, userId, device_id);
      if (!active) {
        response.status(400).json({
          error: "Bad Request",
          message: "Device is not registered or has been deactivated",
        });
        return;
      }

      const results = await pushOperations(supabase, userId, device_id, operations as never[]);

      response.status(200).json({ payload: { results } });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/pull",
  requireAuth,
  async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    try {
      const userId = request.userId!;
      const supabase = request.supabase!;
      const cursor = typeof request.query.cursor === "string" ? request.query.cursor : null;

      const result = await pullChanges(supabase, userId, cursor);

      response.status(200).json({ payload: result });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/register-device",
  requireAuth,
  async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    try {
      const userId = request.userId!;
      const supabase = request.supabase!;

      const payload = request.body?.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        response.status(400).json({
          error: "Bad Request",
          message: "Request body must have a payload object",
        });
        return;
      }

      const deviceId = payload.device_id;
      if (!deviceId || typeof deviceId !== "string") {
        response.status(400).json({
          error: "Bad Request",
          message: "device_id is required",
        });
        return;
      }

      await registerDevice(supabase, userId, deviceId);

      response.status(200).json({
        payload: { status: "registered", device_id: deviceId },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
