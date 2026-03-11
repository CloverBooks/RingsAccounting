import React, { useMemo, useState, useRef, useEffect } from "react";
import { Sparkles, ArrowUpRight, Send, Paperclip, RefreshCw, Zap, Brain, ScanLine, ChevronRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//    Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type Accent = "green" | "red" | "yellow" | "purple";

interface MetricCardData {
    title: string;
    subtitle: string;
    value: string;
    accent: Accent;
    footerLeft?: string;
    footerRight?: string;
    footerStats?: [string, string][];
    large?: boolean;
}

interface ChatMsg {
    id: number;
    role: "ai" | "user";
    text: string;
    time: string;
}

const ACCENT_DOT: Record<Accent, string> = {
    green: "bg-[#A3E635]",
    red: "bg-[#F87171]",
    yellow: "bg-amber-400",
    purple: "bg-[#8B5CF6]",
};

const ACCENT_BAR: Record<Accent, string> = {
    green: "bg-[#A3E635]/30",
    red: "bg-[#F87171]/30",
    yellow: "bg-amber-400/30",
    purple: "bg-[#8B5CF6]/30",
};

const METRIC_CARDS: MetricCardData[] = [
    {
        title: "Payment Processing",
        subtitle: "Last transaction: Apr 24",
        value: "72.52%",
        accent: "green",
        footerLeft: "Automatic",
        footerRight: "Reconciled",
    },
    {
        title: "Statement Coverage",
        subtitle: "Last statement: Apr 22",
        value: "61.23%",
        accent: "green",
        footerLeft: "Synced",
        footerRight: "Pending Review",
    },
    {
        title: "Discrepancies",
        subtitle: "Last scan: Apr 24",
        value: "13.78%",
        accent: "red",
        footerLeft: "Flagged",
        footerRight: "Need Action",
    },
    {
        title: "Month-End Closures",
        subtitle: "Rolling account metrics",
        value: "77.24%",
        accent: "green",
        large: true,
        footerStats: [
            ["88", "Closed"],
            ["19", "Open"],
            ["19/5", "Timely"],
            ["84/0", "On Track"],
        ],
    },
    {
        title: "AI Usage Rate",
        subtitle: "Automation coverage",
        value: "46.36%",
        accent: "yellow",
        large: true,
        footerStats: [
            ["56%", "Synced"],
            ["11%", "Auto-Send"],
            ["32%", "Manual"],
            ["74%", "Retrieved"],
        ],
    },
];

const INITIAL_MESSAGES: ChatMsg[] = [
    { id: 1, role: "ai", text: "Hello! I'm your Rings AI Companion. I can review your books, flag anomalies, run reconciliation checks, and answer any financial questions.", time: "now" },
    { id: 2, role: "user", text: "What's my current cash burn and runway?", time: "10:57" },
    { id: 3, role: "ai", text: "Based on your latest bank sync: monthly burn is ~$48,200. With $114,360 in Chase Operating, your runway is approximately 2.4 months. I'd recommend reviewing the AWS and payroll line items.", time: "10:57" },
    { id: 4, role: "user", text: "Can you flag all overdue invoices?", time: "11:00" },
    { id: 5, role: "ai", text: "Found 2 overdue invoices totalling $26,650 — Acme Corp ($24,500, 8 days late) and Global Tech ($14,200 partial, due tomorrow). Want me to draft reminders?", time: "11:00" },
];

const QUICK_PROMPTS = [
    "Summarise this month's books",
    "Flag missing receipts",
    "Check reconciliation status",
    "Analyse cash flow trend",
];

const MODELS = [
    { id: "gpt4o", label: "GPT-4o", icon: <Brain size={11} /> },
    { id: "docai", label: "Document AI", icon: <ScanLine size={11} /> },
    { id: "finai", label: "Financial AI", icon: <Zap size={11} /> },
    { id: "custom", label: "Rings Core", icon: <Sparkles size={11} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
//    Glass Orb Ring  (adapted from Clerio's GlassRing, dark palette)
// ─────────────────────────────────────────────────────────────────────────────

const GlassOrb: React.FC = () => (
    <div className="pointer-events-none absolute inset-x-0 top-[80px] z-0 flex justify-center overflow-hidden h-[340px]">
        <div className="relative h-[340px] w-[520px]">
            {[0, 36, 72, 108, 144, 180, 216].map((deg, i) => (
                <div
                    key={deg}
                    className="absolute left-1/2 top-1/2 h-[140px] w-[56px] rounded-[28px]"
                    style={{
                        transform: `translate(-50%, -110px) rotate(${deg}deg)`,
                        background:
                            i % 3 === 0
                                ? "linear-gradient(180deg, rgba(139,92,246,0.22) 0%, rgba(139,92,246,0.08) 50%, rgba(163,230,53,0.25) 100%)"
                                : i % 3 === 1
                                    ? "linear-gradient(180deg, rgba(163,230,53,0.15) 0%, rgba(163,230,53,0.04) 50%, rgba(139,92,246,0.20) 100%)"
                                    : "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(139,92,246,0.12) 50%, rgba(163,230,53,0.10) 100%)",
                        border: "1px solid rgba(163,230,53,0.12)",
                        boxShadow: i % 2 === 0
                            ? "inset 0 0 14px rgba(139,92,246,0.15), 0 8px 24px rgba(139,92,246,0.08)"
                            : "inset 0 0 14px rgba(163,230,53,0.08), 0 8px 24px rgba(163,230,53,0.06)",
                    }}
                />
            ))}
            {/* Central glow */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-[#8B5CF6]/10 blur-2xl" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[#A3E635]/8 blur-xl" />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Metric Card  (dark-themed, mirrors Clerio MetricCard)
// ─────────────────────────────────────────────────────────────────────────────

const MetricCard: React.FC<MetricCardData> = ({
    title, subtitle, value, accent, footerLeft, footerRight, footerStats, large,
}) => {
    const bars = useMemo(() =>
        Array.from({ length: 20 }, () => Math.floor(Math.random() * 34) + 8),
        []);
    const dot = ACCENT_DOT[accent];
    const bar = ACCENT_BAR[accent];

    return (
        <div className={`bg-[#131316] border border-white/5 rounded-[24px] p-5 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-white/10 transition-colors ${large ? "min-h-[240px]" : "min-h-[210px]"}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Sparkles size={12} className="text-gray-500" />
                    {title}
                </div>
                <ArrowUpRight size={14} className="text-gray-600 hover:text-gray-400 cursor-pointer transition-colors" />
            </div>
            <p className="text-[11px] text-gray-600 mb-5">{subtitle}</p>

            {/* Value */}
            <div className="flex items-center gap-3 mb-4">
                <span className="text-[40px] font-light tracking-tight text-white font-mono">{value}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${dot} shadow-sm`} />
            </div>

            {/* Mini sparkline */}
            <div className="h-[44px] rounded-xl bg-[#0d0d0f] border border-white/5 px-2 py-2 mb-4 overflow-hidden">
                <div className="flex h-full items-end gap-[3px]">
                    {bars.map((h, i) => (
                        <div
                            key={i}
                            className={`flex-1 rounded-full ${bar}`}
                            style={{ height: `${h}px`, opacity: i > 14 ? 1 : 0.55 }}
                        />
                    ))}
                </div>
            </div>

            {/* Footer */}
            {footerStats ? (
                <div className="grid grid-cols-2 gap-y-2.5">
                    {footerStats.map(([a, b]) => (
                        <div key={`${a}-${b}`} className="flex items-end gap-1.5">
                            <span className="text-[18px] font-light text-white font-mono">{a}</span>
                            <span className="text-[10px] text-gray-500 pb-0.5">{b}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center justify-between text-[11px] text-gray-500 mt-auto">
                    <span className="bg-[#18181B] border border-white/5 px-2 py-0.5 rounded-md">{footerLeft}</span>
                    <span className="bg-[#18181B] border border-white/5 px-2 py-0.5 rounded-md">{footerRight}</span>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Chat message bubble
// ─────────────────────────────────────────────────────────────────────────────

const ChatBubble: React.FC<{ msg: ChatMsg }> = ({ msg }) => {
    const isAI = msg.role === "ai";
    return (
        <div className={`flex ${isAI ? "justify-start" : "justify-end"} gap-2`}>
            {isAI && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#A3E635] flex items-center justify-center text-black shrink-0 mt-1">
                    <Sparkles size={12} />
                </div>
            )}
            <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${isAI
                    ? "bg-[#18181B] border border-white/5 text-gray-300"
                    : "bg-[#8B5CF6]/20 border border-[#8B5CF6]/25 text-gray-200"
                }`}>
                <p>{msg.text}</p>
                <p className="text-[9px] text-gray-600 mt-1.5 text-right">{msg.time}</p>
            </div>
            {!isAI && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#A3E635]/30 to-[#8B5CF6]/30 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-1">
                    U
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    AI Panel  (right column)
// ─────────────────────────────────────────────────────────────────────────────

const AIPanel: React.FC = () => {
    const [msgs, setMsgs] = useState<ChatMsg[]>(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [activeModel, setActiveModel] = useState("gpt4o");
    const [thinking, setThinking] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const now = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

    const sendMsg = async (text: string) => {
        if (!text.trim()) return;
        const userMsg: ChatMsg = { id: Date.now(), role: "user", text, time: now() };
        setMsgs(prev => [...prev, userMsg]);
        setInput("");
        setThinking(true);

        // Simulate AI reply (replace with real API call)
        await new Promise(r => setTimeout(r, 1200));
        const replies: Record<string, string> = {
            default: "I'm analysing your books now. Based on current data, everything looks healthy. Want a detailed breakdown?",
        };
        const key = text.toLowerCase().includes("cash") ? "cash"
            : text.toLowerCase().includes("invoice") ? "invoice"
                : "default";
        const replyText = key === "cash"
            ? "Current runway: 2.4 months. Monthly burn: ~$48,200. Top spend: AWS ($3,420), Deel payroll ($18,500). Recommend cutting non-essential SaaS."
            : key === "invoice"
                ? "2 overdue invoices totalling $38,700. Acme Corp is 8 days late. Want me to auto-send payment reminders?"
                : replies.default;

        setMsgs(prev => [...prev, { id: Date.now() + 1, role: "ai", text: replyText, time: now() }]);
        setThinking(false);
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [msgs, thinking]);

    return (
        <div className="bg-[#131316] border border-white/5 rounded-[24px] flex flex-col h-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
            {/* Panel header */}
            <div className="px-5 pt-5 pb-4 border-b border-white/5 bg-[#18181B] shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#A3E635] flex items-center justify-center shadow-lg">
                            <Sparkles size={14} className="text-black" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white leading-none">Rings AI</p>
                            <p className="text-[10px] text-[#A3E635] mt-0.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635] animate-pulse inline-block" />
                                Active · Financial OS Brain
                            </p>
                        </div>
                    </div>
                    <button className="w-7 h-7 rounded-lg bg-[#27272A] flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                        <RefreshCw size={13} />
                    </button>
                </div>

                {/* Capabilities strip */}
                <div className="flex flex-wrap gap-1.5">
                    {["Books Review", "Anomaly Scan", "Invoice AI", "Bank Sync", "Tax Check"].map(cap => (
                        <span key={cap} className="text-[9px] font-semibold text-gray-500 bg-[#27272A] border border-white/5 px-2 py-0.5 rounded-full">
                            {cap}
                        </span>
                    ))}
                </div>
            </div>

            {/* Chat thread */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: "none" }}>
                {msgs.map(m => <ChatBubble key={m.id} msg={m} />)}
                {thinking && (
                    <div className="flex justify-start gap-2">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#A3E635] flex items-center justify-center text-black shrink-0 mt-1">
                            <Sparkles size={12} />
                        </div>
                        <div className="bg-[#18181B] border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                            {[0.15, 0.3, 0.45].map(d => (
                                <div key={d} className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: `${d}s` }} />
                            ))}
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-4 py-2 flex gap-1.5 flex-wrap shrink-0">
                {QUICK_PROMPTS.map(p => (
                    <button
                        key={p}
                        onClick={() => sendMsg(p)}
                        className="text-[9px] font-medium text-gray-400 bg-[#18181B] border border-white/5 px-2.5 py-1 rounded-full hover:border-[#8B5CF6]/40 hover:text-[#8B5CF6] transition-colors"
                    >
                        {p}
                    </button>
                ))}
            </div>

            {/* Input area */}
            <div className="px-4 pb-4 shrink-0">
                <div className="bg-[#18181B] border border-white/8 rounded-2xl p-3 space-y-3">
                    {/* Model selector */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {MODELS.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setActiveModel(m.id)}
                                className={`flex items-center gap-1 text-[9px] font-semibold px-2.5 py-1.5 rounded-full transition-all ${activeModel === m.id
                                        ? "bg-[#27272A] text-white border border-white/15 shadow-sm"
                                        : "text-gray-500 hover:text-gray-300"
                                    }`}
                            >
                                {m.icon} {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Input row */}
                    <div className="flex items-center gap-2 bg-[#09090B] rounded-xl px-3 py-2.5 border border-white/5">
                        <button className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
                            <Paperclip size={13} />
                        </button>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMsg(input)}
                            placeholder="Ask Rings AI anything about your books…"
                            className="flex-1 bg-transparent text-xs text-gray-300 outline-none placeholder:text-gray-600"
                        />
                        <button
                            onClick={() => sendMsg(input)}
                            disabled={!input.trim() || thinking}
                            className="w-7 h-7 rounded-lg bg-[#A3E635] flex items-center justify-center text-black shrink-0 hover:bg-[#bef264] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Send size={11} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Surface cards (Receipts, Invoices, Bank, Books)
// ─────────────────────────────────────────────────────────────────────────────

const SURFACES = [
    { label: "Receipts", score: 92, color: "#A3E635", status: "All clear" },
    { label: "Invoices", score: 78, color: "#8B5CF6", status: "2 overdue" },
    { label: "Bank Sync", score: 99, color: "#A3E635", status: "Synced" },
    { label: "Books", score: 85, color: "#A3E635", status: "Sep closed" },
    { label: "Tax", score: 64, color: "amber", status: "3 items" },
];

// ─────────────────────────────────────────────────────────────────────────────
//    Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AICompanionPage() {
    return (
        <div
            className="relative flex-1 min-h-full bg-[#09090B] overflow-y-auto"
            style={{ fontFamily: "'Inter', sans-serif", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
        >
            {/* Subtle mesh gradients */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-80px] right-[-80px] w-[500px] h-[500px] rounded-full bg-[#8B5CF6]/6 blur-[100px]" />
                <div className="absolute top-[60px] left-[-60px] w-[400px] h-[400px] rounded-full bg-[#A3E635]/4 blur-[80px]" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#8B5CF6]/4 blur-[120px]" />
            </div>

            {/* Glass orb hero */}
            <GlassOrb />

            <div className="relative z-10 px-6 py-6 max-w-[1600px] mx-auto">

                {/* ── Header ── */}
                <div className="mb-8 relative z-10">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">AI-Powered Financial OS</p>
                    <h1 className="text-5xl font-light tracking-[-0.03em] text-white mb-1">
                        Rings <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#A3E635]">AI Companion</span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">Your autonomous bookkeeping intelligence — reconciling, categorising, and surfacing insights in real time.</p>

                    {/* Hero band: surface health pills */}
                    <div className="mt-6 flex items-center gap-2 flex-wrap">
                        {SURFACES.map(s => (
                            <div key={s.label} className="flex items-center gap-2 bg-[#131316] border border-white/5 px-3 py-2 rounded-xl hover:border-white/10 cursor-pointer transition-colors group">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color === "amber" ? "#f59e0b" : s.color }} />
                                <div>
                                    <p className="text-[11px] font-semibold text-white group-hover:text-gray-200">{s.label}</p>
                                    <p className="text-[9px] text-gray-500">{s.status}</p>
                                </div>
                                <span className="text-[10px] font-mono font-bold ml-1" style={{ color: s.color === "amber" ? "#f59e0b" : s.color }}>{s.score}</span>
                                <ChevronRight size={10} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                            </div>
                        ))}
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="flex items-center gap-1.5 text-[11px] text-[#A3E635] font-semibold bg-[#A3E635]/8 border border-[#A3E635]/20 px-3 py-1.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635] animate-pulse inline-block" />
                                Live · Monitoring
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Main grid: 8/12 metrics + 4/12 AI panel ── */}
                <div className="grid grid-cols-12 gap-5">

                    {/* Left: metric cards */}
                    <div className="col-span-12 xl:col-span-8 space-y-5">

                        {/* Row 1: 3 compact cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            {METRIC_CARDS.slice(0, 3).map(card => (
                                <MetricCard key={card.title} {...card} />
                            ))}
                        </div>

                        {/* Row 2: 2 large cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {METRIC_CARDS.slice(3).map(card => (
                                <MetricCard key={card.title} {...card} large />
                            ))}
                        </div>

                        {/* Row 3: Recent AI actions */}
                        <div className="bg-[#131316] border border-white/5 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Recent AI Actions</h3>
                                <button className="text-[10px] font-semibold text-[#8B5CF6] hover:text-[#a78bfa] transition-colors">View all</button>
                            </div>
                            <div className="space-y-2">
                                {[
                                    { action: "Categorised 12 bank transactions", surface: "Bank Sync", time: "2 min ago", ok: true },
                                    { action: "Flagged $96 Notion duplicate expense", surface: "Expenses", time: "14 min ago", ok: false },
                                    { action: "Sent payment reminder — Acme Corp", surface: "Invoices", time: "1 hr ago", ok: true },
                                    { action: "Reconciled April statement (Chase)", surface: "Bank", time: "3 hr ago", ok: true },
                                    { action: "Detected anomaly: $3,420 AWS spike", surface: "Books", time: "Yesterday", ok: false },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 group cursor-pointer hover:bg-[#18181B] -mx-3 px-3 rounded-xl transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.ok ? "bg-[#A3E635]" : "bg-[#F87171]"}`} />
                                            <div>
                                                <p className="text-xs font-medium text-gray-300">{item.action}</p>
                                                <p className="text-[10px] text-gray-600">{item.surface}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-gray-600">{item.time}</span>
                                            <ChevronRight size={12} className="text-gray-700 group-hover:text-gray-400 transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: AI Chat Panel */}
                    <div className="col-span-12 xl:col-span-4" style={{ minHeight: "700px" }}>
                        <div className="sticky top-4 h-[calc(100vh-180px)] min-h-[650px]">
                            <AIPanel />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
