import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  ChevronRight,
  Clock,
  Gauge,
  Loader2,
  Lock,
  MessageSquareText,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip as ReTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

import CloseAssistantDrawer from "./CloseAssistantDrawer";
import IssuesPanel from "./IssuesPanel";
import PanelShell from "./PanelShell";
import SuggestionsPanel from "./SuggestionsPanel";
import EngineQueuePanel from "./EngineQueuePanel";

import { useCompanionData } from "./useCompanionData";
import { usePanelRouting } from "./usePanelRouting";
import { usePermissions } from "@/hooks/usePermissions";
import { cx, focusTone, formatMoney, severityChip, surfaceMeta } from "./helpers";
import type { Summary, SurfaceKey, PlaybookItem, FinanceSnapshot, TaxGuardian } from "./types";
import {
  triggerBankAuditRun,
  triggerBooksReviewRun,
  uploadReceiptRun,
  type EngineQueuesResult,
  type EngineStatusPayload,
} from "@/api/companionAutonomyApi";

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function CompanionControlTowerPage() {
  const { workspace } = usePermissions();
  const { panel, surfaceFilter, surfaceLabel, agentFilter, open, close } = usePanelRouting();
  const data = useCompanionData();
  const {
    summary, proposals, issues, engineQueues, engineStatus,
    loading, refreshing, error, refresh, setProposals,
  } = data;

  const [booksRunInFlight, setBooksRunInFlight] = useState(false);
  const [bankRunInFlight, setBankRunInFlight] = useState(false);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const radarData = useMemo(() => {
    if (!summary) return [];
    return summary.radar.map((r) => ({ axis: r.label, score: r.score }));
  }, [summary]);

  const focus = summary ? focusTone(summary.voice.focus_mode) : focusTone("watchlist");

  const openCounts = useMemo(() => {
    if (!summary) return { totalIssues: 0, totalSuggestions: 0 };
    const totalIssues = summary.radar.reduce((acc, r) => acc + (r.open_issues || 0), 0);
    return { totalIssues, totalSuggestions: proposals.length };
  }, [summary, proposals]);

  const periodRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  }, []);

  const runBooksReview = async () => {
    setBooksRunInFlight(true);
    setAuditError(null);
    setAuditMessage(null);
    const result = await triggerBooksReviewRun({
      periodStart: periodRange.start,
      periodEnd: periodRange.end,
    });
    if (!result.ok) {
      setAuditError(result.error);
      setBooksRunInFlight(false);
      return;
    }
    setAuditMessage(result.runId ? `Books review run #${result.runId} started.` : "Books review started.");
    setBooksRunInFlight(false);
    await refresh();
  };

  const runBankAudit = async () => {
    setBankRunInFlight(true);
    setAuditError(null);
    setAuditMessage(null);
    const result = await triggerBankAuditRun({
      periodStart: periodRange.start,
      periodEnd: periodRange.end,
      linesJson: "[]",
    });
    if (!result.ok) {
      setAuditError(result.error);
      setBankRunInFlight(false);
      return;
    }
    setAuditMessage(result.runId ? `Bank audit run #${result.runId} started.` : "Bank audit started.");
    setBankRunInFlight(false);
    await refresh();
  };

  // ─── Error State ───────────────────────────────────────────────────────────
  if (!loading && error && !summary) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Companion couldn't load</h2>
            <p className="mt-2 text-sm text-zinc-500">{error}</p>
          </div>
          <Button onClick={refresh} className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <p className="text-xs text-zinc-400">
            Make sure the backend is running and you're logged in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#e2e8f0_0%,_#f8fafc_46%,_#ffffff_100%)]">
      {/* ─── Disabled Banner ─────────────────────────────────────────────── */}
      {summary && !summary.ai_companion_enabled && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 shadow-sm">
            <Bot className="h-5 w-5 text-amber-600 shrink-0" />
            <span>AI Companion is currently disabled. Enable it in settings to see suggestions and insights.</span>
          </div>
        </div>
      )}

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-16 pt-6">
        {loading ? (
          <SkeletonBoard />
        ) : summary ? (
          <div className="space-y-6">
            <CompanionWorkspaceHeader
              summary={summary}
              refreshing={refreshing}
              onRefresh={refresh}
              onOpenIssues={() => open("issues")}
              onOpenClose={() => open("close")}
            />

            {/* Hero */}
            <HeroSection summary={summary} focus={focus} />

            <BooksBankAuditCard
              summary={summary}
              proposals={proposals}
              issues={issues}
              booksRunInFlight={booksRunInFlight}
              bankRunInFlight={bankRunInFlight}
              auditMessage={auditMessage}
              auditError={auditError}
              onRunBooks={runBooksReview}
              onRunAudit={runBankAudit}
              onOpenSuggestions={(s) => open("suggestions", s)}
              onOpenIssues={(s) => open("issues", s)}
            />

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Health Score"
                value={`${Math.round(summary.radar.reduce((a, r) => a + r.score, 0) / summary.radar.length)}`}
                suffix="/100"
                icon={Gauge}
                color="blue"
              />
              <StatCard
                label="Open Issues"
                value={`${openCounts.totalIssues}`}
                icon={AlertTriangle}
                color={openCounts.totalIssues > 0 ? "amber" : "emerald"}
                onClick={() => open("issues")}
              />
              <StatCard
                label="AI Suggestions"
                value={`${openCounts.totalSuggestions}`}
                icon={Sparkles}
                color="violet"
                onClick={() => open("suggestions")}
              />
              <StatCard
                label="Close Status"
                value={summary.close_readiness.status === "ready" ? "Ready" : "Not Ready"}
                icon={Lock}
                color={summary.close_readiness.status === "ready" ? "emerald" : "amber"}
                onClick={() => open("close")}
              />
            </div>

            {/* Two-Column Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left (2/3) */}
              <div className="space-y-6 lg:col-span-2">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <HealthPulseCard summary={summary} radarData={radarData} onOpenIssues={() => open("issues")} />
                  <CloseReadinessCard summary={summary} onOpenClose={() => open("close")} />
                </div>
                <TodayFocusCard items={summary.playbook} onOpenSuggestions={() => open("suggestions")} />
                <SurfacesGrid
                  summary={summary}
                  proposals={proposals}
                  issues={issues}
                  onOpenSuggestions={(s) => open("suggestions", s)}
                  onOpenIssues={(s) => open("issues", s)}
                />
              </div>

              {/* Right (1/3) */}
              <div className="space-y-6">
                <FinanceSnapshotCard finance={summary.finance_snapshot} />
                <ReceiptsIngestionCard />
                <TaxGuardianCard tax={summary.tax_guardian} />
                <EngineQueueCard queues={engineQueues} status={engineStatus} onOpenQueue={() => open("engine")} />
              </div>
            </div>
          </div>
        ) : (
          <SkeletonBoard />
        )}
      </div>

      {/* ─── Panels ──────────────────────────────────────────────────────── */}
      <PanelShell panel={panel} onClose={close} surface={surfaceLabel}>
        {panel === "suggestions" && (
          <SuggestionsPanel
            proposals={proposals}
            surface={surfaceFilter}
            agentFilter={agentFilter}
            onApplied={(id) => setProposals((prev) => prev.filter((p) => p.id !== id))}
            onDismissed={(id) => setProposals((prev) => prev.filter((p) => p.id !== id))}
            loading={loading}
            engineMode={engineStatus?.mode}
            workspaceId={workspace?.businessId}
          />
        )}
        {panel === "issues" && <IssuesPanel issues={issues} surface={surfaceFilter} loading={loading} />}
        {panel === "close" && <CloseAssistantDrawer summary={summary} loading={loading} />}
        {panel === "engine" && (
          <EngineQueuePanel
            queues={engineQueues}
            status={engineStatus}
            onRefresh={refresh}
            onOpenSuggestions={(agent) => open("suggestions", undefined, agent)}
          />
        )}
      </PanelShell>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace Header
