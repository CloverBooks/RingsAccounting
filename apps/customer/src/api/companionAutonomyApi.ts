import { buildApiUrl, getAccessToken, fetchWithTimeout } from "@/api/client";
import { ensureCsrfToken } from "@/utils/csrf";

export type EngineQueueItem = {
  id: number;
  work_type: string;
  surface: string;
  status: string;
  risk_level: "low" | "medium" | "high" | string;
  title: string;
  summary: string;
  action_id?: number | null;
  target_url?: string | null;
  due_at?: string | null;
};

export type EngineQueuesPayload = {
  generated_at: string;
  mode: string;
  trust_score: number;
  stats: {
    ready: number;
    needs_attention: number;
    waiting_approval: number;
    applied_last_day: number;
    dismissed_last_day: number;
    breaker_events_last_day: number;
  };
  ready_queue: EngineQueueItem[];
  needs_attention_queue: EngineQueueItem[];
  job_totals?: {
    queued: number;
    running: number;
    blocked: number;
    failed: number;
    succeeded: number;
    canceled: number;
  } | null;
  job_by_agent?: Array<{ agent: string; queued: number; running: number; blocked: number }> | null;
  top_blockers?: Array<{ kind: string; status: string; reason: string; updated_at: string }> | null;
};

export type EngineQueuesResult = {
  source: "snapshot" | "live";
  stale: boolean;
  data: EngineQueuesPayload;
};

export type EngineStatusPayload = {
  ok: boolean;
  tenant_id: number;
  mode: string;
  breakers: {
    recent: number;
    ok: boolean;
  };
  budgets: { tokens_per_day: number; tool_calls_per_day: number; runs_per_day: number };
  last_tick_at?: string | null;
  last_materialized_at?: string | null;
  engine_version: string;
  mock_mode: { llm: string; tools: string };
};

export type ReceiptRunUploadOptions = {
  defaultCurrency?: string;
  defaultCategory?: string;
  defaultVendor?: string;
  defaultDate?: string;
};

export type ReceiptRunUploadResult =
  | { ok: true; runId: number | null }
  | { ok: false; error: string };

export type TriggerReviewResult =
  | { ok: true; runId: number | null }
  | { ok: false; error: string };

const buildHeaders = async (method: "GET" | "POST") => {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    const csrf = await ensureCsrfToken();
    if (csrf) headers["X-CSRFToken"] = csrf;
  }
  return headers;
};

export async function uploadReceiptRun(
  files: File[],
  options: ReceiptRunUploadOptions = {},
): Promise<ReceiptRunUploadResult> {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, error: "Please select at least one receipt." };
  }
  try {
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const csrf = await ensureCsrfToken();
    if (csrf) {
      headers["X-CSRFToken"] = csrf;
    }

    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    if (options.defaultCurrency) form.append("default_currency", options.defaultCurrency);
    if (options.defaultCategory) form.append("default_category", options.defaultCategory);
    if (options.defaultVendor) form.append("default_vendor", options.defaultVendor);
    if (options.defaultDate) form.append("default_date", options.defaultDate);

    const res = await fetchWithTimeout(buildApiUrl("/api/agentic/receipts/run"), {
      method: "POST",
      credentials: "include",
      headers,
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail =
        typeof data?.error === "string"
          ? data.error
          : `Receipt upload failed (${res.status})`;
      return { ok: false, error: detail };
    }

    const parsedRunId = Number(data?.run_id);
    return {
      ok: true,
      runId: Number.isFinite(parsedRunId) ? parsedRunId : null,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Receipt upload failed." };
  }
}

async function buildMultipartHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const csrf = await ensureCsrfToken();
  if (csrf) {
    headers["X-CSRFToken"] = csrf;
  }
  return headers;
}

export async function triggerBooksReviewRun(
  period?: { periodStart?: string; periodEnd?: string },
): Promise<TriggerReviewResult> {
  try {
    const form = new FormData();
    if (period?.periodStart) form.append("period_start", period.periodStart);
    if (period?.periodEnd) form.append("period_end", period.periodEnd);

    const res = await fetchWithTimeout(buildApiUrl("/api/agentic/books-review/run"), {
      method: "POST",
      credentials: "include",
      headers: await buildMultipartHeaders(),
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : `Books review failed (${res.status})`,
      };
    }
    const runId = Number(data?.run_id);
    return { ok: true, runId: Number.isFinite(runId) ? runId : null };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Books review failed." };
  }
}

export async function triggerBankAuditRun(
  payload?: { periodStart?: string; periodEnd?: string; linesJson?: string },
): Promise<TriggerReviewResult> {
  try {
    const form = new FormData();
    if (payload?.periodStart) form.append("period_start", payload.periodStart);
    if (payload?.periodEnd) form.append("period_end", payload.periodEnd);
    form.append("lines", payload?.linesJson || "[]");

    const res = await fetchWithTimeout(buildApiUrl("/api/agentic/bank-review/run"), {
      method: "POST",
      credentials: "include",
      headers: await buildMultipartHeaders(),
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : `Bank audit failed (${res.status})`,
      };
    }
    const runId = Number(data?.run_id);
    return { ok: true, runId: Number.isFinite(runId) ? runId : null };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Bank audit failed." };
  }
}

export async function fetchCockpitQueues(): Promise<EngineQueuesResult | null> {
  try {
    const res = await fetchWithTimeout(buildApiUrl("/api/companion/cockpit/queues"), {
      credentials: "include",
      headers: await buildHeaders("GET"),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const payload = data?.data || data;
    if (!payload) return null;
    return {
      source: data?.source || "live",
      stale: Boolean(data?.stale),
      data: payload as EngineQueuesPayload,
    };
  } catch {
    return null;
  }
}

export async function fetchCockpitStatus(): Promise<EngineStatusPayload | null> {
  try {
    const res = await fetchWithTimeout(buildApiUrl("/api/companion/cockpit/status"), {
      credentials: "include",
      headers: await buildHeaders("GET"),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as EngineStatusPayload;
  } catch {
    return null;
  }
}

export async function tickEngine(tenantId?: number | "all"): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(buildApiUrl("/api/companion/autonomy/tick"), {
      method: "POST",
      credentials: "include",
      headers: await buildHeaders("POST"),
      body: JSON.stringify({ tenant: tenantId === "all" ? "all" : undefined, tenant_id: tenantId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function materializeEngine(tenantId?: number | "all"): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(buildApiUrl("/api/companion/autonomy/materialize"), {
      method: "POST",
      credentials: "include",
      headers: await buildHeaders("POST"),
      body: JSON.stringify({ tenant: tenantId === "all" ? "all" : undefined, tenant_id: tenantId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function applyEngineBatch(actionIds: number[]): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(buildApiUrl("/api/companion/autonomy/actions/batch-apply"), {
      method: "POST",
      credentials: "include",
      headers: await buildHeaders("POST"),
      body: JSON.stringify({ action_ids: actionIds }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
