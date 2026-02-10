/**
 * Engine Queue Panel — Companion Control Tower
 *
 * Slide-in panel showing the autonomy engine queue,
 * batch review controls, agent breakdown, and blockers.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { applyEngineBatch, type EngineQueuesResult, type EngineStatusPayload } from "@/api/companionAutonomyApi";
import { toCustomerCopy } from "./companionCopy";
import { cx, normalizeSurfaceKey, severityChip, surfaceMeta } from "./helpers";

interface EngineQueuePanelProps {
  queues: EngineQueuesResult | null;
  status: EngineStatusPayload | null;
  onRefresh: () => void;
  onOpenSuggestions: (agent: string) => void;
}

export default function EngineQueuePanel({ queues, status, onRefresh, onOpenSuggestions }: EngineQueuePanelProps) {
  const ready = queues?.data?.ready_queue ?? [];
  const attention = queues?.data?.needs_attention_queue ?? [];
  const stats = queues?.data?.stats;
  const jobTotals = queues?.data?.job_totals || null;
  const jobByAgent = queues?.data?.job_by_agent ?? [];
  const topBlockers = queues?.data?.top_blockers ?? [];
  const mode = status?.mode || queues?.data?.mode || "offline";
  const stale = queues?.stale;
  const freshness = stale == null ? "Unknown" : stale ? "Stale" : "Fresh";

  const [selected, setSelected] = useState<number[]>([]);
  const [applying, setApplying] = useState(false);

  const selectableReady = ready.filter((item) => item.action_id != null && item.risk_level === "low");
  const selectableReadyIds = useMemo(
    () => selectableReady.map((item) => item.action_id as number),
    [selectableReady]
  );
  const allSelected = selectableReady.length > 0 && selected.length === selectableReady.length;

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => selectableReadyIds.includes(id)));
  }, [selectableReadyIds]);

  const toggleSelection = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : selectableReadyIds);
  };

  const handleApplyBatch = async () => {
    if (selected.length === 0) return;
    setApplying(true);
    const ok = await applyEngineBatch(selected);
    setApplying(false);
    if (ok) {
      setSelected([]);
      onRefresh();
    }
  };

  return (
    <div className="space-y-5">
      {/* Queue Snapshot */}
      <Section title="Queue Snapshot">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="outline" className="rounded-md text-[10px] border-zinc-200 text-zinc-500">
            {mode.replace("_", " ")}
          </Badge>
          <Badge variant="outline" className={cx(
            "rounded-md text-[10px]",
            freshness === "Stale" ? "border-amber-200 text-amber-600" : freshness === "Fresh" ? "border-emerald-200 text-emerald-600" : "border-zinc-200 text-zinc-500"
          )}>
            {freshness}
          </Badge>
          <Button variant="ghost" size="sm" className="ml-auto text-xs text-zinc-500" onClick={onRefresh}>
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Chip label="Queued" value={`${jobTotals?.queued ?? 0}`} />
          <Chip label="Running" value={`${jobTotals?.running ?? 0}`} />
          <Chip label="Blocked" value={`${jobTotals?.blocked ?? 0}`} />
        </div>
      </Section>

      {/* Batch Review */}
      <Section title="Batch Review">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Chip label="Applied (24h)" value={`${stats?.applied_last_day ?? 0}`} />
          <Chip label="Breakers (24h)" value={`${stats?.breaker_events_last_day ?? 0}`} />
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
          <span>{selected.length} selected</span>
          <button className="text-zinc-700 hover:underline font-medium" onClick={toggleAll} disabled={selectableReady.length === 0}>
            {allSelected ? "Clear all" : "Select all"}
          </button>
        </div>
        <Button
          className="w-full rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs"
          onClick={handleApplyBatch}
          disabled={selected.length === 0 || applying}
        >
          {applying ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Apply {selected.length} low-risk action{selected.length !== 1 ? "s" : ""}
        </Button>
      </Section>

      {/* By Agent */}
      <Section title="By Agent">
        {jobByAgent.length === 0 ? (
          <EmptyChip text="No agent activity yet." />
        ) : (
          <div className="space-y-2">
            {jobByAgent.map((row) => (
              <div key={row.agent} className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-800">{row.agent}</span>
                  <span className="text-[10px] text-zinc-500">Q {row.queued} · R {row.running} · B {row.blocked}</span>
                </div>
                <button className="mt-1 text-[10px] font-medium text-zinc-600 hover:underline" onClick={() => onOpenSuggestions(row.agent)}>
                  Open suggestions →
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Top Blockers */}
      <Section title="Top Blockers">
        {topBlockers.length === 0 ? (
          <EmptyChip text="No blockers reported." />
        ) : (
          <div className="space-y-2">
            {topBlockers.map((blocker, index) => (
              <div key={`${blocker.kind}-${index}`} className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-800">{blocker.kind}</span>
                  <Badge variant="outline" className="rounded-md text-[9px] border-zinc-200 text-zinc-500">{blocker.status}</Badge>
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">{toCustomerCopy(blocker.reason)}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Ready to Apply */}
      <Section title="Ready to Apply">
        {ready.length === 0 ? (
          <EmptyChip text="No ready items right now." />
        ) : (
          <div className="space-y-2">
            {ready.map((item) => {
              const chip = severityChip(item.risk_level as "low" | "medium" | "high");
              const actionId = item.action_id ?? null;
              return (
                <div key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-800">{toCustomerCopy(item.title)}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-500 line-clamp-2">{toCustomerCopy(item.summary)}</p>
                    </div>
                    <span className={cx("shrink-0 rounded-md px-2 py-0.5 text-[9px] font-medium", chip.cls)}>{chip.label}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-zinc-300"
                        checked={actionId ? selected.includes(actionId) : false}
                        onChange={() => actionId && toggleSelection(actionId)}
                        disabled={!actionId || item.risk_level !== "low"}
                      />
                      {item.risk_level === "low" ? "Batch" : "Manual"}
                    </label>
                    <span className="text-[10px] text-zinc-400">{surfaceMeta(normalizeSurfaceKey(item.surface) || "banking").label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Needs Attention */}
      <Section title="Needs Attention">
        {attention.length === 0 ? (
          <EmptyChip text="No high-risk items." />
        ) : (
          <div className="space-y-2">
            {attention.map((item) => {
              const chip = severityChip(item.risk_level as "low" | "medium" | "high");
              return (
                <div key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-800">{toCustomerCopy(item.title)}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-500 line-clamp-2">{toCustomerCopy(item.summary)}</p>
                    </div>
                    <span className={cx("shrink-0 rounded-md px-2 py-0.5 text-[9px] font-medium", chip.cls)}>{chip.label}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">{surfaceMeta(normalizeSurfaceKey(item.surface) || "banking").label}</span>
                    {item.target_url && (
                      <a href={item.target_url} className="text-[10px] font-medium text-zinc-700 hover:underline">Open</a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Shared sub-components ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2.5 py-2">
      <p className="text-[10px] text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-700">{value}</p>
    </div>
  );
}

function EmptyChip({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-3 text-xs text-zinc-400 text-center">
      {text}
    </div>
  );
}
