import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Landmark, Plus, Trash2, ChevronDown, ArrowRight,
  CheckCircle2, Upload, Zap, Shield, AlertCircle,
  CreditCard, Building2, Wallet,
} from "lucide-react";
import { navigateToCustomerHref } from "../routing/customerNavigation";

// ─── Types ───────────────────────────────────────────────────────────────────

type BankAccountRow = {
  id: string;
  accountName: string;
  helperText?: string;
  bankLabel: string;
  openingBalance: string;
  currency: string;
  type: "checking" | "savings" | "credit" | "cash";
};

const CURRENCY_OPTIONS = ["USD", "CAD", "EUR", "GBP", "AUD"];
const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking / Operating" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Corporate Card / Credit" },
  { value: "cash", label: "Petty Cash" },
];

function makeId() {
  return Math.random().toString(36).slice(2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ChecklistItem: React.FC<{ done: boolean; text: string }> = ({ done, text }) => (
  <li className="flex items-start gap-2.5">
    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${done
      ? "bg-[#A3E635] border-[#A3E635]"
      : "border-white/20"
      }`}>
      {done && (
        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
          <path d="M1 4L3.5 6.5 9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
    <span className={`text-xs leading-relaxed ${done ? "text-gray-300" : "text-gray-500"}`}>{text}</span>
  </li>
);

interface AccountRowProps {
  row: BankAccountRow;
  index: number;
  onChange: (patch: Partial<BankAccountRow>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const AccountRowForm: React.FC<AccountRowProps> = ({ row, index, onChange, onRemove, canRemove }) => {
  const TypeIcon = row.type === "credit" ? CreditCard : row.type === "savings" ? Wallet : Building2;
  return (
    <div className="bg-[#18181B] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#27272A] border border-white/10 flex items-center justify-center">
            <TypeIcon size={14} className="text-gray-400" />
          </div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Account {index + 1}
          </span>
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-600 hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Bank label */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Institution / Label
          </label>
          <input
            type="text"
            placeholder="e.g. Chase Operating *4432"
            value={row.bankLabel}
            onChange={e => onChange({ bankLabel: e.target.value })}
            className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-600 transition-colors"
          />
        </div>

        {/* Account type */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Account Type
          </label>
          <div className="relative">
            <select
              value={row.type}
              onChange={e => onChange({ type: e.target.value as BankAccountRow["type"] })}
              className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer transition-colors"
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        </div>

        {/* Opening balance */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Opening Balance
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={row.openingBalance}
              onChange={e => onChange({ openingBalance: e.target.value })}
              placeholder="0.00"
              className="w-full bg-[#09090B] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono focus:border-[#8B5CF6] outline-none placeholder:text-gray-600 transition-colors text-right"
            />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">Match your last bank statement balance</p>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Currency
          </label>
          <div className="relative">
            <select
              value={row.currency}
              onChange={e => onChange({ currency: e.target.value })}
              className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer transition-colors"
            >
              {CURRENCY_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Connection Mode Card ─────────────────────────────────────────────────────
const ConnectionModeCard: React.FC<{
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeStyle?: string;
  description: string;
  disabled?: boolean;
  detail?: React.ReactNode;
}> = ({ selected, onClick, icon, title, badge, badgeStyle, description, disabled, detail }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`w-full text-left flex items-start gap-4 p-4 rounded-2xl border transition-all ${disabled
      ? "border-white/5 opacity-40 cursor-not-allowed"
      : selected
        ? "border-[#A3E635]/40 bg-[#A3E635]/5 shadow-sm shadow-[#A3E635]/5"
        : "border-white/5 hover:border-white/15 bg-[#18181B]"
      }`}
  >
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${selected ? "bg-[#A3E635]/15 border-[#A3E635]/30 text-[#A3E635]" : "bg-[#27272A] border-white/10 text-gray-500"}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-sm font-semibold ${selected ? "text-white" : "text-gray-300"}`}>{title}</span>
        {badge && (
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${badgeStyle}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      {selected && detail && <div className="mt-3">{detail}</div>}
    </div>
    <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-all ${selected ? "border-[#A3E635] bg-[#A3E635]" : "border-white/20"}`}>
      {selected && <div className="w-1.5 h-1.5 rounded-full bg-black mx-auto my-auto translate-y-[2px]" />}
    </div>
  </button>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BankSetupPage({ skipUrl }: { skipUrl?: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BankAccountRow[]>([
    {
      id: makeId(),
      accountName: "1000 · Cash (Main)",
      helperText: "Your primary operating account.",
      bankLabel: "",
      openingBalance: "0",
      currency: "USD",
      type: "checking",
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionMode, setConnectionMode] = useState<"manual" | "live">("manual");

  const firstRow = useMemo(() => rows[0], [rows]);

  function addRow() {
    setRows(prev => [
      ...prev,
      {
        id: makeId(),
        accountName: "New bank account",
        helperText: "Additional bank or cash account.",
        bankLabel: "",
        openingBalance: "0",
        currency: firstRow?.currency || "USD",
        type: "checking",
      },
    ]);
  }

  function updateRow(id: string, patch: Partial<BankAccountRow>) {
    setRows(prev => prev.map(row => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const csrfToken = document.querySelector<HTMLInputElement>("[name=csrfmiddlewaretoken]")?.value;
      const res = await fetch("/api/bank/setup/save/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken || "" },
        body: JSON.stringify({ accounts: rows }),
      });
      if (!res.ok) throw new Error("Failed to save bank setup");
      navigateToCustomerHref(navigate, "/bank-accounts");
    } catch (err) {
      console.error(err);
      navigateToCustomerHref(navigate, "/bank-accounts");
    } finally {
      setIsSaving(false);
    }
  }

  const ALLOWED_SKIP_DESTINATIONS = ["/workspace/", "/dashboard/", "/", "/invoices/", "/expenses/", "/banking/", "/bank-accounts"];

  async function handleSkip() {
    setIsSaving(true);
    try {
      const csrfToken = document.querySelector<HTMLInputElement>("[name=csrfmiddlewaretoken]")?.value;
      const res = await fetch("/api/bank/setup/skip/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken || "" },
      });
      if (!res.ok) throw new Error("Failed to skip");
      const defaultUrl = "/dashboard";
      const targetUrl = ALLOWED_SKIP_DESTINATIONS.includes(skipUrl || "") ? skipUrl! : defaultUrl;
      navigateToCustomerHref(navigate, targetUrl);
    } catch (err) {
      console.error(err);
      navigateToCustomerHref(navigate, "/dashboard");
    } finally {
      setIsSaving(false);
    }
  }

  // Checklist state
  const hasLabel = rows.some(r => r.bankLabel.trim().length > 0);
  const hasBalance = rows.some(r => parseFloat(r.openingBalance) > 0);
  const hasMultiple = rows.length > 1;

  return (
    <div
      className="flex-1 flex flex-col min-h-full px-6 py-6 bg-[#09090B] overflow-y-auto"
      style={{ fontFamily: "'Inter', sans-serif", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Bank Accounts</p>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">·</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#A3E635]">Setup</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Connect your bank accounts.
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">
            Tell us which accounts to track. You can always add more later.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {["Connect", "Import", "Reconcile"].map((step, i) => (
            <React.Fragment key={step}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold ${i === 0
                ? "bg-[#A3E635]/10 border-[#A3E635]/30 text-[#A3E635]"
                : "bg-[#18181B] border-white/10 text-gray-600"
                }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${i === 0 ? "bg-[#A3E635] text-black" : "bg-[#27272A] text-gray-500"}`}>
                  {i === 0 ? "1" : i + 1}
                </span>
                {step}
              </div>
              {i < 2 && <ArrowRight size={12} className="text-gray-700 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-5">

        {/* Left: Main setup */}
        <div className="space-y-5">

          {/* Connection Mode */}
          <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Connection Mode</p>
            <p className="text-sm text-gray-300 font-medium mb-4">How should Clover Books receive transaction data?</p>

            <div className="space-y-3">
              <ConnectionModeCard
                selected={connectionMode === "manual"}
                onClick={() => setConnectionMode("manual")}
                icon={<Upload size={15} />}
                title="Manual Import"
                badge="Recommended"
                badgeStyle="bg-[#A3E635]/15 text-[#A3E635] border border-[#A3E635]/20"
                description="Upload monthly CSV or PDF statements. Clean, auditable, no bank credentials required."
                detail={
                  <div className="bg-[#09090B] border border-white/5 rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-gray-400">How it works</p>
                    <ol className="space-y-1.5 text-[11px] text-gray-500 list-none">
                      {["Map your bank accounts below", "Save setup and go to Bank Accounts", "Upload your first CSV statement to start matching"].map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-[#27272A] text-gray-500 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                }
              />

              <ConnectionModeCard
                selected={connectionMode === "live"}
                onClick={() => { }}
                disabled
                icon={<Zap size={15} />}
                title="Live Bank Feed"
                badge="Coming Soon"
                badgeStyle="bg-[#27272A] text-gray-500"
                description="Connect directly to your bank and stream transactions automatically into your inbox."
              />
            </div>
          </div>

          {/* Account Rows */}
          <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-0.5">Bank Accounts</p>
                <p className="text-sm text-gray-300 font-medium">Which accounts should we track?</p>
              </div>
              <span className="text-[10px] text-gray-600 font-medium">{rows.length} {rows.length === 1 ? "account" : "accounts"}</span>
            </div>

            <div className="space-y-3">
              {rows.map((row, i) => (
                <AccountRowForm
                  key={row.id}
                  row={row}
                  index={i}
                  onChange={patch => updateRow(row.id, patch)}
                  onRemove={() => removeRow(row.id)}
                  canRemove={rows.length > 1}
                />
              ))}

              <button
                onClick={addRow}
                className="w-full py-3 border border-dashed border-white/10 rounded-2xl text-xs text-gray-500 hover:border-[#8B5CF6]/40 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={13} />
                Add another account or corporate card
              </button>
            </div>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">

          {/* Checklist */}
          <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-xl bg-[#A3E635]/10 border border-[#A3E635]/20 flex items-center justify-center">
                <Shield size={13} className="text-[#A3E635]" />
              </div>
              <p className="text-sm font-semibold text-white">Readiness Checklist</p>
            </div>
            <ul className="space-y-3">
              <ChecklistItem done={rows.length > 0} text="At least one bank account mapped" />
              <ChecklistItem done={hasLabel} text="Bank label filled in for main account" />
              <ChecklistItem done={hasBalance} text="Opening balance set from last statement" />
              <ChecklistItem done text="Accounting year start configured in settings" />
            </ul>
          </div>

          {/* How it works */}
          <div className="bg-[#131316] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/5 to-transparent pointer-events-none rounded-2xl" />
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 flex items-center justify-center">
                <Landmark size={13} className="text-[#8B5CF6]" />
              </div>
              <p className="text-sm font-semibold text-white">Why this matters</p>
            </div>
            <ul className="space-y-2.5 text-xs text-gray-400 leading-relaxed">
              {[
                "Your opening balance anchors the reconciliation timeline — get it right and every import auto-calculates.",
                "Corporate cards are tracked as credit-type accounts. Transactions flow into the same inbox.",
                "You can add foreign-currency accounts — each reconciles in its own currency.",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6] shrink-0 mt-1.5" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-[#A3E635] text-black text-sm font-bold py-3 rounded-2xl hover:bg-[#b8f040] disabled:opacity-40 transition-all shadow-lg shadow-[#A3E635]/10 active:scale-[0.99]"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  Save & Go to Bank Accounts
                </>
              )}
            </button>

            <button
              onClick={handleSkip}
              disabled={isSaving}
              className="w-full py-2.5 rounded-2xl border border-white/10 text-xs font-medium text-gray-500 hover:text-gray-300 hover:border-white/20 disabled:opacity-40 transition-colors text-center"
            >
              Skip for now · I'll set this up later
            </button>
          </div>

          {/* Note */}
          <div className="flex items-start gap-2.5 p-3 bg-[#18181B] border border-white/5 rounded-xl">
            <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-500 leading-relaxed">
              You can add more accounts anytime from <span className="text-gray-400 font-medium">Bank Accounts → Connect Bank</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
