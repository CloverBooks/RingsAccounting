/**
 * Close Assistant Drawer — Companion Control Tower
 *
 * Shows close readiness status, progress, and blockers.
 * Unified zinc design palette.
 */

import React from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { cx, severityChip, surfaceMeta } from "./helpers";
import type { SurfaceKey } from "./types";

type CloseReadiness = {
  status: "ready" | "not_ready";
  period_label: string;
  progress_percent: number;
  blockers: Array<{
    id: string;
    title: string;
    surface?: SurfaceKey;
    url?: string;
    severity: "medium" | "high";
  }>;
};

type SummaryLike = {
  close_readiness: CloseReadiness;
};

interface CloseAssistantDrawerProps {
  summary: SummaryLike | null;
  loading?: boolean;
}

export default function CloseAssistantDrawer({ summary, loading = false }: CloseAssistantDrawerProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        <span className="ml-2 text-sm text-zinc-500">Loading close assistant...</span>
      </div>
    );
  }

  if (!summary?.close_readiness) {
    return (
      <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-8 text-center">
        <p className="text-sm font-medium text-zinc-700">Close assistant unavailable</p>
        <p className="mt-1 text-xs text-zinc-400">We couldn't load the close readiness data.</p>
      </div>
    );
  }

  const cr = summary.close_readiness;
  const isReady = cr.status === "ready";

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Goal</p>
        <p className="mt-1 text-xs text-zinc-500">
          Get to "Ready" by resolving blockers and reviewing suggested changes.
        </p>
      </div>

      {/* Status Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{cr.period_label}</h3>
            <p className="text-xs text-zinc-500">
              {isReady ? "You're ready to close." : "You're almost there."}
            </p>
          </div>
          <Badge className={cx("rounded-lg text-xs", isReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
            {isReady ? "Ready" : "Not Ready"}
          </Badge>
        </div>

        {/* Progress */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Progress</span>
            <span className="font-medium text-zinc-700">{cr.progress_percent}%</span>
          </div>
          <Progress value={cr.progress_percent} className="h-2" />
        </div>

        {/* Blockers */}
        {cr.blockers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-700">Blockers ({cr.blockers.length})</p>
            {cr.blockers.map((b) => {
              const chip = severityChip(b.severity);
              return (
                <div key={b.id} className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-800">{b.title}</p>
                      {b.surface && (
                        <p className="mt-0.5 text-[10px] text-zinc-400">{surfaceMeta(b.surface).label}</p>
                      )}
                    </div>
                    <span className={cx("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium", chip.cls)}>
                      {chip.label}
                    </span>
                  </div>
                  {b.url && (
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs"
                        onClick={() => (window.location.href = b.url || "#")}
                      >
                        Open review
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            className="flex-1 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs"
            onClick={() => (window.location.href = "/books-review")}
          >
            Open books review
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-xs"
            onClick={() => (window.location.href = "/companion/issues")}
          >
            View issues
          </Button>
        </div>
      </div>
    </div>
  );
}
