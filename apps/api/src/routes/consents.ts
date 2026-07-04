import { Router } from "express";
import type { Response } from "express";
import {
  VALID_CONSENT_KINDS,
  VALID_CONSENT_STATUSES,
} from "../lib/constants.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();
const CONSENT_HISTORY_LIMIT = 20;
const LIST_FIELDS = "consent_kind, status, version, recorded_at";
const QUERY_FIELDS = `${LIST_FIELDS}, effective_at, withdrawn_at, source`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConsentKind(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !VALID_CONSENT_KINDS.includes(value)) {
    throw new Error("Invalid consent_kind");
  }

  return value;
}

function parseConsentPayload(payload: unknown) {
  if (!isRecord(payload)) {
    throw new Error("Payload is required");
  }

  const { consent_kind, status, version, source } = payload;

  if (typeof consent_kind !== "string" || !VALID_CONSENT_KINDS.includes(consent_kind)) {
    throw new Error("consent_kind is invalid");
  }

  if (typeof status !== "string" || !VALID_CONSENT_STATUSES.includes(status)) {
    throw new Error("status is invalid");
  }

  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error("version is required");
  }

  if (source !== undefined && (typeof source !== "string" || source.trim().length === 0)) {
    throw new Error("source must be a non-empty string when provided");
  }

  return {
    consent_kind,
    status,
    version: version.trim(),
    source: typeof source === "string" ? source.trim() : null,
  };
}

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;

  let consentKind: string | undefined;
  try {
    consentKind = parseConsentKind(request.query.consent_kind);
  } catch (error) {
    response.status(400).json({
      error: "Bad Request",
      message: error instanceof Error ? error.message : "Invalid consent_kind",
    });
    return;
  }

  let query = authenticatedSupabase
    .from("user_consents")
    .select(QUERY_FIELDS)
    .eq("user_id", userId);

  if (consentKind) {
    query = query.eq("consent_kind", consentKind);
  }

  const { data, error } = await query
    .order("recorded_at", { ascending: false })
    .limit(CONSENT_HISTORY_LIMIT);

  if (error) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch consents",
    });
    return;
  }

  response.status(200).json({
    payload: {
      items: (data ?? []).map(({ consent_kind, status, version, recorded_at }) => ({
        consent_kind,
        status,
        version,
        recorded_at,
      })),
    },
  });
});

router.post("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;

  let payload: ReturnType<typeof parseConsentPayload>;
  try {
    payload = parseConsentPayload(request.body?.payload);
  } catch (error) {
    response.status(400).json({
      error: "Bad Request",
      message: error instanceof Error ? error.message : "Invalid consent payload",
    });
    return;
  }

  const withdrawnAt = payload.status === "withdrawn" ? new Date().toISOString() : null;
  const { data, error } = await authenticatedSupabase
    .from("user_consents")
    .insert({
      user_id: userId,
      consent_kind: payload.consent_kind,
      status: payload.status,
      version: payload.version,
      source: payload.source,
      ip_address: request.ip,
      user_agent: request.get("user-agent") ?? null,
      withdrawn_at: withdrawnAt,
    })
    .select("id, status")
    .single();

  if (error || !data) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to record consent",
    });
    return;
  }

  response.status(201).json({
    payload: {
      consent: {
        id: data.id,
        status: data.status,
      },
    },
  });
});

export default router;
