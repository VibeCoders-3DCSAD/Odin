/**
 * Evaluates the Unusual Expense Detection (IQR) method in
 * apps/app/local-db/repositories/unusualSpending.ts on a held-out `anomaly_test` corpus,
 * following "Evaluation and Dataset Separation" in odin-ml docs/services/iqr/v2/methodology.md
 * (mirrors odin-ml training/scripts/modeling/evaluate_personal_iqr.py).
 *
 * 1. The clean sequence is odin-ml's PSA HFCE data used as is
 *    (training/datasets/hfce_category_forecast_2000_2026.csv, current prices, million PHP):
 *    all categories are summed per period into a single sequence. Quarter labels are dropped;
 *    the detector needs dates, so observation i gets the synthetic date 2000-01 + i months,
 *    which only encodes order. The app's twelve-month window is not applied (it would leave
 *    twelve observations).
 *    Alternatively, --input may be a wallet app export (semicolon-separated: account;category;
 *    ...;amount;...;type;...;date;transfer;...). Non-transfer expenses are scored per category,
 *    exactly as the app does. Real records carry no labels, so any natural outlier the detector
 *    flags counts as a false positive.
 * 2. The last --test-fraction of the sequence is tested (default 1 = every observation). Each
 *    observation is still scored only against earlier ones; early observations without six
 *    prior values are reported as INSUFFICIENT_HISTORY and excluded from the metrics.
 * 3. Held-out transactions the detector scores NORMAL on the clean corpus are eligible; a
 *    --rate share of them gets a controlled amount spike, k ~ Uniform(3, 5), expected_label = 1.
 * 4. The detector re-runs on the intervened corpus (rolling earlier-history baselines).
 *    Accuracy/Precision/Recall/F1 are computed over held-out transactions in a scoreable
 *    state (ANOMALOUS or NORMAL); insufficient states are reported, never counted as NORMAL.
 *
 * Usage (from odin repo root). Bundled with esbuild so expo-sqlite resolves to the Jest mock:
 *   pnpm eval:iqr                                  # 3%, 5%, 10%, 25% scenarios
 *   pnpm eval:iqr --rate 0.10 --seed 7 --input ../odin-ml/training/datasets/hfce_category_forecast_2000_2026.csv
 *   pnpm eval:iqr --input ~/Downloads/wallet_records.csv
 *
 * Provenance for every held-out record and evaluation.json are written to --output.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectUnusualSpendings } from "../apps/app/local-db/repositories/unusualSpending";

type DecisionState = "ANOMALOUS" | "NORMAL" | "INSUFFICIENT_HISTORY" | "INSUFFICIENT_VARIABILITY";

type CleanTransaction = {
  id: string;
  userId: string;
  category: string;
  timestamp: string;
  amountCentavos: number;
};

type TestRecord = {
  source_id: string;
  user_id: string;
  category: string;
  timestamp: string;
  original_amount: number;
  modified_amount: number;
  factor: number;
  injection_type: "amount_spike" | "none";
  expected_label: 0 | 1;
  decision_state: DecisionState;
};

// Detector settings, defined before scoring (must match unusualSpending.ts).
const MINIMUM_HISTORY = 6;
const MINIMUM_CALENDAR_MONTHS = 3;
const SCENARIO_RATES = [0.03, 0.05, 0.1, 0.25];

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index]!.replace(/^--/, ""), argv[index + 1] ?? "");
  const testFraction = Number(args.get("test-fraction") ?? 1);
  const rates = args.has("rate") ? [Number(args.get("rate"))] : SCENARIO_RATES;
  if (!(testFraction > 0 && testFraction <= 1) || rates.some((rate) => !(rate >= 0 && rate <= 1))) {
    throw new Error("--test-fraction must be in (0, 1] and --rate in [0, 1]");
  }
  return {
    input: args.get("input") ?? "../odin-ml/training/datasets/hfce_category_forecast_2000_2026.csv",
    seed: Number(args.get("seed") ?? 42),
    testFraction,
    rates,
    output: args.get("output") ?? "scripts/out/anomaly-test",
  };
}

const byChronology = (first: CleanTransaction, second: CleanTransaction) =>
  first.timestamp.localeCompare(second.timestamp) || first.id.localeCompare(second.id);

// Same LCG as the odin dummy-data generator; seeds the injection sampling.
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const SEQUENCE_ID = "hfce-all-categories";

function loadHfceSequence(path: string): CleanTransaction[] {
  const [header, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const columns = Object.fromEntries(header!.split(",").map((name, index) => [name.trim(), index]));
  const missing = ["year_quarter", "current_price_million_php"].filter((name) => !(name in columns));
  if (missing.length) throw new Error(`${path} is missing columns: ${missing.join(", ")}`);
  const totals = new Map<string, number>();
  for (const line of lines) {
    const cells = line.split(",");
    const period = cells[columns.year_quarter!]!;
    totals.set(period, (totals.get(period) ?? 0) + Number(cells[columns.current_price_million_php!]));
  }
  return [...totals.keys()].sort().map((_, index, periods) => {
    const date = new Date(Date.UTC(2000, index, 1)).toISOString().slice(0, 10);
    return {
      id: `obs-${String(index + 1).padStart(3, "0")}`,
      userId: SEQUENCE_ID,
      category: SEQUENCE_ID,
      timestamp: date,
      amountCentavos: Math.round(totals.get(periods[index]!)! * 100),
    };
  });
}

function splitDelimited(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') cell += line[++index];
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  return [...cells, cell];
}

function loadWalletRecords(path: string): CleanTransaction[] {
  const [header, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const columns = Object.fromEntries(splitDelimited(header!, ";").map((name, index) => [name.trim(), index]));
  const missing = ["category", "amount", "type", "date", "transfer"].filter((name) => !(name in columns));
  if (missing.length) throw new Error(`${path} is missing columns: ${missing.join(", ")}`);
  return lines.flatMap((line, index) => {
    const cells = splitDelimited(line, ";");
    const amountCentavos = Math.round(Number(cells[columns.amount!]) * 100);
    if (cells[columns.type!] !== "Expense" || cells[columns.transfer!] === "true" || !(amountCentavos > 0)) return [];
    const recordedAt = cells[columns.date!]!;
    return [{
      // The detector orders same-day expenses by ID, so the ID carries the recorded time.
      id: `${recordedAt}-${String(index).padStart(4, "0")}`,
      userId: "wallet",
      category: cells[columns.category!]!,
      timestamp: recordedAt.slice(0, 10),
      amountCentavos,
    }];
  });
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

function linearPercentile(sorted: number[], proportion: number): number {
  const position = (sorted.length - 1) * proportion;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function monthsBetween(first: string, second: string): number {
  return (Number(second.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(second.slice(5, 7)) - Number(first.slice(5, 7));
}

/**
 * ANOMALOUS comes only from the app's detector. The detector does not report why it skipped a
 * transaction, so the insufficient states are derived from its gates here and cross-checked.
 */