// ─────────────────────────────────────────────────────────────────────────────
function CompanionWorkspaceHeader({
  summary,
  refreshing,
  onRefresh,
  onOpenIssues,
  onOpenClose,
}: {
  summary: Summary;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenIssues: () => void;
  onOpenClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/85 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Companion Workspace</p>
        <p className="text-sm text-zinc-600">{summary.voice.tone_tagline}</p>
        <p className="text-[11px] text-zinc-400">Updated {new Date(summary.generated_at).toLocaleString()}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onOpenIssues} variant="outline" size="sm" className="rounded-full border-zinc-200 bg-white text-xs">
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
          Issues
        </Button>
        <Button onClick={onOpenClose} variant="outline" size="sm" className="rounded-full border-zinc-200 bg-white text-xs">
          <Lock className="mr-1.5 h-3.5 w-3.5" />
          Close Readiness
        </Button>
        <Link to="/settings">
          <Button variant="outline" size="sm" className="rounded-full border-zinc-200 bg-white text-xs">
            Settings
          </Button>
        </Link>
        <Button onClick={onRefresh} size="sm" disabled={refreshing} className="rounded-full bg-zinc-900 text-xs text-white hover:bg-zinc-800">
          {refreshing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Section
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection({ summary, focus }: { summary: Summary; focus: { label: string; className: string } }) {
  const [q, setQ] = useState("");

  return (
    <Card className="overflow-hidden border-white/70 bg-white/90 shadow-sm">
      <CardContent className="p-6 md:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
                {summary.voice.greeting}
              </h2>
              <span className={cx("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", focus.className)}>
                {focus.label}
              </span>
            </div>
            <p className="max-w-2xl text-sm text-zinc-500">{summary.voice.tone_tagline}</p>

            <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/75 p-4">
              <div className="flex items-center gap-2 text-zinc-700">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium uppercase tracking-wide">Next best step</span>
              </div>
              <p className="mt-2 text-sm text-zinc-800">{summary.voice.primary_call_to_action}</p>
            </div>
          </div>

          {/* Ask Companion */}
          <div className="w-full lg:max-w-sm">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-zinc-800">Ask Companion</span>
                <Badge variant="outline" className="rounded-full text-[10px] border-zinc-200 text-zinc-500">
                  AI
                </Badge>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Why is cash lower this month?"
                  className="h-11 rounded-xl border-zinc-200 pl-10 text-sm"
                />
              </div>
              <Button className="mt-3 w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800" disabled={!q.trim()}>
                <MessageSquareText className="mr-2 h-4 w-4" />
                Ask
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { bg: string; icon: string; text: string }> = {
  blue: { bg: "bg-blue-50/80", icon: "text-blue-600", text: "text-blue-700" },
  amber: { bg: "bg-amber-50/80", icon: "text-amber-600", text: "text-amber-700" },
  emerald: { bg: "bg-emerald-50/80", icon: "text-emerald-600", text: "text-emerald-700" },
  violet: { bg: "bg-violet-50/80", icon: "text-violet-600", text: "text-violet-700" },
  rose: { bg: "bg-rose-50/80", icon: "text-rose-600", text: "text-rose-700" },
};

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  color = "blue",
  onClick,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: typeof Gauge;
  color?: string;
  onClick?: () => void;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <Card
      className={cx(
        "border-white/70 bg-white/90 shadow-sm transition-all",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-md"
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cx("flex h-10 w-10 items-center justify-center rounded-2xl", c.bg)}>
          <Icon className={cx("h-5 w-5", c.icon)} />
        </div>
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className={cx("text-xl font-semibold tracking-tight", c.text)}>
            {value}
            {suffix && <span className="text-sm font-normal text-zinc-400">{suffix}</span>}
          </p>
        </div>
        {onClick && <ChevronRight className="ml-auto h-4 w-4 text-zinc-300" />}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Pulse Card
// ─────────────────────────────────────────────────────────────────────────────
function HealthPulseCard({
  summary,
  radarData,
  onOpenIssues,
}: {
  summary: Summary;
  radarData: { axis: string; score: number }[];
  onOpenIssues: () => void;
}) {
  const overall = Math.round(summary.radar.reduce((a, r) => a + r.score, 0) / summary.radar.length);

  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Health Pulse</CardTitle>
            <CardDescription className="text-xs">Four domains at a glance</CardDescription>
          </div>
          <Badge className={cx("rounded-lg text-xs font-semibold", overall >= 80 ? "bg-emerald-100 text-emerald-700" : overall >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700")}>
            {overall}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="h-[180px] rounded-xl bg-zinc-50 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="#e4e4e7" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#71717a" }} />
              <ReTooltip />
              <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {summary.radar.map((r) => (
            <div key={r.key} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2">
              <div>
                <p className="text-[11px] text-zinc-500">{r.label}</p>
                <p className="text-sm font-semibold text-zinc-800">{r.score}</p>
              </div>
              {r.open_issues > 0 && (
                <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700 text-[10px]">
                  {r.open_issues}
                </Badge>
              )}
            </div>
          ))}
        </div>

        <Button onClick={onOpenIssues} variant="outline" size="sm" className="w-full rounded-lg text-xs">
          View all issues
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Close Readiness Card
// ─────────────────────────────────────────────────────────────────────────────
function CloseReadinessCard({ summary, onOpenClose }: { summary: Summary; onOpenClose: () => void }) {
  const cr = summary.close_readiness;
  const isReady = cr.status === "ready";

  return (
    <Card className="border-zinc-200/70 bg-white/90 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Close Readiness</CardTitle>
            <CardDescription className="text-xs">{cr.period_label}</CardDescription>
          </div>
          <Badge className={cx("rounded-full px-3 text-xs", isReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
            {isReady ? "Ready" : "Not Ready"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Progress</span>
              <span className="font-medium text-zinc-700">{cr.progress_percent}%</span>
            </div>
            <Progress value={cr.progress_percent} className="h-2" />
          </div>
        </div>

        {cr.blockers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-700">Blockers</p>
            {cr.blockers.slice(0, 3).map((b) => {
              const chip = severityChip(b.severity);
              return (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-800 truncate">{b.title}</p>
                    {b.surface && <p className="text-[10px] text-zinc-500">{surfaceMeta(b.surface).label}</p>}
                  </div>
                  <span className={cx("ml-2 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium", chip.cls)}>
                    {chip.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={onOpenClose} size="sm" className="flex-1 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs">
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            Open Close Assistant
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl border-zinc-200 bg-white text-xs">
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Today's Focus Card
// ─────────────────────────────────────────────────────────────────────────────
function TodayFocusCard({ items, onOpenSuggestions }: { items: PlaybookItem[]; onOpenSuggestions: () => void }) {
  const top = items.slice(0, 5);

  if (!top.length) return null;

  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Today's Focus</CardTitle>
            <CardDescription className="text-xs">Prioritized steps from your AI companion</CardDescription>
          </div>
          <Button onClick={onOpenSuggestions} variant="ghost" size="sm" className="text-xs text-zinc-600">
            All suggestions
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {top.map((p, idx) => {
            const chip = severityChip(p.severity);
            const meta = p.surface ? surfaceMeta(p.surface) : null;
            return (
              <div key={p.id} className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/40 p-4 transition-colors hover:bg-zinc-50">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200/60 text-xs font-semibold text-zinc-600">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className={cx("rounded-md px-2 py-0.5 text-[10px] font-medium", chip.cls)}>{chip.label}</span>
                    {meta && (
                      <span className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-600">
                        {meta.label}
                      </span>
                    )}
                    {p.premium && (
                      <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-white">Premium</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-zinc-800">{p.title}</p>
                  {p.description && <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{p.description}</p>}
                </div>
                <Button variant="ghost" size="sm" className="shrink-0 text-xs text-zinc-500 hover:text-zinc-700">
                  Open
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Surfaces Grid
// ─────────────────────────────────────────────────────────────────────────────
function SurfacesGrid({
  summary,
  proposals,
  issues,
  onOpenSuggestions,
  onOpenIssues,
}: {
  summary: Summary;
  proposals: { surface: SurfaceKey }[];
  issues: { surface: SurfaceKey }[];
  onOpenSuggestions: (surface?: SurfaceKey) => void;
  onOpenIssues: (surface?: SurfaceKey) => void;
}) {
  const coverageBy = new Map(summary.coverage.map((c) => [c.key, c]));
  const subtitleBy = new Map(summary.llm_subtitles.map((s) => [s.surface, s]));
  const surfaces: SurfaceKey[] = ["banking", "invoices", "receipts", "books"];

  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Surfaces</CardTitle>
        <CardDescription className="text-xs">Coverage and activity across your domains</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {surfaces.map((k) => {
            const meta = surfaceMeta(k);
            const cov = coverageBy.get(k);
            const sub = subtitleBy.get(k);
            const sugCount = proposals.filter((p) => p.surface === k).length;
            const issCount = issues.filter((i) => i.surface === k).length;

            return (
              <div
                key={k}
                className="group rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className={cx("flex h-10 w-10 items-center justify-center rounded-xl", k === "banking" ? "bg-blue-50" : k === "invoices" ? "bg-violet-50" : k === "receipts" ? "bg-amber-50" : "bg-emerald-50")}>
                    <meta.icon className={cx("h-5 w-5", k === "banking" ? "text-blue-600" : k === "invoices" ? "text-violet-600" : k === "receipts" ? "text-amber-600" : "text-emerald-600")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-800">{meta.label}</p>
                    {sub ? (
                      <p className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                        {sub.subtitle}
                        <span className="ml-1 inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1 text-[9px] text-zinc-400">
                          {sub.source === "ai" ? "AI" : "Auto"}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-zinc-400">No notes</p>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-zinc-50 px-2.5 py-1.5">
                    <p className="text-[10px] text-zinc-400">Coverage</p>
                    <p className="text-sm font-semibold text-zinc-700">{cov ? `${cov.coverage_percent}%` : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-2.5 py-1.5">
                    <p className="text-[10px] text-zinc-400">Suggestions</p>
                    <p className="text-sm font-semibold text-zinc-700">{sugCount}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-2.5 py-1.5">
                    <p className="text-[10px] text-zinc-400">Issues</p>
                    <p className="text-sm font-semibold text-zinc-700">{issCount}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Progress</span>
                    <span>{cov ? `${cov.covered_items}/${cov.total_items}` : ""}</span>
                  </div>
                  <Progress value={cov?.coverage_percent || 0} className="h-1.5" />
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs"
                    onClick={() => onOpenSuggestions(k)}
                    disabled={!sugCount}
                  >
                    Suggestions
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-xs"
                    onClick={() => onOpenIssues(k)}
                  >
                    Issues
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Finance Snapshot Card
// ─────────────────────────────────────────────────────────────────────────────
function BooksBankAuditCard({
  summary,
  proposals,
  issues,
  booksRunInFlight,
  bankRunInFlight,
  auditMessage,
  auditError,
  onRunBooks,
  onRunAudit,
  onOpenSuggestions,
  onOpenIssues,
}: {
  summary: Summary;
  proposals: { surface: SurfaceKey }[];
  issues: { surface: SurfaceKey }[];
  booksRunInFlight: boolean;
  bankRunInFlight: boolean;
  auditMessage: string | null;
  auditError: string | null;
  onRunBooks: () => void;
  onRunAudit: () => void;
  onOpenSuggestions: (surface?: SurfaceKey) => void;
  onOpenIssues: (surface?: SurfaceKey) => void;
}) {
  const coverageBy = new Map(summary.coverage.map((c) => [c.key, c]));
  const booksCoverage = coverageBy.get("books");
  const bankingCoverage = coverageBy.get("banking");
  const booksSuggestions = proposals.filter((p) => p.surface === "books").length;
  const bankingSuggestions = proposals.filter((p) => p.surface === "banking").length;
  const booksIssues = issues.filter((i) => i.surface === "books").length;
  const bankingIssues = issues.filter((i) => i.surface === "banking").length;
  const combinedCoverage = Math.round(
    ((booksCoverage?.coverage_percent || 0) + (bankingCoverage?.coverage_percent || 0)) / 2,
  );
  const combinedIssues = booksIssues + bankingIssues;

  return (
    <Card className="border-zinc-200/70 bg-white/90 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">Books + Bank Audit</CardTitle>
            <CardDescription className="text-xs">
              Run both reviews from one place, then inspect findings together.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cx(
              "rounded-full text-[10px]",
              combinedCoverage >= 85
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            {combinedCoverage}% combined
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-700">Books Review</p>
              <span className="text-[11px] font-semibold text-zinc-800">
                {booksCoverage ? `${booksCoverage.coverage_percent}%` : "--"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {booksSuggestions} suggestions • {booksIssues} issues
            </p>
            <button
              type="button"
              className="mt-1 text-[11px] font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
              onClick={() => onOpenSuggestions("books")}
            >
              View books suggestions
            </button>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-700">Bank Audit</p>
              <span className="text-[11px] font-semibold text-zinc-800">
                {bankingCoverage ? `${bankingCoverage.coverage_percent}%` : "--"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {bankingSuggestions} suggestions • {bankingIssues} issues
            </p>
            <button
              type="button"
              className="mt-1 text-[11px] font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
              onClick={() => onOpenSuggestions("banking")}
            >
              View bank suggestions
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3 py-2">
          <p className="text-[11px] text-zinc-500">Combined queue</p>
          <p className="text-sm font-semibold text-zinc-800">
            {booksSuggestions + bankingSuggestions} suggestions • {combinedIssues} issues
          </p>
        </div>

        {auditError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{auditError}</div>
        )}
        {auditMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{auditMessage}</div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            size="sm"
            className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs"
            onClick={onRunBooks}
            disabled={booksRunInFlight || bankRunInFlight}
          >
            {booksRunInFlight ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Review Books
          </Button>
          <Button
            size="sm"
            className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs"
            onClick={onRunAudit}
            disabled={booksRunInFlight || bankRunInFlight}
          >
            {bankRunInFlight ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Run Audit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-zinc-200 bg-white text-xs"
            onClick={() => onOpenIssues()}
            disabled={combinedIssues === 0}
          >
            Combined Issues
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptsIngestionCard() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const canUseLocalStorage =
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.localStorage.getItem === "function" &&
    typeof window.localStorage.setItem === "function";
  const [preferReceipts, setPreferReceipts] = useState<boolean>(() => {
    if (!canUseLocalStorage) return true;
    return window.localStorage.getItem("companion_prefer_receipts") !== "false";
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fileCountLabel = files.length === 1 ? "1 file selected" : `${files.length} files selected`;

  const onUpload = async () => {
    if (!files.length) {
      setError("Select at least one receipt to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    setInfo(null);

    const result = await uploadReceiptRun(files, { defaultCurrency });
    if (!result.ok) {
      setError(result.error);
      setUploading(false);
      return;
    }

    setInfo(result.runId ? `Receipt run ${result.runId} queued.` : "Receipt run queued.");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
  };

  const onTogglePreferReceipts = (next: boolean) => {
    setPreferReceipts(next);
    if (canUseLocalStorage) {
      window.localStorage.setItem("companion_prefer_receipts", next ? "true" : "false");
    }
  };

  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-semibold">Receipt Intake</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={cx(
              "rounded-md text-[10px]",
              preferReceipts
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 bg-zinc-50 text-zinc-600",
            )}
          >
            {preferReceipts ? "Receipts first" : "Invoices first"}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Upload receipts and route expense capture through receipt AI in place of invoice AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-zinc-700">Replace invoice AI for expenses</p>
            <p className="text-[10px] text-zinc-500">Prefers receipt extraction for vendor spend documents.</p>
          </div>
          <Switch checked={preferReceipts} onCheckedChange={onTogglePreferReceipts} />
        </div>

        <div className="space-y-2">
          <Input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <span className="text-[11px] text-zinc-500">{files.length ? fileCountLabel : "No files selected"}</span>
            <Input
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase().slice(0, 3))}
              className="h-8 w-20 text-center text-xs"
              aria-label="Default currency"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {info}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            className="rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs"
            disabled={uploading || files.length === 0}
            onClick={onUpload}
          >
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Upload Receipts
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-xs"
            onClick={() => {
              window.location.assign("/expenses");
            }}
          >
            Open Expenses
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceSnapshotCard({ finance }: { finance: FinanceSnapshot }) {
  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <CardTitle className="text-sm font-semibold">Finance Snapshot</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Ending Cash" value={formatMoney(finance.ending_cash)} />
          <MiniMetric label="Monthly Burn" value={formatMoney(finance.monthly_burn)} />
          <MiniMetric label="Runway" value={`${finance.runway_months.toFixed(1)} mo`} />
        </div>

        {finance.months.length > 0 && (
          <div className="h-[130px] rounded-xl bg-zinc-50 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={finance.months} margin={{ left: 4, right: 4, top: 4, bottom: 0 }}>
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <ReTooltip />
                <Area type="monotone" dataKey="rev" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={1.5} />
                <Area type="monotone" dataKey="exp" stroke="#a1a1aa" fill="#a1a1aa" fillOpacity={0.05} strokeWidth={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-700">Accounts Receivable</p>
            <Badge variant="outline" className="rounded-md text-[10px] border-amber-200 bg-amber-50 text-amber-700">
              {formatMoney(finance.total_overdue)} overdue
            </Badge>
          </div>
          {finance.ar_buckets.length > 0 && (
            <div className="h-[100px] rounded-xl bg-zinc-50 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={finance.ar_buckets} margin={{ left: 4, right: 4, top: 4, bottom: 0 }}>
                  <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <ReTooltip />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
      <p className="text-[10px] text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-800 mt-0.5">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tax Guardian Card
// ─────────────────────────────────────────────────────────────────────────────
function TaxGuardianCard({ tax }: { tax: TaxGuardian }) {
  const totalAnoms = tax.anomaly_counts.low + tax.anomaly_counts.medium + tax.anomaly_counts.high;
  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-sm font-semibold">Tax Guardian</CardTitle>
          </div>
          <Badge variant="outline" className={cx("rounded-md text-[10px]", totalAnoms > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
            {totalAnoms} flags
          </Badge>
        </div>
        <CardDescription className="text-xs">{tax.period_key}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {tax.net_tax.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Net Tax</p>
            {tax.net_tax.map((x) => (
              <div key={x.jurisdiction} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                <span className="text-xs font-medium text-zinc-700">{x.jurisdiction}</span>
                <span className="text-xs font-semibold text-zinc-800">{formatMoney(x.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-emerald-50 px-2.5 py-2 text-center">
            <p className="text-[10px] text-emerald-600">Low</p>
            <p className="text-sm font-semibold text-emerald-700">{tax.anomaly_counts.low}</p>
          </div>
          <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-center">
            <p className="text-[10px] text-amber-600">Med</p>
            <p className="text-sm font-semibold text-amber-700">{tax.anomaly_counts.medium}</p>
          </div>
          <div className="rounded-lg bg-rose-50 px-2.5 py-2 text-center">
            <p className="text-[10px] text-rose-600">High</p>
            <p className="text-sm font-semibold text-rose-700">{tax.anomaly_counts.high}</p>
          </div>
        </div>

        <Button variant="outline" size="sm" className="w-full rounded-lg text-xs">
          <Gauge className="mr-1.5 h-3.5 w-3.5" />
          Open Tax Guardian
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Queue Card
// ─────────────────────────────────────────────────────────────────────────────
function EngineQueueCard({
  queues,
  status,
  onOpenQueue,
}: {
  queues: EngineQueuesResult | null;
  status: EngineStatusPayload | null;
  onOpenQueue: () => void;
}) {
  const stats = queues?.data?.stats;
  const jobTotals = queues?.data?.job_totals;
  const mode = status?.mode || queues?.data?.mode || "offline";
  const trust = queues ? Math.round(queues.data.trust_score) : null;
  const stale = queues?.stale;

  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-zinc-500" />
            <CardTitle className="text-sm font-semibold">Autonomy Engine</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="rounded-md text-[10px] border-zinc-200 text-zinc-500">
              {mode.replace("_", " ")}
            </Badge>
            <span className={cx("h-2 w-2 rounded-full", stale === false ? "bg-emerald-400" : stale === true ? "bg-amber-400" : "bg-zinc-300")} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Queued" value={`${jobTotals?.queued ?? 0}`} />
          <MiniMetric label="Running" value={`${jobTotals?.running ?? 0}`} />
          <MiniMetric label="Blocked" value={`${jobTotals?.blocked ?? 0}`} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Ready" value={`${stats?.ready ?? 0}`} />
          <MiniMetric label="Attention" value={`${stats?.needs_attention ?? 0}`} />
          <MiniMetric label="Approval" value={`${stats?.waiting_approval ?? 0}`} />
        </div>

        {trust != null && (
          <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
            <span className="text-xs text-zinc-500">Trust Score</span>
            <span className="text-sm font-semibold text-zinc-800">{trust}%</span>
          </div>
        )}

        <Button onClick={onOpenQueue} size="sm" className="w-full rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs">
          View Engine Queue
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonBoard() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Hero skeleton */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="h-6 w-64 rounded-lg bg-zinc-100" />
        <div className="mt-3 h-4 w-96 rounded-lg bg-zinc-100" />
        <div className="mt-5 h-20 rounded-xl bg-zinc-100" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-100" />
              <div className="space-y-2">
                <div className="h-3 w-16 rounded bg-zinc-100" />
                <div className="h-5 w-12 rounded bg-zinc-100" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-6"><div className="h-64 rounded-xl bg-zinc-100" /></div>
            <div className="rounded-xl border border-zinc-200 bg-white p-6"><div className="h-64 rounded-xl bg-zinc-100" /></div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6"><div className="h-48 rounded-xl bg-zinc-100" /></div>
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6"><div className="h-56 rounded-xl bg-zinc-100" /></div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6"><div className="h-40 rounded-xl bg-zinc-100" /></div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6"><div className="h-48 rounded-xl bg-zinc-100" /></div>
        </div>
      </div>
    </div>
  );
}
