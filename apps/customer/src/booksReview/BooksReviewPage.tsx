import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ensureCsrfToken, getCsrfToken as getCsrfTokenSync } from "../utils/csrf";

// --- CSRF HELPERS ---
function getCsrfToken(): string {
  return getCsrfTokenSync();
}

// --- TYPES ---
type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
type RiskLevel = "low" | "medium" | "high" | "unknown";

interface Finding {
  code: string;
  severity: string;
  message: string;
  references?: Record<string, any>;
}

interface RankedIssue {
  severity: string;
  title: string;
  message: string;
  related_journal_ids?: number[];
  related_accounts?: string[];
}

interface BooksReviewRun {
  id: number;
  created_at: string;
  created_by?: number | null;
  status: RunStatus;
  period_start: string;
  period_end: string;
  metrics?: Record<string, any>;
  overall_risk_score?: string | number | null;
  risk_level?: RiskLevel | null;
  trace_id?: string | null;
}

interface RunDetail extends BooksReviewRun {
  findings: Finding[];
  llm_explanations?: string[];
  llm_ranked_issues?: RankedIssue[];
  llm_suggested_checks?: string[];
  companion_enabled?: boolean;
}

// --- HELPERS ---
const RISK_THRESHOLDS = { medium: 40, high: 70 };

