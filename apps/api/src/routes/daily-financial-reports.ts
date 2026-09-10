import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { getServiceRoleClient } from "../lib/supabase.js";
import { recordDailyFinancialReportFailure, retryDailyFinancialReport, type ReportCadence } from "../services/alerts/dailyReportService.js";

const router = Router();

function manilaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function hasValidSecret(value: string | undefined, secret: string): boolean {
  if (!value) return false;
  const received = Buffer.from(value);
  const configured = Buffer.from(secret);
  if (received.length !== configured.length) { crypto.timingSafeEqual(configured, configured); return false; }
  return crypto.timingSafeEqual(received, configured);
}

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }

function mondayOf(date: string): Date {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value;
}

function reportTargets(today: string, existing: Set<string>): Array<{ reportDate: string; cadence: ReportCadence }> {
  const currentMonday = mondayOf(today);
  const targets: Array<{ reportDate: string; cadence: ReportCadence }> = [];
  for (let date = new Date(currentMonday); isoDate(date) <= today; date.setUTCDate(date.getUTCDate() + 1)) {
    const reportDate = isoDate(date);
    if (!existing.has(`daily:${reportDate}`)) targets.push({ reportDate, cadence: "daily" });
  }
  // A missed completed week is represented by one Monday-keyed weekly report.
  for (let week = new Date(currentMonday); ; week.setUTCDate(week.getUTCDate() - 7)) {
    const previousMonday = new Date(week);
    previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
    const reportDate = isoDate(previousMonday);
    if (reportDate < "1970-01-01") break;
    if (!existing.has(`weekly:${reportDate}`)) targets.push({ reportDate, cadence: "weekly" });
    // Six months is the report input horizon and a bounded catch-up window.
    const cutoff = new Date(`${today}T00:00:00.000Z`);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
    if (previousMonday <= cutoff) break;
  }
  return targets;
}

router.post("/run", async (request: Request, response: Response) => {
  const secret = process.env.DAILY_REPORT_SCHEDULER_SECRET;
  if (!secret || !hasValidSecret(request.header("x-scheduler-secret") ?? undefined, secret)) {
    response.status(403).json({ error: "Forbidden" });
    return;
  }

  const reportDate = typeof request.body?.payload?.report_date === "string" ? request.body.payload.report_date : manilaDate();
  const client = getServiceRoleClient();
  const { data: users, error } = await client.from("profiles").select("user_id").limit(10_000);
  if (error) throw error;

  const results = await Promise.allSettled((users ?? []).map(async ({ user_id }) => {
    const { data: reports, error: reportsError } = await client.from("daily_financial_reports").select("report_date, cadence").eq("user_id", user_id).eq("model_version", "disabled");
    if (reportsError) throw reportsError;
    for (const target of reportTargets(reportDate, new Set((reports ?? []).map((report) => `${report.cadence}:${report.report_date}`)))) {
      try {
        const report = await retryDailyFinancialReport(client, user_id, target.reportDate, target.cadence);
        console.info("daily financial report completed", { user_id, report_id: report.report_id, report_date: target.reportDate, cadence: target.cadence, evaluations: report.evaluations, alerts: report.alerts, model_version: "disabled" });
      } catch (error) {
        await recordDailyFinancialReportFailure(client, user_id, target.reportDate, target.cadence, error instanceof Error ? error.message : "report failed");
        throw error;
      }
    }
  }));
  const failed = results.filter((result) => result.status === "rejected").length;
  console.info("daily financial report scheduler completed", { report_date: reportDate, users: results.length, failed, model_version: "disabled" });
  response.status(200).json({ processed: results.length, failed });
});

export default router;
