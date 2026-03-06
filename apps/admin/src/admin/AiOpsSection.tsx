import React, { useEffect, useState } from "react";
import { fetchAiOps, type AiOpsSnapshot } from "./api";
import { Card, SimpleTable, StatusPill } from "./AdminUI";

const toneForStatus = (status: string) => {
  if (status === "healthy") return "good";
  if (status === "degraded") return "warning";
  return "bad";
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const AiOpsSection: React.FC = () => {
  const [data, setData] = useState<AiOpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAiOps()
      .then(setData)
      .catch((err: any) => setError(err?.message || "Failed to load AI ops telemetry"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">AI monitoring & metrics</h2>
          <p className="text-sm text-slate-600 max-w-xl">
            Live autonomy telemetry, policy state, and recent engine activity sourced from the Rust admin contract.
          </p>
        </div>
      </header>

      {loading ? (
        <Card><p className="text-sm text-slate-600">Loading AI ops telemetry...</p></Card>
      ) : error ? (
        <Card><p className="text-sm text-rose-700">Error: {error}</p></Card>
      ) : data ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Open AI issues</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{data.health.open_ai_flags}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Breaker events</p>
              <p className="text-2xl font-semibold text-amber-700 mt-1">{data.health.breaker_events_last_day}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tool calls / day</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{data.health.tool_calls_last_day}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Agent runs / day</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{data.health.agent_runs_last_day}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card title="Engine systems" subtitle={`Last materialized ${formatDateTime(data.health.last_materialized_at)}`}>
              <div className="space-y-3">
                {data.systems.map((system) => (
                  <div key={system.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{system.name}</p>
                      <p className="text-xs text-slate-600 mt-1">{system.detail}</p>
                    </div>
                    <StatusPill tone={toneForStatus(system.status)} label={system.status} />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Runtime policy" subtitle={`LLM ${data.policy.llm_mode} · tools ${data.policy.tool_mode}`}>
              <dl className="grid grid-cols-2 gap-y-3 text-sm text-slate-800">
                <div>
                  <dt className="text-xs text-slate-500">Approval threshold</dt>
                  <dd>{data.policy.approval_amount_threshold}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Velocity threshold</dt>
                  <dd>{data.policy.velocity_threshold}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Snapshot stale window</dt>
                  <dd>{data.policy.snapshot_stale_minutes} minutes</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Policy tenants</dt>
                  <dd>{data.health.policy_tenant_count}</dd>
                </div>
              </dl>
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <p>Allowlisted models: {data.policy.allowlists.models.join(", ") || "None"}</p>
                <p>Allowlisted domains: {data.policy.allowlists.domains.join(", ") || "None"}</p>
              </div>
            </Card>
          </div>

          <Card title="Mode distribution" subtitle={`Last engine tick ${formatDateTime(data.health.last_tick_at)}`}>
            {data.modes.length ? (
              <SimpleTable
                headers={["Mode", "Tenant count"]}
                rows={data.modes.map((mode) => [
                  <span key="m" className="text-sm text-slate-800">{mode.mode}</span>,
                  <span key="c" className="text-sm font-semibold text-slate-900">{mode.tenant_count}</span>,
                ])}
              />
            ) : (
              <p className="text-sm text-slate-600">No autonomy policy rows found.</p>
            )}
          </Card>

          <Card title="Recent AI ops activity" subtitle="Most recent autonomy audit events across tenants.">
            {data.recent_activity.length ? (
              <SimpleTable
                headers={["Time", "Tenant", "Actor", "Action", "Target"]}
                rows={data.recent_activity.map((item) => [
                  <span key="t" className="text-xs text-slate-600">{formatDateTime(item.time)}</span>,
                  <span key="tenant" className="text-sm text-slate-800">{item.tenant_id}</span>,
                  <span key="actor" className="text-sm text-slate-800">{item.actor}</span>,
                  <span key="action" className="text-sm font-semibold text-slate-900">{item.action}</span>,
                  <span key="target" className="text-xs text-slate-600">{item.target}</span>,
                ])}
              />
            ) : (
              <p className="text-sm text-slate-600">No recent autonomy audit events recorded.</p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
};
