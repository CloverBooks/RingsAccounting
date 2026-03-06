import React, { useEffect, useMemo, useState } from "react";
import { fetchFeatureFlags, updateFeatureFlag, type FeatureFlag } from "./api";
import { AdminReasonDialog } from "./AdminReasonDialog";
import { Card, SimpleTable, StatusPill } from "./AdminUI";

type Role = "support" | "finance" | "engineer" | "superadmin";

const isFeatureFlag = (value: unknown): value is FeatureFlag =>
  Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "key" in value &&
      "is_enabled" in value &&
      "rollout_percent" in value,
  );

type PendingFlagChange = {
  flag: FeatureFlag;
  previous: FeatureFlag;
  payload: Partial<Pick<FeatureFlag, "is_enabled" | "rollout_percent">>;
};

export const FeatureFlagsSection: React.FC<{ role?: Role }> = ({ role = "superadmin" }) => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingFlagChange | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [reasonLoading, setReasonLoading] = useState(false);
  const canEdit = role === "engineer" || role === "superadmin";

  const applyLocalFlagState = (flagId: number, payload: PendingFlagChange["payload"]) => {
    setFlags((list) =>
      list.map((item) => (item.id === flagId ? { ...item, ...payload } : item))
    );
  };

  const revertLocalFlagState = (previous: FeatureFlag) => {
    setFlags((list) => list.map((item) => (item.id === previous.id ? previous : item)));
  };

  const resetReasonDialog = () => {
    setPendingChange(null);
    setReason("");
    setReasonError(null);
  };

  const closeReasonDialog = () => {
    if (reasonLoading) return;
    resetReasonDialog();
  };

  const loadFlags = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await fetchFeatureFlags();
      setFlags(data);
    } catch (err: any) {
      setError(err?.message || "Unable to load feature flags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const applyFlagChange = async (
    change: PendingFlagChange,
    extraPayload?: Record<string, unknown>,
  ) => {
    const payload = { ...change.payload, ...extraPayload };
    try {
      const res = await updateFeatureFlag(change.flag.id, payload);
      if ("approval_required" in res && res.approval_required) {
        revertLocalFlagState(change.previous);
        setMessage(`Change queued for approval: ${res.approval_request_id}`);
        return;
      }
      if (isFeatureFlag(res)) {
        setFlags((list) => list.map((item) => (item.id === change.flag.id ? res : item)));
      }
    } catch (err: any) {
      const msg = err?.message || "Unable to update flag";
      if (String(msg).toLowerCase().includes("reason is required") && !extraPayload?.reason) {
        revertLocalFlagState(change.previous);
        setPendingChange(change);
        setReason("");
        setReasonError(null);
        return;
      }
      revertLocalFlagState(change.previous);
      throw err;
    }
  };

  const handleToggle = async (flag: FeatureFlag, enabled: boolean) => {
    if (!canEdit) return;
    setError(null);
    setMessage(null);
    const change: PendingFlagChange = {
      flag,
      previous: flag,
      payload: { is_enabled: enabled },
    };
    applyLocalFlagState(flag.id, change.payload);
    try {
      await applyFlagChange(change);
    } catch (err: any) {
      setError(err?.message || "Unable to update flag");
    }
  };

  const handleRolloutChange = async (flag: FeatureFlag, value: number) => {
    if (!canEdit) return;
    setError(null);
    setMessage(null);
    const nextValue = Math.min(100, Math.max(0, value));
    const change: PendingFlagChange = {
      flag,
      previous: flag,
      payload: { rollout_percent: nextValue },
    };
    applyLocalFlagState(flag.id, change.payload);
    try {
      await applyFlagChange(change);
    } catch (err: any) {
      setError(err?.message || "Unable to update flag");
    }
  };

  const handleReasonConfirm = async () => {
    if (!pendingChange) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setReasonError("Reason is required.");
      return;
    }
    setReasonLoading(true);
    setReasonError(null);
    setError(null);
    setMessage(null);
    applyLocalFlagState(pendingChange.flag.id, pendingChange.payload);
    try {
      await applyFlagChange(pendingChange, { reason: trimmedReason });
      resetReasonDialog();
    } catch (err: any) {
      setReasonError(err?.message || "Unable to update flag");
    } finally {
      setReasonLoading(false);
    }
  };

  const rows = useMemo(
    () =>
      flags.map((f) => [
        <span key={`key-${f.id}`} className="text-xs font-semibold text-slate-900">
          {f.key}
        </span>,
        <span key={`label-${f.id}`} className="text-xs text-slate-800">
          {f.label}
        </span>,
        <span key={`description-${f.id}`} className="text-xs text-slate-600">
          {f.description}
        </span>,
        <div key={`enabled-${f.id}`} className="flex items-center gap-2">
          <StatusPill tone={f.is_enabled ? "good" : "neutral"} label={f.is_enabled ? "On" : "Off"} />
          <input
            type="checkbox"
            checked={f.is_enabled}
            disabled={!canEdit}
            onChange={(e) => handleToggle(f, e.target.checked)}
          />
        </div>,
        <input
          key={`rollout-${f.id}`}
          type="number"
          min={0}
          max={100}
          value={f.rollout_percent}
          disabled={!canEdit}
          onChange={(e) => handleRolloutChange(f, Number(e.target.value))}
          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-50 disabled:opacity-50"
        />,
      ]),
    [flags, canEdit]
  );

  return (
    <Card title="Feature flags" subtitle="Toggle rollouts and guardrails for experiments.">
      {loading ? (
        <p className="text-sm text-slate-600">Loading flags…</p>
      ) : error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : (
        <>
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          <SimpleTable
            headers={["Key", "Label", "Description", "Enabled", "Rollout %"]}
            rows={rows}
          />
        </>
      )}
      {!canEdit && (
        <p className="mt-3 text-xs text-slate-500">
          View-only: engineering or superadmin required to edit feature flags.
        </p>
      )}
      <AdminReasonDialog
        open={Boolean(pendingChange)}
        title="Reason required"
        description="Critical feature flag changes require a documented reason before the update is queued or applied."
        confirmLabel="Apply change"
        loadingLabel="Applying..."
        reason={reason}
        error={reasonError}
        loading={reasonLoading}
        onReasonChange={setReason}
        onConfirm={handleReasonConfirm}
        onOpenChange={(open) => {
          if (!open) {
            closeReasonDialog();
          }
        }}
      />
    </Card>
  );
};