function decisionStates(corpus: CleanTransaction[]): Map<string, DecisionState> {
  const states = new Map<string, DecisionState>();
  for (const userTransactions of groupBy(corpus, (transaction) => transaction.userId).values()) {
    const flagged = new Set(detectUnusualSpendings(userTransactions.map((transaction) => ({
      id: transaction.id,
      transactionDate: transaction.timestamp,
      amountCentavos: transaction.amountCentavos,
      subcategoryId: transaction.category,
      subcategoryLabel: transaction.category,
      accountName: null,
    }))).map((insight) => insight.transactionId));

    for (const history of groupBy(userTransactions, (transaction) => transaction.category).values()) {
      history.sort(byChronology);
      history.forEach((transaction, index) => {
        const prior = history.slice(0, index);
        let state: DecisionState;
        if (prior.length < MINIMUM_HISTORY || monthsBetween(prior[0]!.timestamp, transaction.timestamp) < MINIMUM_CALENDAR_MONTHS) {
          state = "INSUFFICIENT_HISTORY";
        } else {
          const values = prior.map((item) => Math.log1p(item.amountCentavos / 100)).sort((a, b) => a - b);
          const iqr = linearPercentile(values, 0.75) - linearPercentile(values, 0.25);
          state = iqr === 0 ? "INSUFFICIENT_VARIABILITY" : flagged.has(transaction.id) ? "ANOMALOUS" : "NORMAL";
        }
        if (flagged.has(transaction.id) && state !== "ANOMALOUS") {
          throw new Error(`Detector flagged ${transaction.id} but the gate replication says ${state}; update this script's settings`);
        }
        states.set(transaction.id, state);
      });
    }
  }
  return states;
}

