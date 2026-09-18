import { env } from "../env";
import { formatINR } from "../format";
import { num, type DetectorContext } from "./context";
import {
  buildDelayFeatures,
  buildFeatures,
  DELAY_FEATURE_LABELS,
  DELAY_FEATURE_NAMES,
  FEATURE_LABELS,
  FEATURE_NAMES,
} from "./features";
import { makeFinding, valueComponent, type Finding } from "./types";

/**
 * Client for the Python model service.
 *
 * The application must never depend on this process. `ML_MODE=rules` skips it
 * entirely, and `ML_MODE=ml` calls it but treats any failure — unreachable,
 * slow, malformed — as "no ML signals this run" rather than an error. The rule
 * and statistical detectors have already produced a full alert queue by the
 * time this is called; the model adds to it or it does not.
 *
 * That is not only demo insurance. An oversight platform that goes dark
 * because a model server restarted is worse than one with no model.
 */

const TIMEOUT_MS = 30_000;

export type MlOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

type Driver = {
  feature: string;
  label: string;
  value: number;
  peer_median: number;
  contribution: number;
};

type AnomalyResponse = {
  model_version: string;
  trained_on: number;
  contamination: number;
  flagged: number;
  results: {
    work_id: string;
    score: number;
    is_anomaly: boolean;
    drivers: Driver[];
  }[];
};

type DelayResponse = {
  model_version: string;
  evaluation: {
    trained_on: number;
    tested_on: number;
    positives_in_training: number;
    roc_auc: number | null;
    precision: number | null;
    recall: number | null;
    base_rate: number;
  };
  results: {
    work_id: string;
    probability: number;
    band: string;
    drivers: Driver[];
  }[];
};