const parseRiskScore = (score: string | number | null | undefined): number | null => {
  if (typeof score === "number") return Number.isFinite(score) ? score : null;
  if (typeof score === "string") {
    const parsed = parseFloat(score);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const deriveRiskLevel = (score: string | number | null | undefined): RiskLevel => {
  const parsed = parseRiskScore(score);
  if (parsed === null) return "unknown";
  if (parsed >= RISK_THRESHOLDS.high) return "high";
  if (parsed >= RISK_THRESHOLDS.medium) return "medium";
  return "low";
};

const riskLevelLabel = (level: RiskLevel): string => {
  if (level === "high") return "High Risk";
  if (level === "medium") return "Medium Risk";
  if (level === "low") return "Low Risk";
  return "Unknown";
};

// --- ICONS (inline SVG for simplicity) ---
const BookOpenIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const BrainIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LoaderIcon = () => (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// --- COMPONENTS ---
const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ children, className = "", title = "", subtitle = "", right = null }) => (
  <div className={`bg-[#131316] border border-white/5 rounded-2xl overflow-hidden ${className}`}>
    {(title || subtitle || right) && (
      <div className="px-6 py-4 border-b border-white/5 flex justify-between items-start">
        <div>
          {title && <h3 className="text-sm font-bold text-white">{title}</h3>}
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {right && <div className="ml-4">{right}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const RiskBadge: React.FC<{ level: RiskLevel; label?: string }> = ({ level, label }) => {
  const styles: Record<RiskLevel, string> = {
    low: "bg-[#A3E635]/10 text-[#A3E635] border-[#A3E635]/20",
    medium: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    unknown: "bg-[#27272A] text-gray-400 border-white/10",
  };

  const dotStyles: Record<RiskLevel, string> = {
    low: "bg-[#A3E635]",
    medium: "bg-amber-400",
    high: "bg-red-500",
    unknown: "bg-gray-500",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${styles[level]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[level]}`} />
      {label || riskLevelLabel(level)}
    </span>
  );
};

const StatusIcon: React.FC<{ status: RunStatus }> = ({ status }) => {
  if (status === "COMPLETED") return <span className="text-emerald-500"><CheckCircleIcon /></span>;
  if (status === "RUNNING") return <span className="text-blue-500"><ClockIcon /></span>;
  return <span className="text-rose-500"><XCircleIcon /></span>;
};

// --- MAIN PAGE ---
export default function BooksReviewPage() {
  const [runs, setRuns] = useState<BooksReviewRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  // Initialize dates to current week
  useEffect(() => {
    ensureCsrfToken().catch(() => undefined);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    setPeriodStart(startOfWeek.toISOString().split("T")[0]);
    setPeriodEnd(endOfWeek.toISOString().split("T")[0]);
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/agentic/books-review/runs", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load runs");
      const data = await res.json();
      setRuns(data.runs || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load runs");
    }
  }, []);

  const loadRunDetail = useCallback(async (runId: number) => {
    try {
      const res = await fetch(`/api/agentic/books-review/run/${runId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load run detail");
      const data = await res.json();
      setSelectedRun(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load run detail");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadRuns().finally(() => setLoading(false));
  }, [loadRuns]);

  useEffect(() => {
    if (runs.length > 0 && !selectedRun) {
      loadRunDetail(runs[0].id);
    }
  }, [runs, selectedRun, loadRunDetail]);

  const runReview = async () => {
    if (!periodStart || !periodEnd) {
      setError("Please select a valid date range");
      return;
    }
    setError(null);
    setInfo(null);
    setRunning(true);
    try {
      const form = new FormData();
      form.append("period_start", periodStart);
      form.append("period_end", periodEnd);
      const res = await fetch("/api/agentic/books-review/run", {
        method: "POST",
        body: form,
        headers: { "X-CSRFToken": getCsrfToken() },
        credentials: "same-origin",
      });
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        console.error("Server returned non-JSON response:", text.slice(0, 200));
        throw new Error("Server returned an unexpected response. Please try again.");
      }
      if (!res.ok) throw new Error(json.error || "Review failed");
      setInfo(`Review #${json.run_id} completed successfully`);
      await loadRuns();
      if (json.run_id) {
        await loadRunDetail(json.run_id);
      }
    } catch (err: any) {
      setError(err?.message || "Review failed");
    } finally {
      setRunning(false);
    }
  };

  // Derived values
  const journalsCount = selectedRun?.metrics?.journals_total ?? 0;
  const highRiskCount = selectedRun?.metrics?.journals_high_risk ?? 0;
  const accountsTouched = selectedRun?.metrics?.accounts_touched ?? 0;
  const riskLevel = selectedRun ? deriveRiskLevel(selectedRun.overall_risk_score) : "unknown";
  const llmExplanations = selectedRun?.llm_explanations || [];
  const llmSuggestedChecks = selectedRun?.llm_suggested_checks || [];
  const llmRankedIssues = selectedRun?.llm_ranked_issues || [];
  const hasLlmInsights = llmExplanations.length > 0 || llmRankedIssues.length > 0 || llmSuggestedChecks.length > 0;
  const companionEnabled = selectedRun?.companion_enabled ?? false;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A3E635] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] pb-12" style={{ fontFamily: "'Inter', sans-serif" }}>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8"
        >
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Audit</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">Books Review</h1>
            <p className="text-gray-500 mt-1 text-sm max-w-xl">
              Ledger-wide audit for selected periods. AI analysis layered over deterministic checks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center px-3 py-1.5 bg-[#131316] border border-white/10 rounded-full text-xs font-medium text-gray-400">
              <span className="w-2 h-2 rounded-full bg-[#A3E635] mr-2" />
              Live
            </div>
            {selectedRun?.trace_id && (
              <Link
                to={`/agentic/console?trace=${encodeURIComponent(selectedRun.trace_id)}`}
                className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <ExternalLinkIcon />
                Console
              </Link>
            )}
          </div>
        </motion.header>

        {/* Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}
          {info && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl border border-[#A3E635]/20 bg-[#A3E635]/10 text-[#A3E635] text-sm flex items-center gap-3"
            >
              <ShieldCheckIcon />
              {info}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >

          {/* Current Run Status Banner */}
          {selectedRun && selectedRun.status === "COMPLETED" && (
            <motion.div variants={item}>
              <div className="relative overflow-hidden rounded-xl border border-[#A3E635]/20 bg-[#A3E635]/10 p-4 flex items-start gap-4">
                <div className="mt-1">
                  <div className="h-8 w-8 rounded-full bg-[#A3E635]/20 flex items-center justify-center border border-[#A3E635]/30 text-[#A3E635]">
                    <ShieldCheckIcon />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#A3E635]">Review #{selectedRun.id} Completed</h3>
                  <p className="mt-1 text-xs text-gray-400">
                    Period <span className="font-mono font-medium text-white">{selectedRun.period_start}</span> to <span className="font-mono font-medium text-white">{selectedRun.period_end}</span> analyzed.
                    Processed <span className="font-semibold text-white">{journalsCount} journals</span> across {accountsTouched} accounts.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Control Panel & Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Run Review Form */}
            <motion.div variants={item} className="lg:col-span-2">
              <Card title="Run Review" subtitle="Select a fiscal period to scan." className="h-full">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Period Start</label>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="w-full px-3 py-2 bg-[#09090B] border border-white/10 rounded-xl text-sm text-white focus:border-[#8B5CF6] outline-none"
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Period End</label>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-[#09090B] border border-white/10 rounded-xl text-sm text-white focus:border-[#8B5CF6] outline-none"
                    />
                  </div>

                  <button
                    onClick={runReview}
                    disabled={running}
                    className="w-full md:w-auto px-6 py-2.5 bg-[#A3E635] text-black text-sm font-bold rounded-xl hover:bg-[#bef264] shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {running ? <LoaderIcon /> : <SearchIcon />}
                    {running ? "Scanning..." : "Scan Books"}
                  </button>
                </div>
              </Card>
            </motion.div>

            {/* Snapshot Metrics */}
            <motion.div variants={item} className="lg:col-span-1">
              <Card
                title="Latest Snapshot"
                subtitle={selectedRun ? `Run #${selectedRun.id}` : "No runs yet"}
                className="h-full"
              >
                {selectedRun ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium">Risk</span>
                      <RiskBadge level={riskLevel} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 bg-[#09090B] rounded-xl border border-white/5">
                        <p className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">Journals</p>
                        <p className="text-xl font-bold text-white mt-0.5">{journalsCount}</p>
                      </div>
                      <div className="p-3 bg-[#09090B] rounded-xl border border-white/5">
                        <p className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">Anomalies</p>
                        <p className={`text-xl font-bold mt-0.5 ${highRiskCount > 0 ? "text-red-400" : "text-[#A3E635]"}`}>{highRiskCount}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Run a review to see metrics.</div>
                )}
              </Card>
            </motion.div>
          </div>

          {/* Detail View */}
          {selectedRun && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left: AI & Findings */}
              <motion.div variants={item} className="lg:col-span-2 space-y-6">

                {/* AI Insights Card */}
                <Card className="overflow-visible">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-[#8B5CF6] to-[#4F46E5] rounded-lg shadow-md text-white">
                      <SparklesIcon />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Neural Analysis</h3>
                      <p className="text-xs text-gray-500">Narrative insights generated by Companion AI</p>
                    </div>
                  </div>

                  {hasLlmInsights ? (
                    <div className="space-y-5">
                      {llmExplanations.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-white mb-2">Audit Summary</h4>
                          <div className="bg-[#09090B] rounded-xl p-4 border border-white/5 space-y-3">
                            {llmExplanations.map((exp, i) => (
                              <div key={i} className="flex gap-3 items-start">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8B5CF6] flex-shrink-0" />
                                <p className="text-xs text-gray-400 leading-relaxed">{exp}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {llmRankedIssues.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                            <BrainIcon />
                            Ranked Issues
                          </h4>
                          <div className="space-y-2">
                            {llmRankedIssues.map((issue, i) => (
                              <div key={i} className="p-3 bg-[#09090B] border border-white/5 rounded-xl">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${issue.severity === "high" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                      issue.severity === "medium" ? "bg-amber-400/10 text-amber-400 border-amber-400/20" :
                                        "bg-[#27272A] text-gray-400 border-white/10"
                                    }`}>
                                    {issue.severity.toUpperCase()}
                                  </span>
                                  <span className="text-xs font-semibold text-white">{issue.title}</span>
                                </div>
                                <p className="text-xs text-gray-400">{issue.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {llmSuggestedChecks.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                            <BrainIcon />
                            Suggested Checks
                          </h4>
                          <div className="space-y-2">
                            {llmSuggestedChecks.map((check, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-[#09090B] border border-white/5 rounded-xl hover:border-[#8B5CF6]/30 transition-all cursor-pointer group">
                                <div className="flex items-center gap-3">
                                  <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-transparent group-hover:text-gray-400">
                                    <CheckCircleIcon />
                                  </div>
                                  <span className="text-xs text-gray-400 font-medium group-hover:text-white transition-colors">{check}</span>
                                </div>
                                <span className="text-gray-600 group-hover:text-[#8B5CF6] transform group-hover:translate-x-1 transition-all">
                                  <ArrowRightIcon />
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : companionEnabled === false ? (
                    <div className="text-sm text-gray-400 bg-[#09090B] p-4 rounded-xl border border-white/5">
                      <span className="font-medium text-white">AI Companion is turned off</span> for this business. Turn it on in{" "}
                      <Link to="/settings" className="text-[#8B5CF6] underline hover:text-[#a78bfa]">Account settings</Link>{" "}
                      to see AI insights.
                    </div>
                  ) : companionEnabled ? (
                    <div className="text-sm text-amber-400 bg-amber-400/10 p-4 rounded-xl border border-amber-400/20">
                      AI Companion ran but could not generate insights for this period. Deterministic checks completed normally.
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      AI insights unavailable for this run.
                    </div>
                  )}
                </Card>

                {/* Deterministic Findings */}
                <Card title="Deterministic Findings" subtitle="Rule-based validation results">
                  {selectedRun.findings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-[#A3E635]/10 flex items-center justify-center mb-3 text-[#A3E635]">
                        <ShieldCheckIcon />
                      </div>
                      <p className="text-sm font-medium text-white">Clean Ledger</p>
                      <p className="text-xs text-gray-500 max-w-xs mt-1">
                        No deterministic rule violations found for this period.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {selectedRun.findings.map((f, idx) => (
                        <li key={idx} className="p-3 border border-white/5 bg-[#09090B] rounded-xl">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${f.severity === "high" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                f.severity === "medium" ? "bg-amber-400/10 text-amber-400 border-amber-400/20" :
                                  "bg-[#27272A] text-gray-400 border-white/10"
                              }`}>
                              {f.code}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">{f.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

              </motion.div>

              {/* Right: History */}
              <motion.div variants={item} className="lg:col-span-1">
                <Card
                  title="Run History"
                  subtitle="Previous analysis archives"
                  className="h-full flex flex-col"
                >
                  <div className="flex-1 -mx-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-wider border-b border-white/5">Date Range</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-wider border-b border-white/5">Status</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-wider border-b border-white/5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((run) => {
                          const runRiskLevel = deriveRiskLevel(run.overall_risk_score);
                          return (
                            <tr
                              key={run.id}
                              className={`group hover:bg-[#18181B] transition-colors cursor-pointer ${selectedRun?.id === run.id ? "bg-[#1C1C20]" : ""}`}
                              onClick={() => loadRunDetail(run.id)}
                            >
                              <td className="px-3 py-3 border-b border-white/5">
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-white">{run.period_start}</span>
                                  <span className="text-[10px] text-gray-500">{run.period_end}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                  <StatusIcon status={run.status} />
                                  <span className={`text-xs font-medium ${runRiskLevel === "high" ? "text-red-400" :
                                      runRiskLevel === "medium" ? "text-amber-400" : "text-[#A3E635]"
                                    }`}>
                                    {riskLevelLabel(runRiskLevel)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 border-b border-white/5 text-right">
                                <button className="text-gray-500 hover:text-[#A3E635] transition-colors">
                                  <ArrowRightIcon />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5">
                    <button
                      onClick={() => loadRuns()}
                      className="w-full py-2 text-xs font-medium text-gray-500 hover:text-white border border-transparent hover:border-white/10 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <HistoryIcon />
                      Refresh Archives
                    </button>
                  </div>
                </Card>
              </motion.div>

            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
}
