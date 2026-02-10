/**
 * Suggestions Panel — Companion Control Tower
 *
 * AI suggestions list with apply/dismiss/review actions,
 * batch apply controls, search, and tab filtering.
 *
 * Unified zinc design palette.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import { ensureCsrfToken } from "../utils/csrf";
import { toCustomerCopy } from "./companionCopy";
import { cx, normalizeSurfaceKey, surfaceMeta } from "./helpers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { buildApiUrl, getAccessToken, fetchWithTimeout } from "@/api/client";

import type { Proposal, SurfaceKey } from "./types";

interface SuggestionsPanelProps {
  proposals: Proposal[];
  onApplied: (id: string) => void;
  onDismissed: (id: string) => void;
  surface?: string | null;
  agentFilter?: string | null;
  initialQuery?: string | null;
  loading?: boolean;
  engineMode?: string | null;
  workspaceId?: number;
}

function actionKindForProposal(p: Proposal): "apply" | "review" | "info" {
  if (p.customer_action_kind === "apply" || p.customer_action_kind === "review" || p.customer_action_kind === "info") {
    return p.customer_action_kind;
  }
  return p.risk === "ready" ? "apply" : "review";
}

function riskLevelForProposal(p: Proposal): "low" | "medium" | "high" {
  if (p.risk_level === "low" || p.risk_level === "medium" || p.risk_level === "high") return p.risk_level;
  if (p.risk === "needs_attention") return "high";
  if (p.risk === "review") return "medium";
  return "low";
}

function formatMoney(x: number | undefined | null) {
  if (x == null || Number.isNaN(x)) return "$0";
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `$${(x / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(x / 1_000).toFixed(1)}K`;
  return `$${x.toFixed(0)}`;
}

function riskChip(risk: Proposal["risk"]) {
  if (risk === "needs_attention") return { label: "Needs attention", cls: "bg-rose-50 text-rose-700 border border-rose-200" };
  if (risk === "review") return { label: "Review", cls: "bg-amber-50 text-amber-700 border border-amber-200" };
  return { label: "Ready", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
}

export default function SuggestionsPanel({
  proposals,
  onApplied,
  onDismissed,
  surface,
  agentFilter,
  initialQuery,
  loading = false,
  engineMode,
  workspaceId,
}: SuggestionsPanelProps) {
  const [tab, setTab] = useState<"all" | "ready" | "review" | "needs_attention">("all");
  const [q, setQ] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const surfaceKey = normalizeSurfaceKey(surface);

  useEffect(() => {
    setQ(initialQuery?.trim() || "");
  }, [initialQuery]);

  const filtered = useMemo(() => {
    let items = proposals;
    if (surfaceKey) items = items.filter((p) => p.surface === surfaceKey);
    if (agentFilter) {
      const needle = agentFilter.toLowerCase();
      items = items.filter((p) => (p.source_agent || "").toLowerCase() === needle);
    }
    if (tab !== "all") items = items.filter((p) => p.risk === tab);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      items = items.filter((p) => (p.title + " " + p.description).toLowerCase().includes(s));
    }
    return items;
  }, [proposals, tab, q, surfaceKey, agentFilter]);

  const readyItems = useMemo(
    () => filtered.filter((p) => actionKindForProposal(p) === "apply" && riskLevelForProposal(p) === "low"),
    [filtered]
  );
  const batchAllowed = engineMode === "autopilot_limited" || engineMode === "drafts";
  const canBatchApply = batchAllowed && readyItems.length > 0;

  const applyBatch = async () => {
    if (!canBatchApply || !workspaceId) {
      setFeedback({ type: "error", message: "Workspace context missing. Reload and try again." });
      return;
    }
    setBatchBusy(true);
    setFeedback(null);
    try {
      const csrf = await ensureCsrfToken();
      const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
      if (csrf) headers["X-CSRFToken"] = csrf;
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      let applied = 0;
      let failed = 0;
      for (const proposal of readyItems) {
        const res = await fetchWithTimeout(buildApiUrl(`/api/companion/v2/shadow-events/${proposal.id}/apply/`), {
          method: "POST",
          credentials: "same-origin",
          headers,
          body: JSON.stringify({ workspace_id: workspaceId }),
        });
        if (res.ok) { onApplied(proposal.id); applied++; } else { failed++; }
      }
      if (failed > 0) {
        setFeedback({ type: "error", message: `Applied ${applied} of ${readyItems.length}. ${failed} failed.` });
      } else if (applied > 0) {
        setFeedback({ type: "success", message: `Applied ${applied} safe item${applied === 1 ? "" : "s"}.` });
      }
      setBatchOpen(false);
    } catch {
      setFeedback({ type: "error", message: "Failed to apply. Please try again." });
    } finally {
      setBatchBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        <span className="ml-2 text-sm text-zinc-500">Loading suggestions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">What you're reviewing</p>
        <p className="mt-1 text-xs text-zinc-500">
          Safe suggestions — applying updates your books only after confirmation.
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cx(
            "rounded-xl border px-4 py-3 text-sm",
            feedback.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
          role="status"
          aria-live="polite"
        >
          {feedback.message}
        </div>
      )}

      {/* Batch apply */}
      {canBatchApply && (
        <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-zinc-700">Apply safe items</p>
              <p className="text-[10px] text-zinc-500">{readyItems.length} ready to apply</p>
            </div>
            <Button size="sm" className="rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs" onClick={() => setBatchOpen(true)}>
              Apply safe items
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search suggestions..."
          className="h-10 rounded-lg border-zinc-200 pl-10 text-sm"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-4 rounded-lg bg-zinc-100 p-0.5">
          <TabsTrigger value="all" className="rounded-md text-xs">All</TabsTrigger>
          <TabsTrigger value="ready" className="rounded-md text-xs">Ready</TabsTrigger>
          <TabsTrigger value="review" className="rounded-md text-xs">Review</TabsTrigger>
          <TabsTrigger value="needs_attention" className="rounded-md text-xs">Attention</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-3 space-y-2">
          {!filtered.length ? (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-8 text-center">
              <p className="text-sm font-medium text-zinc-700">No suggestions</p>
              <p className="mt-1 text-xs text-zinc-400">Nothing matches the current filter.</p>
            </div>
          ) : (
            filtered.map((p) => (
              <SuggestionCard
                key={p.id}
                proposal={p}
                onApplied={onApplied}
                onDismissed={onDismissed}
                onFeedback={(type, message) => setFeedback({ type, message })}
                workspaceId={workspaceId}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Batch dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Apply {readyItems.length} safe items?</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Low-risk items with a clear audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">What will change</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">
              <li>Apply low-risk suggestions that are ready.</li>
              <li>Link each change to its source for traceability.</li>
              <li>Keep your books consistent.</li>
            </ul>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setBatchOpen(false)}>Cancel</Button>
            <Button size="sm" className="rounded-lg bg-zinc-900 text-white hover:bg-zinc-800" onClick={applyBatch} disabled={batchBusy}>
              {batchBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion Card
// ─────────────────────────────────────────────────────────────────────────────
function SuggestionCard({
  proposal,
  onApplied,
  onDismissed,
  onFeedback,
  workspaceId,
}: {
  proposal: Proposal;
  onApplied: (id: string) => void;
  onDismissed: (id: string) => void;
  onFeedback?: (type: "success" | "error", message: string) => void;
  workspaceId?: number;
}) {
  const meta = surfaceMeta(proposal.surface);
  const chip = riskChip(proposal.risk);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [busy, setBusy] = useState<null | "apply" | "dismiss">(null);
  const [note, setNote] = useState("");
  const [applyNote, setApplyNote] = useState("");

  const actionKind = actionKindForProposal(proposal);
  const riskLevel = riskLevelForProposal(proposal);
  const requiresNote = actionKind === "apply" && riskLevel === "high";
  const isApplyAllowed = actionKind === "apply";

  const previewEffects = proposal.preview_effects?.length
    ? proposal.preview_effects
    : ["Make a change based on this suggestion.", "Link it to the source for traceability.", "Keep reports consistent."];

  const safeTitle = toCustomerCopy(proposal.title);
  const safeDescription = toCustomerCopy(proposal.description);
  const safeEffects = previewEffects.map(toCustomerCopy);

  const apply = async () => {
    if (requiresNote && !applyNote.trim()) return;
    if (!workspaceId) { onFeedback?.("error", "Workspace missing. Reload."); return; }
    setBusy("apply");
    try {
      const csrf = await ensureCsrfToken();
      const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
      if (csrf) headers["X-CSRFToken"] = csrf;
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetchWithTimeout(buildApiUrl(`/api/companion/v2/shadow-events/${proposal.id}/apply/`), {
        method: "POST", credentials: "same-origin", headers,
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      onApplied(proposal.id);
      setConfirmOpen(false);
      setApplyNote("");
      onFeedback?.("success", "Suggestion applied.");
    } catch (err: any) {
      onFeedback?.("error", err?.message || "Failed to apply.");
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async () => {
    if (!workspaceId) { onFeedback?.("error", "Workspace missing. Reload."); return; }
    setBusy("dismiss");
    try {
      const csrf = await ensureCsrfToken();
      const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
      if (csrf) headers["X-CSRFToken"] = csrf;
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetchWithTimeout(buildApiUrl(`/api/companion/v2/shadow-events/${proposal.id}/reject/`), {
        method: "POST", credentials: "same-origin", headers,
        body: JSON.stringify({ workspace_id: workspaceId, reason: note || "Dismissed" }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      onDismissed(proposal.id);
      setDismissOpen(false);
      setNote("");
      onFeedback?.("success", "Suggestion dismissed.");
    } catch (err: any) {
      onFeedback?.("error", err?.message || "Failed to dismiss.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cx("rounded-md px-2 py-0.5 text-[10px] font-medium", chip.cls)}>{chip.label}</span>
            <Badge variant="outline" className="rounded-md border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">
              <meta.icon className="mr-1 h-3 w-3" />
              {meta.label}
            </Badge>
            {proposal.amount != null && (
              <Badge variant="outline" className="rounded-md border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">
                {formatMoney(proposal.amount)}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-zinc-800">{safeTitle}</p>
          <p className="text-xs text-zinc-500 line-clamp-2">{safeDescription}</p>
        </div>
        <span className="shrink-0 text-[10px] text-zinc-400">
          {new Date(proposal.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isApplyAllowed && (
          <Button size="sm" className="rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs" onClick={() => setConfirmOpen(true)} disabled={busy === "apply"}>
            {busy === "apply" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
            Apply
          </Button>
        )}
        <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setDismissOpen(true)} disabled={busy === "dismiss"}>
          Dismiss
        </Button>
        {proposal.target_url && (
          <Button variant="ghost" size="sm" className="rounded-lg text-xs text-zinc-600" onClick={() => window.location.href = proposal.target_url!}>
            {actionKind === "review" ? "Open review" : "Details"}
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Apply dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Apply this change?</DialogTitle>
            <DialogDescription className="text-zinc-500">Safe apply with audit trail.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">What this will do</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">
              {safeEffects.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
          {requiresNote && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-800">High-risk — add a note</p>
              <Textarea value={applyNote} onChange={(e) => setApplyNote(e.target.value)} placeholder="Why is this correct?" className="mt-2 min-h-[80px] rounded-lg border-amber-200 bg-white" />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button size="sm" className="rounded-lg bg-zinc-900 text-white hover:bg-zinc-800" onClick={apply} disabled={busy === "apply" || (requiresNote && !applyNote.trim())}>
              {busy === "apply" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss dialog */}
      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Dismiss this suggestion</DialogTitle>
            <DialogDescription className="text-zinc-500">Optional note helps us learn.</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why doesn't this apply?" className="min-h-[100px] rounded-lg border-zinc-200" />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={dismiss} disabled={busy === "dismiss"}>
              {busy === "dismiss" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