async function post<T>(path: string, body: unknown): Promise<MlOutcome<T>> {
  if (env.mlMode !== "ml") {
    return { ok: false, reason: "ML_MODE is 'rules' — the model service was not called." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${env.mlServiceUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: `Model service returned ${response.status} for ${path}.`,
      };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: `Model service unreachable at ${env.mlServiceUrl} (${message}).`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkMlService(): Promise<MlOutcome<{ status: string; model_version: string }>> {
  if (env.mlMode !== "ml") {
    return { ok: false, reason: "ML_MODE is 'rules'." };
  }
  try {
    const response = await fetch(`${env.mlServiceUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { ok: false, reason: `health check returned ${response.status}` };
    return { ok: true, data: await response.json() };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// ML_ANOMALY — multivariate outliers the single-rule detectors cannot see
// ---------------------------------------------------------------------------

export async function detectMlAnomalies(
  ctx: DetectorContext,
  contamination = 0.05,
): Promise<{ findings: Finding[]; note: string }> {
  const features = buildFeatures(ctx);
  if (features.length === 0) {
    return { findings: [], note: "No sanctioned works to score." };
  }

  const outcome = await post<AnomalyResponse>("/anomaly/score", {
    feature_names: FEATURE_NAMES,
    feature_labels: FEATURE_LABELS,
    rows: features.map((f) => ({ work_id: f.workId, values: f.values })),
    contamination,
  });

  if (!outcome.ok) return { findings: [], note: outcome.reason };

  const worksById = new Map(ctx.works.map((w) => [w.id, w]));
  const findings: Finding[] = [];

  for (const r of outcome.data.results) {
    const w = worksById.get(r.work_id);
    if (!w) continue;
    if (r.drivers.length === 0) continue; // nothing to tell the officer

    const sanctioned = num(w.sanctionedAmount);
    const top = r.drivers[0];

    findings.push(
      makeFinding(
        w.id,
        "ML_ANOMALY",
        // Deliberately makes no claim about what the rules did or did not find.
        // An earlier version said "no single rule is broken", which was false
        // whenever a rule detector had also flagged the work — and the model
        // has no way of knowing either way.
        `This work sits apart from the rest on several measures at once — most of all ${top.label.toLowerCase()}, where it reads ${formatDriverValue(top)} against a typical ${formatDriverValue({ ...top, value: top.peer_median })}. It is the combination that stands out, which is what a rule-by-rule check cannot see.`,
        {
          rule: `An IsolationForest over ${FEATURE_NAMES.length} engineered features, trained on all ${outcome.data.trained_on} sanctioned works in the dataset, flagging the ${Math.round(outcome.data.contamination * 100)}% that are hardest to explain as ordinary. Unsupervised: there is no labelled record of MPLADS irregularity to learn from, so the model is told nothing about what a problem looks like.`,
          facts: [
            { label: "Unusualness score", value: `${r.score} of 100` },
            { label: "Model", value: outcome.data.model_version },
            { label: "Works compared against", value: `${outcome.data.trained_on}` },
            { label: "Flagged in this run", value: `${outcome.data.flagged}` },
            { label: "Sanctioned amount", value: formatINR(sanctioned) },
          ],
          // Not `flagged`: these rows explain the score, they do not breach
          // anything. Marking them all red would be severity colour used as
          // decoration, and would tell the reader nothing.
          rows: r.drivers.map((d) => ({
            label: d.label,
            values: [
              { label: "This work", value: formatDriverValue(d) },
              { label: "Typical", value: formatDriverValue({ ...d, value: d.peer_median }) },
              { label: "Accounts for", value: `${d.contribution.toFixed(1)} points of the score` },
            ],
          })),
        },
        [
          {
            label: "How far the work sits from the rest",
            weight: 0.7,
            value: r.score,
            basis: `IsolationForest score of ${r.score}, from ${r.drivers.length} contributing measure${r.drivers.length === 1 ? "" : "s"}`,
          },
          {
            label: "Value at stake",
            weight: 0.3,
            value: valueComponent(sanctioned),
            basis: `${formatINR(sanctioned)} sanctioned`,
          },
        ],
      ),
    );
  }

  return {
    findings,
    note: `${outcome.data.model_version}: ${outcome.data.flagged} of ${outcome.data.trained_on} works flagged at ${Math.round(outcome.data.contamination * 100)}% contamination.`,
  };
}

/** Render a feature value the way its meaning warrants. */
function formatDriverValue(d: { feature: string; value: number }): string {
  switch (d.feature) {
    case "costPerUnitRatio":
    case "sanctionToRecommendRatio":
      return `${d.value.toFixed(2)}x`;
    case "delayRatio":
      return `${Math.round(d.value * 365)} days`;
    case "paymentProgressGap":
      return `${Math.round(d.value * 100)} points`;
    case "evidenceCompleteness":
    case "iaDistrictShare":
    case "fyEndProximity":
    case "paymentIrregularity":
      return `${Math.round(d.value * 100)}%`;
    case "sanctionLagRatio":
      return `${Math.round(d.value * 180)} days`;
    case "progressRate":
      return `${d.value.toFixed(1)} points/month`;
    case "agencyPriorLateRate":
    case "districtPriorLateRate":
    case "workTypePriorLateRate":
      return `${Math.round(d.value * 100)}% of past works late`;
    case "agencyPriorCount":
      return `${Math.round(d.value * 20)} past works`;
    case "unitCount":
      return `${Math.round(d.value)}`;
    case "sanctionMonth":
      return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Math.max(0, Math.round(d.value * 12) - 1)];
    case "amountScale":
      return `₹${Math.round(Math.pow(10, d.value * Math.log10(50000000))).toLocaleString('en-IN')}`;
    default:
      return d.value.toFixed(2);
  }
}

// ---------------------------------------------------------------------------
// Delay-risk prediction — an early warning, not an alert
// ---------------------------------------------------------------------------

export type DelayPrediction = {
  workId: string;
  probability: number;
  band: string;
  drivers: Driver[];
};

export type DelayRun = {
  predictions: DelayPrediction[];
  evaluation: DelayResponse["evaluation"] | null;
  modelVersion: string | null;
  note: string;
};

/**
 * Predicted breaches of the one-year window are stored and shown, not raised as
 * alerts. An alert says something has gone wrong and is worth an officer's
 * time; a forecast says something may go wrong, and the right response is to
 * chase the agency, not to open a case. Conflating the two would fill the
 * review queue with events that have not happened.
 */
export async function predictDelayRisk(ctx: DetectorContext): Promise<DelayRun> {
  const { train, predict } = buildDelayFeatures(ctx);

  if (predict.length === 0) {
    return {
      predictions: [],
      evaluation: null,
      modelVersion: null,
      note: "No works are still running, so there is nothing to forecast.",
    };
  }

  const outcome = await post<DelayResponse>("/delay/predict", {
    feature_names: DELAY_FEATURE_NAMES,
    feature_labels: DELAY_FEATURE_LABELS,
    train: train.map((r) => ({ work_id: r.workId, values: r.values, late: r.late })),
    predict: predict.map((r) => ({ work_id: r.workId, values: r.values })),
  });

  if (!outcome.ok) {
    return {
      predictions: [],
      evaluation: null,
      modelVersion: null,
      note: outcome.reason,
    };
  }

  const { evaluation, results, model_version } = outcome.data;

  return {
    predictions: results.map((r) => ({
      workId: r.work_id,
      probability: r.probability,
      band: r.band,
      drivers: r.drivers,
    })),
    evaluation,
    modelVersion: model_version,
    note:
      evaluation.roc_auc === null
        ? `Trained on ${evaluation.trained_on} settled works; too few to report held-out performance.`
        : `Trained on ${evaluation.trained_on} settled works, tested on ${evaluation.tested_on}: AUC ${evaluation.roc_auc.toFixed(3)}, against a base rate of ${Math.round(evaluation.base_rate * 100)}%.`,
  };
}