function heldOut(corpus: CleanTransaction[], testFraction: number): CleanTransaction[] {
  const test: CleanTransaction[] = [];
  for (const group of groupBy(corpus, (transaction) => `${transaction.userId}|${transaction.category}`).values()) {
    group.sort(byChronology);
    test.push(...group.slice(Math.floor(group.length * (1 - testFraction))));
  }
  return test;
}

function evaluate(corpus: CleanTransaction[], test: CleanTransaction[], cleanStates: Map<string, DecisionState>, rate: number, seed: number) {
  const random = createRandom(seed);
  const eligible = test.filter((transaction) => cleanStates.get(transaction.id) === "NORMAL").map((transaction) => transaction.id).sort();
  if (rate > 0 && eligible.length === 0) throw new Error("No eligible held-out transactions for amount-spike injection");
  const selectedCount = rate > 0 ? Math.min(eligible.length, Math.max(1, Math.floor(eligible.length * rate))) : 0;
  // Partial Fisher-Yates: sample without replacement.
  for (let index = 0; index < selectedCount; index++) {
    const swap = index + Math.floor(random() * (eligible.length - index));
    [eligible[index], eligible[swap]] = [eligible[swap]!, eligible[index]!];
  }
  const factors = new Map(eligible.slice(0, selectedCount).map((id) => [id, 3 + random() * 2]));

  const intervened = corpus.map((transaction) => factors.has(transaction.id)
    ? { ...transaction, amountCentavos: Math.round(transaction.amountCentavos * factors.get(transaction.id)!) }
    : transaction);
  const predicted = decisionStates(intervened);

  const records: TestRecord[] = test.map((transaction) => {
    const factor = factors.get(transaction.id);
    return {
      source_id: transaction.id,
      user_id: transaction.userId,
      category: transaction.category,
      timestamp: transaction.timestamp,
      original_amount: transaction.amountCentavos / 100,
      modified_amount: factor ? Math.round(transaction.amountCentavos * factor) / 100 : transaction.amountCentavos / 100,
      factor: factor ?? 1,
      injection_type: factor ? "amount_spike" : "none",
      expected_label: factor ? 1 : 0,
      decision_state: predicted.get(transaction.id)!,
    };
  });

  const scoreable = records.filter((record) => record.decision_state === "ANOMALOUS" || record.decision_state === "NORMAL");
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const record of scoreable) {
    const positive = record.decision_state === "ANOMALOUS";
    if (positive && record.expected_label === 1) tp++;
    else if (positive) fp++;
    else if (record.expected_label === 1) fn++;
    else tn++;
  }
  const metric = (numerator: number, denominator: number) => (denominator ? Number((numerator / denominator).toFixed(4)) : null);
  const metrics = {
    accuracy: metric(tp + tn, scoreable.length),
    precision: metric(tp, tp + fp),
    recall: metric(tp, tp + fn),
    f1: metric(2 * tp, 2 * tp + fp + fn),
  };
  const coverage: Record<string, number> = {};
  for (const record of records) coverage[record.decision_state] = (coverage[record.decision_state] ?? 0) + 1;

  return {
    records,
    report: {
      scenario_rate: rate,
      dataset: "anomaly_test",
      evaluated_unit: "individual expense transaction",
      positive_label: "controlled 3x-5x amount_spike intervention",
      sample_size: scoreable.length,
      held_out_sample_size: records.length,
      eligible_held_out: eligible.length,
      injected_positives: selectedCount,
      injected_positive_rate: Number((selectedCount / records.length).toFixed(4)),
      confusion_matrix: { tp, fp, tn, fn },
      metrics,
      undefined_metrics: Object.entries(metrics).filter(([, value]) => value === null).map(([name]) => name),
      decision_state_coverage: coverage,
    },
  };
}

