import React, { useEffect, useState } from "react";
import { fetchRuntimeSettings, type RuntimeSettingsSnapshot } from "./api";
import { Card, StatusPill } from "./AdminUI";

const configuredTone = (configured: boolean) => (configured ? "good" : "warning");

export const RuntimeSettingsSection: React.FC = () => {
  const [data, setData] = useState<RuntimeSettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRuntimeSettings()
      .then(setData)
      .catch((err: any) => setError(err?.message || "Failed to load runtime settings"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Admin settings</h2>
          <p className="text-sm text-slate-600 max-w-xl">
            Runtime environment, auth posture, and autonomy configuration sourced from backend settings state.
          </p>
        </div>
      </header>

      {loading ? (
        <Card><p className="text-sm text-slate-600">Loading runtime settings...</p></Card>
      ) : error ? (
        <Card><p className="text-sm text-rose-700">Error: {error}</p></Card>
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Environment" subtitle={`Service ${data.build.service}  /  ${data.environment.name}`}>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm text-slate-800">
                <div>
                  <dt className="text-xs text-slate-500">Git SHA</dt>
                  <dd className="font-mono text-xs">{data.build.git_sha || "Unavailable"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Rust env</dt>
                  <dd>{data.build.rust_env || "Unavailable"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Password reset base URL</dt>
                  <dd className="break-all text-xs">{data.environment.admin_password_reset_base_url || "Unset"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Google redirect URI</dt>
                  <dd className="break-all text-xs">{data.environment.google_redirect_uri || "Unset"}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill
                  tone={configuredTone(data.environment.jwt_secret_configured)}
                  label={data.environment.jwt_secret_configured ? "JWT configured" : "JWT missing"}
                />
                <StatusPill
                  tone={configuredTone(data.environment.google_oauth_enabled)}
                  label={data.environment.google_oauth_enabled ? "Google OAuth on" : "Google OAuth off"}
                />
              </div>
            </Card>

            <Card title="Autonomy runtime" subtitle={`LLM ${data.autonomy.llm_mode}  /  tools ${data.autonomy.tool_mode}`}>
              <dl className="grid grid-cols-2 gap-y-3 text-sm text-slate-800">
                <div>
                  <dt className="text-xs text-slate-500">Approval threshold</dt>
                  <dd>{data.autonomy.approval_amount_threshold}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Velocity threshold</dt>
                  <dd>{data.autonomy.velocity_threshold}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Snapshot stale window</dt>
                  <dd>{data.autonomy.snapshot_stale_minutes} minutes</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Daily runs budget</dt>
                  <dd>{data.autonomy.budgets.runs_per_day}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Token budget</dt>
                  <dd>{data.autonomy.budgets.tokens_per_day}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Tool-call budget</dt>
                  <dd>{data.autonomy.budgets.tool_calls_per_day}</dd>
                </div>
              </dl>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="CORS origins" subtitle="Origins currently accepted by the Rust admin API.">
              {data.environment.cors_allowed_origins.length ? (
                <ul className="space-y-2 text-sm text-slate-700">
                  {data.environment.cors_allowed_origins.map((origin) => (
                    <li key={origin} className="font-mono text-xs break-all">{origin}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">No explicit CORS origins configured.</p>
              )}
            </Card>

            <Card title="Autonomy allowlists" subtitle="Runtime allowlists used by the admin-side autonomy stack.">
              <div className="space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">Models</p>
                  <p>{data.autonomy.allowlists.models.join(", ") || "No models allowlisted"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">Domains</p>
                  <p>{data.autonomy.allowlists.domains.join(", ") || "No domains allowlisted"}</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};

