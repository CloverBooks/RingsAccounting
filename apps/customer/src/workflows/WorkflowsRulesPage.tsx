import React, { useState, useMemo } from "react";
import {
    Plus, Search, Filter, MoreHorizontal, ChevronDown, X, Sparkles,
    User, Zap, ArrowRight, Clock, CheckCircle2, AlertCircle, ToggleLeft,
    ToggleRight, Copy, Trash2, Edit3, ChevronRight, Play, Pause,
    GitBranch, Bell, Mail, FileText, RefreshCw, Tag,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//    Types
// ─────────────────────────────────────────────────────────────────────────────

type Creator = "ai" | "manual";
type RuleStatus = "active" | "inactive";
type AppliesTo = "money_out" | "money_in" | "all";

interface Condition {
    field: "description" | "amount" | "vendor" | "category" | "account";
    op: "contains" | "is" | "greater_than" | "less_than";
    value: string;
}

interface Rule {
    id: string;
    name: string;
    conditions: Condition[];
    action_category: string;
    action_payee?: string;
    action_gl?: string;
    applies_to: AppliesTo;
    account: string;
    auto_add: boolean;
    status: RuleStatus;
    creator: Creator;
    created_by_name: string;
    last_run?: string;
    matches: number;
    priority: number;
}

interface WorkflowStep {
    type: "trigger" | "condition" | "action" | "delay";
    label: string;
    detail?: string;
}

interface Workflow {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    status: RuleStatus;
    creator: Creator;
    created_by_name: string;
    last_triggered?: string;
    runs: number;
    trigger_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//    Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_RULES: Rule[] = [
    {
        id: "r1", priority: 1,
        name: "AWS → Software & Hosting",
        conditions: [{ field: "vendor", op: "contains", value: "Amazon Web Services" }],
        action_category: "Software & Hosting", action_gl: "6010",
        applies_to: "money_out", account: "Chase Operating",
        auto_add: true, status: "active",
        creator: "ai", created_by_name: "Rings AI",
        last_run: "Apr 24", matches: 18,
    },
    {
        id: "r2", priority: 2,
        name: "Stripe Deposits → Revenue",
        conditions: [
            { field: "vendor", op: "contains", value: "Stripe" },
            { field: "amount", op: "greater_than", value: "100" },
        ],
        action_category: "Revenue", action_gl: "4000",
        applies_to: "money_in", account: "Chase Operating",
        auto_add: true, status: "active",
        creator: "ai", created_by_name: "Rings AI",
        last_run: "Apr 23", matches: 34,
    },
    {
        id: "r3", priority: 3,
        name: "Payroll → Salaries",
        conditions: [{ field: "description", op: "contains", value: "Deel" }],
        action_category: "Payroll", action_gl: "6500",
        applies_to: "money_out", account: "All Accounts",
        auto_add: false, status: "active",
        creator: "manual", created_by_name: "You",
        last_run: "Apr 15", matches: 4,
    },
    {
        id: "r4", priority: 4,
        name: "Uber / Lyft → Travel",
        conditions: [
            { field: "vendor", op: "contains", value: "Uber" },
        ],
        action_category: "Travel & Entertainment", action_gl: "6200",
        applies_to: "money_out", account: "Ramp Virtual",
        auto_add: false, status: "active",
        creator: "ai", created_by_name: "Rings AI",
        last_run: "Apr 20", matches: 7,
    },
    {
        id: "r5", priority: 5,
        name: "Figma → Design Tools",
        conditions: [{ field: "vendor", op: "is", value: "Figma" }],
        action_category: "Design Tools", action_gl: "6010",
        applies_to: "money_out", account: "Corporate Card",
        auto_add: true, status: "active",
        creator: "manual", created_by_name: "You",
        last_run: "Apr 23", matches: 2,
    },
    {
        id: "r6", priority: 6,
        name: "Large outflows > $5k → Flag",
        conditions: [{ field: "amount", op: "greater_than", value: "5000" }],
        action_category: "Needs Review", action_gl: "",
        applies_to: "money_out", account: "All Accounts",
        auto_add: false, status: "active",
        creator: "manual", created_by_name: "You",
        last_run: "Apr 18", matches: 3,
    },
    {
        id: "r7", priority: 7,
        name: "SaaS < $50 → Auto-approve",
        conditions: [
            { field: "category", op: "is", value: "Software" },
            { field: "amount", op: "less_than", value: "50" },
        ],
        action_category: "Software & Hosting", action_gl: "6010",
        applies_to: "money_out", account: "Ramp Virtual",
        auto_add: true, status: "inactive",
        creator: "ai", created_by_name: "Rings AI",
        last_run: "Mar 12", matches: 11,
    },
    {
        id: "r8", priority: 8,
        name: "WeWork / Coworking → Office",
        conditions: [{ field: "description", op: "contains", value: "WeWork" }],
        action_category: "Office & Facilities", action_gl: "6300",
        applies_to: "money_out", account: "Wise EUR",
        auto_add: false, status: "active",
        creator: "manual", created_by_name: "You",
        last_run: "Apr 15", matches: 1,
    },
];

const MOCK_WORKFLOWS: Workflow[] = [
    {
        id: "w1",
        name: "Invoice Payment Reminder",
        description: "Automatically send a payment reminder 3 days after invoice due date if still unpaid.",
        steps: [
            { type: "trigger", label: "Invoice Overdue", detail: "Past due date by 3+ days" },
            { type: "condition", label: "Status is Unpaid", detail: "Invoice.status = SENT" },
            { type: "action", label: "Send Email Reminder", detail: "To invoice.customer_email" },
            { type: "delay", label: "Wait 5 days", detail: "If still no payment" },
            { type: "action", label: "Flag in Inbox & Triage", detail: "High priority" },
        ],
        status: "active", creator: "manual", created_by_name: "You",
        last_triggered: "Apr 23", runs: 14, trigger_count: 14,
    },
    {
        id: "w2",
        name: "Month-End Close Checklist",
        description: "AI-guided month-end close: reconcile all accounts, generate P&L, flag uncategorised transactions.",
        steps: [
            { type: "trigger", label: "Last Day of Month", detail: "Scheduled: 28th of each month" },
            { type: "action", label: "Reconcile Bank Accounts", detail: "Chase, Wise, Ramp" },
            { type: "condition", label: "All Txns Categorised?", detail: "Uncategorised = 0" },
            { type: "action", label: "Generate P&L Report", detail: "Email to finance@" },
            { type: "action", label: "Notify AI Companion", detail: "Summary to Inbox" },
        ],
        status: "active", creator: "ai", created_by_name: "Rings AI",
        last_triggered: "Mar 31", runs: 3, trigger_count: 3,
    },
    {
        id: "w3",
        name: "High-Risk Transaction Alert",
        description: "Flag and hold any transaction over $10,000 for manual review before auto-categorising.",
        steps: [
            { type: "trigger", label: "New Bank Transaction", detail: "Amount > $10,000" },
            { type: "action", label: "Hold Auto-Categorise", detail: "Bypass all rules" },
            { type: "action", label: "Add to Review Queue", detail: "Inbox & Triage → High" },
            { type: "action", label: "Notify Founder", detail: "Push + email alert" },
        ],
        status: "active", creator: "ai", created_by_name: "Rings AI",
        last_triggered: "Apr 18", runs: 2, trigger_count: 2,
    },
    {
        id: "w4",
        name: "Missing Receipt Chase",
        description: "7 days after an expense is logged without a receipt, send a Slack/email reminder.",
        steps: [
            { type: "trigger", label: "Expense Without Receipt", detail: "receipt = false" },
            { type: "delay", label: "Wait 7 days", detail: "Grace period" },
            { type: "condition", label: "Still No Receipt?", detail: "receipt = false" },
            { type: "action", label: "Send Receipt Reminder", detail: "To submitted_by email" },
        ],
        status: "inactive", creator: "manual", created_by_name: "You",
        last_triggered: "Mar 8", runs: 5, trigger_count: 5,
    },
];

// ─────────────────────────────────────────────────────────────────────────────
//    Lookup tables
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "Software & Hosting": { bg: "bg-[#8B5CF6]/15", text: "text-[#a78bfa]", border: "border-[#8B5CF6]/30" },
    "Revenue": { bg: "bg-[#A3E635]/15", text: "text-[#A3E635]", border: "border-[#A3E635]/30" },
    "Payroll": { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
    "Travel & Entertainment": { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
    "Design Tools": { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30" },
    "Needs Review": { bg: "bg-[#F87171]/15", text: "text-[#F87171]", border: "border-[#F87171]/30" },
    "Office & Facilities": { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/30" },
    "Meals & Entertainment": { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
};

const getTagStyle = (cat: string) => CATEGORY_COLORS[cat] ?? { bg: "bg-[#27272A]", text: "text-gray-400", border: "border-white/10" };

const FIELD_LABELS: Record<string, string> = {
    description: "Description", amount: "Amount", vendor: "Vendor",
    category: "Category", account: "Account",
};

const OP_LABELS: Record<string, string> = {
    contains: "contains", is: "is exactly", greater_than: ">", less_than: "<",
};

const STEP_ICONS: Record<WorkflowStep["type"], React.ReactNode> = {
    trigger: <Zap size={11} className="text-[#A3E635]" />,
    condition: <GitBranch size={11} className="text-amber-400" />,
    action: <Play size={11} className="text-[#8B5CF6]" />,
    delay: <Clock size={11} className="text-gray-400" />,
};

const STEP_COLORS: Record<WorkflowStep["type"], string> = {
    trigger: "border-[#A3E635]/30 bg-[#A3E635]/8",
    condition: "border-amber-400/30 bg-amber-400/8",
    action: "border-[#8B5CF6]/30 bg-[#8B5CF6]/8",
    delay: "border-white/10 bg-white/3",
};

// ─────────────────────────────────────────────────────────────────────────────
//    CreatorBadge
// ─────────────────────────────────────────────────────────────────────────────

const CreatorBadge: React.FC<{ creator: Creator; name: string }> = ({ creator, name }) => (
    creator === "ai" ? (
        <span className="flex items-center gap-1 text-[9px] font-bold text-[#A3E635] bg-[#A3E635]/10 border border-[#A3E635]/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            <Sparkles size={8} /> {name}
        </span>
    ) : (
        <span className="flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-[#27272A] border border-white/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            <User size={8} /> {name}
        </span>
    )
);

// ─────────────────────────────────────────────────────────────────────────────
//    ConditionPills
// ─────────────────────────────────────────────────────────────────────────────

const ConditionPills: React.FC<{ conditions: Condition[] }> = ({ conditions }) => (
    <div className="flex flex-wrap gap-1">
        {conditions.map((c, i) => (
            <span key={i} className="text-[9px] font-medium text-gray-300 bg-[#18181B] border border-white/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                {FIELD_LABELS[c.field]} {OP_LABELS[c.op]}{" "}
                <span className="text-white font-semibold">"{c.value}"</span>
            </span>
        ))}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Add Rule Drawer
// ─────────────────────────────────────────────────────────────────────────────

interface DrawerProps { onClose: () => void; type: "rule" | "workflow"; }

const AddDrawer: React.FC<DrawerProps> = ({ onClose, type }) => {
    const [name, setName] = useState("");
    const [condField, setCondField] = useState("vendor");
    const [condOp, setCondOp] = useState("contains");
    const [condVal, setCondVal] = useState("");
    const [actionCat, setActionCat] = useState("Software & Hosting");
    const [appliesTo, setAppliesTo] = useState("money_out");
    const [autoAdd, setAutoAdd] = useState(false);

    const selClass = "w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer";

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#131316] border-l border-white/10 w-full sm:w-[420px] h-full flex flex-col shadow-2xl" style={{ fontFamily: "'Inter', sans-serif" }}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#18181B] shrink-0">
                    <div>
                        <p className="text-white font-semibold text-sm">
                            {type === "rule" ? "New Categorisation Rule" : "New Workflow"}
                        </p>
                        <p className="text-gray-500 text-[11px] mt-0.5">
                            {type === "rule" ? "Auto-categorise matching transactions" : "Build a multi-step automation"}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-md bg-[#27272A] flex items-center justify-center text-gray-500 hover:text-white">
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ scrollbarWidth: "none" }}>
                    {/* Name */}
                    <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                            {type === "rule" ? "Rule Name" : "Workflow Name"}
                        </label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder={type === "rule" ? "e.g. AWS → Software & Hosting" : "e.g. Invoice Reminder Flow"} className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-600" />
                    </div>

                    {type === "rule" ? (
                        <>
                            {/* Condition */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">When…</label>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <select value={condField} onChange={e => setCondField(e.target.value)} className={selClass}>
                                            <option value="vendor">Vendor / Merchant</option>
                                            <option value="description">Description / Memo</option>
                                            <option value="amount">Amount</option>
                                            <option value="category">Category</option>
                                            <option value="account">Account</option>
                                        </select>
                                        <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    </div>
                                    <div className="relative">
                                        <select value={condOp} onChange={e => setCondOp(e.target.value)} className={selClass}>
                                            <option value="contains">contains</option>
                                            <option value="is">is exactly</option>
                                            <option value="greater_than">is greater than</option>
                                            <option value="less_than">is less than</option>
                                        </select>
                                        <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    </div>
                                    <input value={condVal} onChange={e => setCondVal(e.target.value)} placeholder="Value…" className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-600" />
                                </div>
                            </div>

                            {/* Action */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Then assign to…</label>
                                <div className="relative">
                                    <select value={actionCat} onChange={e => setActionCat(e.target.value)} className={selClass}>
                                        {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            {/* Applies To */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Applies to</label>
                                <div className="flex gap-2">
                                    {[["money_out", "Money Out"], ["money_in", "Money In"], ["all", "All"]].map(([v, l]) => (
                                        <button key={v} onClick={() => setAppliesTo(v)} className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${appliesTo === v ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/15 text-[#a78bfa]" : "border-white/10 bg-[#18181B] text-gray-400 hover:text-gray-200"}`}>{l}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Auto-add */}
                            <div className="flex items-center justify-between bg-[#18181B] border border-white/5 rounded-xl px-4 py-3">
                                <div>
                                    <p className="text-sm text-white font-medium">Auto-Add</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">Skip review — apply rule automatically</p>
                                </div>
                                <button onClick={() => setAutoAdd(v => !v)}>
                                    {autoAdd
                                        ? <ToggleRight size={26} className="text-[#A3E635]" />
                                        : <ToggleLeft size={26} className="text-gray-600" />}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* Workflow builder — simplified trigger picker */
                        <>
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Trigger</label>
                                <div className="space-y-2">
                                    {[
                                        ["Invoice overdue", <Bell size={13} />],
                                        ["New bank transaction", <RefreshCw size={13} />],
                                        ["Expense submitted", <FileText size={13} />],
                                        ["Scheduled (monthly)", <Clock size={13} />],
                                    ].map(([label, icon]) => (
                                        <button key={String(label)} className="w-full flex items-center gap-3 bg-[#18181B] border border-white/10 hover:border-[#A3E635]/30 hover:bg-[#A3E635]/5 rounded-xl px-4 py-3 text-sm text-gray-300 transition-all text-left">
                                            <span className="text-gray-500">{icon as React.ReactNode}</span> {label as string}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-[#18181B] border border-white/5 rounded-xl px-4 py-3 text-center text-xs text-gray-500">
                                <Sparkles size={14} className="mx-auto mb-1 text-[#8B5CF6]" />
                                Let Rings AI suggest the full workflow based on your trigger
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-white/5 bg-[#18181B] shrink-0 flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-medium hover:bg-[#27272A] transition-colors">
                        Cancel
                    </button>
                    <button className="flex-1 py-2 rounded-lg bg-[#A3E635] text-black text-sm font-bold hover:bg-[#bef264] transition-colors shadow-sm flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={13} /> Create {type === "rule" ? "Rule" : "Workflow"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Rules Table
// ─────────────────────────────────────────────────────────────────────────────

const RulesTable: React.FC<{ rules: Rule[]; onToggle: (id: string) => void }> = ({ rules, onToggle }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
                <tr className="border-b border-white/5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-[#09090B]/50 sticky top-0 z-10">
                    <th className="py-3 px-4 w-6">#</th>
                    <th className="py-3 px-4">Rule Name</th>
                    <th className="py-3 px-4">Conditions</th>
                    <th className="py-3 px-4">Category / Action</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">Created By</th>
                    <th className="py-3 px-4 text-center w-20">Auto-Add</th>
                    <th className="py-3 px-4 text-center">Last Run</th>
                    <th className="py-3 px-4 text-center w-16">Hits</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 w-10" />
                </tr>
            </thead>
            <tbody>
                {rules.map(rule => {
                    const catStyle = getTagStyle(rule.action_category);
                    return (
                        <tr key={rule.id} className="border-b border-white/5 hover:bg-[#131316] transition-colors group cursor-pointer">
                            {/* Priority */}
                            <td className="py-3 px-4 text-gray-600 text-xs font-mono">{rule.priority}</td>

                            {/* Rule Name */}
                            <td className="py-3 px-4">
                                <p className="text-white text-sm font-medium">{rule.name}</p>
                                <p className="text-gray-600 text-[10px] mt-0.5">
                                    {rule.applies_to === "money_out" ? "↑ Money out" : rule.applies_to === "money_in" ? "↓ Money in" : "⇅ All"}
                                </p>
                            </td>

                            {/* Conditions */}
                            <td className="py-3 px-4 max-w-[240px]">
                                <ConditionPills conditions={rule.conditions} />
                            </td>

                            {/* Category Tag */}
                            <td className="py-3 px-4">
                                <div className="flex flex-col gap-1">
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border w-fit ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                                        <Tag size={8} /> {rule.action_category}
                                    </span>
                                    {rule.action_gl && (
                                        <span className="text-[9px] text-gray-600 font-mono">GL {rule.action_gl}</span>
                                    )}
                                </div>
                            </td>

                            {/* Account */}
                            <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{rule.account}</td>

                            {/* Creator */}
                            <td className="py-3 px-4">
                                <CreatorBadge creator={rule.creator} name={rule.created_by_name} />
                            </td>

                            {/* Auto-Add */}
                            <td className="py-3 px-4 text-center">
                                {rule.auto_add
                                    ? <ToggleRight size={20} className="text-[#A3E635] mx-auto" />
                                    : <ToggleLeft size={20} className="text-gray-600 mx-auto" />}
                            </td>

                            {/* Last Run */}
                            <td className="py-3 px-4 text-center text-gray-500 text-xs whitespace-nowrap">{rule.last_run ?? "—"}</td>

                            {/* Hits */}
                            <td className="py-3 px-4 text-center">
                                <span className="text-sm font-mono font-bold text-white">{rule.matches}</span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 text-center">
                                <button onClick={() => onToggle(rule.id)} className={`text-[9px] font-bold px-2 py-1 rounded-full border transition-colors ${rule.status === "active" ? "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20 hover:bg-[#A3E635]/20" : "text-gray-500 bg-[#18181B] border-white/10 hover:text-gray-300"}`}>
                                    {rule.status === "active" ? "Active" : "Inactive"}
                                </button>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1.5 rounded-md hover:bg-[#27272A] text-gray-500 hover:text-white transition-colors"><Edit3 size={12} /></button>
                                    <button className="p-1.5 rounded-md hover:bg-[#27272A] text-gray-500 hover:text-white transition-colors"><Copy size={12} /></button>
                                    <button className="p-1.5 rounded-md hover:bg-[#F87171]/10 text-gray-500 hover:text-[#F87171] transition-colors"><Trash2 size={12} /></button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Workflow Card
// ─────────────────────────────────────────────────────────────────────────────

const WorkflowCard: React.FC<{ wf: Workflow; onToggle: (id: string) => void }> = ({ wf, onToggle }) => (
    <div className="bg-[#131316] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors group">
        <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-white text-sm font-semibold leading-none">{wf.name}</h3>
                    <CreatorBadge creator={wf.creator} name={wf.created_by_name} />
                </div>
                <p className="text-gray-500 text-[11px] mt-1.5 leading-relaxed">{wf.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onToggle(wf.id)} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${wf.status === "active" ? "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20" : "text-gray-500 bg-[#18181B] border-white/10"}`}>
                    {wf.status === "active" ? <><span className="w-1.5 h-1.5 rounded-full bg-[#A3E635] inline-block mr-1 animate-pulse" />Active</> : "Inactive"}
                </button>
                <button className="p-1.5 rounded-md hover:bg-[#27272A] text-gray-500 hover:text-white transition-colors"><MoreHorizontal size={14} /></button>
            </div>
        </div>

        {/* Step chain */}
        <div className="flex items-center gap-1 flex-wrap mb-4">
            {wf.steps.map((step, i) => (
                <React.Fragment key={i}>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-medium text-gray-300 ${STEP_COLORS[step.type]}`}>
                        {STEP_ICONS[step.type]}
                        <span>{step.label}</span>
                    </div>
                    {i < wf.steps.length - 1 && <ChevronRight size={12} className="text-gray-600 shrink-0" />}
                </React.Fragment>
            ))}
        </div>

        {/* Footer stats */}
        <div className="flex items-center gap-4 pt-3 border-t border-white/5 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><Clock size={10} /> Last: {wf.last_triggered ?? "Never"}</span>
            <span className="flex items-center gap-1"><Zap size={10} /> {wf.runs} runs</span>
            <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="flex items-center gap-1 text-gray-400 hover:text-white px-2 py-1 bg-[#18181B] border border-white/5 rounded-md transition-colors"><Edit3 size={10} /> Edit</button>
                <button className="flex items-center gap-1 text-gray-400 hover:text-white px-2 py-1 bg-[#18181B] border border-white/5 rounded-md transition-colors"><Copy size={10} /> Duplicate</button>
                <button className="flex items-center gap-1 text-[#F87171]/70 hover:text-[#F87171] px-2 py-1 bg-[#18181B] border border-white/5 rounded-md transition-colors"><Trash2 size={10} /> Delete</button>
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function WorkflowsRulesPage() {
    const [activeTab, setActiveTab] = useState<"rules" | "workflows">("rules");
    const [search, setSearch] = useState("");
    const [creatorFilter, setCreatorFilter] = useState<"all" | "ai" | "manual">("all");
    const [rules, setRules] = useState<Rule[]>(MOCK_RULES);
    const [workflows, setWorkflows] = useState<Workflow[]>(MOCK_WORKFLOWS);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerType, setDrawerType] = useState<"rule" | "workflow">("rule");

    const filteredRules = useMemo(() => rules.filter(r => {
        if (creatorFilter !== "all" && r.creator !== creatorFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            return r.name.toLowerCase().includes(q) || r.action_category.toLowerCase().includes(q);
        }
        return true;
    }), [rules, search, creatorFilter]);

    const filteredWorkflows = useMemo(() => workflows.filter(w => {
        if (creatorFilter !== "all" && w.creator !== creatorFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            return w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q);
        }
        return true;
    }), [workflows, search, creatorFilter]);

    const toggleRule = (id: string) => setRules(prev => prev.map(r => r.id === id ? { ...r, status: r.status === "active" ? "inactive" : "active" } : r));
    const toggleWf = (id: string) => setWorkflows(prev => prev.map(w => w.id === id ? { ...w, status: w.status === "active" ? "inactive" : "active" } : w));

    const aiRules = rules.filter(r => r.creator === "ai").length;
    const aiWorkflows = workflows.filter(w => w.creator === "ai").length;
    const activeRules = rules.filter(r => r.status === "active").length;
    const totalHits = rules.reduce((s, r) => s + r.matches, 0);

    return (
        <div
            className="flex-1 flex flex-col min-h-full bg-[#09090B] overflow-y-auto"
            style={{ fontFamily: "'Inter', sans-serif", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
        >
            {/* ── Header ── */}
            <div className="px-6 pt-6 pb-0 border-b border-white/5">
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Workflows & Rules</h1>
                        <p className="text-sm text-gray-500 mt-1">Automate transaction categorisation, reminders, and multi-step financial processes</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setDrawerType("workflow"); setDrawerOpen(true); }}
                            className="h-8 flex items-center gap-1.5 px-3 bg-[#18181B] border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-[#27272A] transition-colors"
                        >
                            <GitBranch size={13} /> New Workflow
                        </button>
                        <button
                            onClick={() => { setDrawerType("rule"); setDrawerOpen(true); }}
                            className="h-8 flex items-center gap-1.5 px-4 bg-[#A3E635] rounded-lg text-xs text-black font-bold hover:bg-[#bef264] transition-colors shadow-sm"
                        >
                            <Plus size={13} /> Add Rule
                        </button>
                    </div>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                    {[
                        { label: "Active Rules", value: activeRules, sub: `of ${rules.length} total`, accent: "text-[#A3E635]" },
                        { label: "Total Matches", value: totalHits, sub: "transactions auto-tagged", accent: "text-white" },
                        { label: "AI-Generated", value: aiRules + aiWorkflows, sub: "rules & workflows by AI", accent: "text-[#8B5CF6]" },
                        { label: "Active Flows", value: workflows.filter(w => w.status === "active").length, sub: `of ${workflows.length} workflows`, accent: "text-amber-400" },
                    ].map(({ label, value, sub, accent }) => (
                        <div key={label} className="bg-[#131316] border border-white/5 rounded-xl px-4 py-3">
                            <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider mb-1">{label}</p>
                            <p className={`text-2xl font-bold font-mono ${accent}`}>{value}</p>
                            <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs + Filters */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-0">
                        {([["rules", "Rules", rules.length], ["workflows", "Workflows", workflows.length]] as const).map(([key, label, count]) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${activeTab === key ? "border-[#A3E635] text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}
                            >
                                {label}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${activeTab === key ? "bg-[#A3E635] text-black" : "bg-[#27272A] text-gray-400"}`}>{count}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 pb-2">
                        {/* Creator filter */}
                        <div className="flex items-center gap-1 bg-[#18181B] border border-white/5 rounded-lg p-1">
                            {([["all", "All"], ["ai", "AI Made"], ["manual", "Manual"]] as const).map(([v, l]) => (
                                <button key={v} onClick={() => setCreatorFilter(v)} className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-colors ${creatorFilter === v ? "bg-[#27272A] text-white" : "text-gray-500 hover:text-gray-300"}`}>
                                    {v === "ai" ? <span className="flex items-center gap-1"><Sparkles size={9} />{l}</span> : l}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${activeTab}…`} className="w-44 bg-[#18181B] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-600" />
                        </div>

                        <button className="h-[30px] flex items-center gap-1.5 px-3 bg-[#18181B] border border-white/10 rounded-lg text-[11px] text-gray-300 hover:bg-[#27272A] transition-colors">
                            <Filter size={11} /> Filter
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1">
                {activeTab === "rules" ? (
                    <div className="bg-[#131316] border-0">
                        {filteredRules.length === 0 ? (
                            <div className="py-16 flex flex-col items-center text-center text-gray-600 text-sm">
                                <Tag size={28} className="mb-2 opacity-30" />
                                No rules match your filters.
                            </div>
                        ) : (
                            <RulesTable rules={filteredRules} onToggle={toggleRule} />
                        )}
                    </div>
                ) : (
                    <div className="px-6 py-5 space-y-4">
                        {/* AI suggestion banner */}
                        <div className="flex items-center gap-3 bg-[#8B5CF6]/8 border border-[#8B5CF6]/20 rounded-xl px-4 py-3">
                            <Sparkles size={16} className="text-[#8B5CF6] shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm text-white font-medium">Rings AI can build workflows for you</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">Describe what you want to automate in the AI Companion chat and it will generate a workflow automatically.</p>
                            </div>
                            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8B5CF6] hover:text-[#a78bfa] whitespace-nowrap transition-colors">
                                Open AI Companion <ArrowRight size={12} />
                            </button>
                        </div>

                        {filteredWorkflows.length === 0 ? (
                            <div className="py-16 flex flex-col items-center text-center text-gray-600 text-sm">
                                <GitBranch size={28} className="mb-2 opacity-30" />
                                No workflows match your filters.
                            </div>
                        ) : (
                            filteredWorkflows.map(wf => <WorkflowCard key={wf.id} wf={wf} onToggle={toggleWf} />)
                        )}
                    </div>
                )}
            </div>

            {/* ── Add Rule / Workflow Drawer ── */}
            {drawerOpen && (
                <AddDrawer type={drawerType} onClose={() => setDrawerOpen(false)} />
            )}
        </div>
    );
}
