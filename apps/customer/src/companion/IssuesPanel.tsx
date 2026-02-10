/**
 * Issues Panel — Companion Control Tower
 *
 * Displays open issues sorted by severity with surface tags
 * and action buttons. Unified zinc design palette.
 */

import React, { useMemo } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { cx, normalizeSurfaceKey, severityChip, surfaceMeta } from "./helpers";
import type { Issue, SurfaceKey } from "./types";

interface IssuesPanelProps {
  issues: Issue[];
  surface?: string | null;
  loading?: boolean;
}

export default function IssuesPanel({ issues, surface, loading = false }: IssuesPanelProps) {
  const surfaceKey = normalizeSurfaceKey(surface);

  const filteredIssues = useMemo(() => {
    if (!surfaceKey) return issues;
    return issues.filter((i) => i.surface === surfaceKey);
  }, [issues, surfaceKey]);

  const bySev = useMemo(() => {
    const rank = (s: Issue["severity"]) => (s === "high" ? 0 : s === "medium" ? 1 : 2);
    return [...filteredIssues].sort((a, b) => rank(a.severity) - rank(b.severity));
  }, [filteredIssues]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        <span className="ml-2 text-sm text-zinc-500">Loading issues...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">About Issues</p>
        <p className="mt-1 text-xs text-zinc-500">
          Issues are checks that may affect accuracy. They don't change your books automatically.
        </p>
      </div>

      {/* Empty state */}
      {!bySev.length ? (
        <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-8 text-center">
          <p className="text-sm font-medium text-zinc-700">No open issues</p>
          <p className="mt-1 text-xs text-zinc-400">Everything looks clear right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bySev.map((issue) => {
            const chip = severityChip(issue.severity);
            const meta = surfaceMeta(issue.surface);
            return (
              <div key={issue.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cx("rounded-md px-2 py-0.5 text-[10px] font-medium", chip.cls)}>
                        {chip.label}
                      </span>
                      <Badge variant="outline" className="rounded-md border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">
                        <meta.icon className="mr-1 h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-zinc-800">{issue.title}</p>
                    {issue.description && (
                      <p className="text-xs text-zinc-500 line-clamp-2">{issue.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-zinc-400">
                    {new Date(issue.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-3">
                  <Button
                    size="sm"
                    className="rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs"
                    onClick={() => (window.location.href = issue.target_url || "#")}
                    disabled={!issue.target_url}
                  >
                    Open review
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