function toCsv(records: TestRecord[]): string {
  const columns = Object.keys(records[0] ?? {}) as (keyof TestRecord)[];
  const escape = (value: unknown) => (/[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value));
  return [columns.join(","), ...records.map((record) => columns.map((column) => escape(record[column])).join(","))].join("\n") + "\n";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const isWallet = readFileSync(options.input, "utf8").split(/\r?\n/, 1)[0]!.includes(";");
  const corpus = isWallet ? loadWalletRecords(options.input) : loadHfceSequence(options.input);
  const test = heldOut(corpus, options.testFraction);
  const cleanStates = decisionStates(corpus);
  mkdirSync(options.output, { recursive: true });

  console.log("Unusual Expense Detection (Interquartile Range/IQR) — anomaly_test evaluation");
  if (isWallet) {
    console.log(`Records: wallet export, non-transfer expenses scored per category (${options.input})`);
    console.log(`  ${corpus.length} expenses in ${new Set(corpus.map((t) => t.category)).size} categories, ${corpus.map((t) => t.timestamp).sort()[0]} to ${corpus.map((t) => t.timestamp).sort().at(-1)}`);
  } else {
    console.log(`Sequence: PSA HFCE, all categories summed per period, as is (${options.input})`);
    console.log(`  ${corpus.length} observations, ordered, quarter labels removed`);
  }
  console.log(`Held out: last ${options.testFraction * 100}% of the sequence (${test.length} observations)`);
  console.log("Positive label: controlled 3x-5x amount spike. Synthetic results; not real-world performance.");

  const pct = (value: number | null) => (value === null ? "undefined (zero denominator)" : `${(value * 100).toFixed(2)}%`);
  const reports = [];
  for (const rate of options.rates) {
    const { records, report } = evaluate(corpus, test, cleanStates, rate, options.seed);
    const rateLabel = `${Math.round(rate * 100)}`;
    writeFileSync(join(options.output, `anomaly_test_rate-${rateLabel}.csv`), toCsv(records));
    reports.push(report);
    const { tp, fp, tn, fn } = report.confusion_matrix;
    console.log(`\nScenario ${rateLabel}% of eligible held-out transactions injected`);
    console.log(`  Sample size ${report.sample_size} scoreable of ${report.held_out_sample_size} held out; ${report.injected_positives} injected (${(report.injected_positive_rate * 100).toFixed(2)}% of held out)`);
    console.log(`  Decision states: ${Object.entries(report.decision_state_coverage).map(([state, count]) => `${state}=${count}`).join(", ")}`);
    console.log(`  TP=${tp} FP=${fp} TN=${tn} FN=${fn}`);
    console.log(`  Precision: ${pct(report.metrics.precision)}`);
    console.log(`  Recall   : ${pct(report.metrics.recall)}`);
    console.log(`  F1-Score : ${pct(report.metrics.f1)}`);
    console.log(`  Accuracy : ${pct(report.metrics.accuracy)}`);
  }

  writeFileSync(join(options.output, "evaluation.json"), JSON.stringify({
    detector: "apps/app/local-db/repositories/unusualSpending.ts (personal-transaction-iqr-local-v1)",
    methodology: "odin-ml docs/services/iqr/v2/methodology.md v2.3.0",
    data: isWallet
      ? { source: "wallet export, non-transfer expenses per category", input: options.input, expenses: corpus.length }
      : { source: "PSA HFCE, current prices, all categories summed per period; quarter labels removed", input: options.input, observations: corpus.length },
    injection_seed: options.seed,
    test_fraction: options.testFraction,
    scenarios: reports,
  }, null, 2) + "\n");
  console.log(`\nProvenance and evaluation.json written to ${options.output}/`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
