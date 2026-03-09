import React, { useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { useTaxProductRules, TaxProductRule } from "./useTaxProductRules";
import { useTaxSettings } from "./useTaxSettings";

type RuleForm = {
  jurisdiction_code: string;
  product_code: string;
  rule_type: TaxProductRule["ruleType"];
  special_rate?: number | null;
  valid_from: string;
  valid_to?: string | null;
  notes?: string;
};

const ruleTypeLabel: Record<string, string> = {
  TAXABLE: "Taxable",
  EXEMPT: "Exempt",
  ZERO_RATED: "Zero-rated",
  REDUCED: "Reduced",
};

const badgeClass = (ruleType: string) => {
  const map: Record<string, string> = {
    TAXABLE: "bg-[#27272A] text-gray-300 border border-white/10",
    EXEMPT: "bg-[#A3E635]/10 text-[#A3E635] border border-[#A3E635]/20",
    ZERO_RATED: "bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20",
    REDUCED: "bg-amber-400/10 text-amber-400 border border-amber-400/20",
  };
  return map[ruleType] || map.TAXABLE;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const TaxProductRulesPage: React.FC = () => {
  const { settings } = useTaxSettings();
  const [jurisdiction, setJurisdiction] = useState<string>("");
  const [productCode, setProductCode] = useState<string>("");
  const { rules, loading, error, refetch, createRule, updateRule, deleteRule } = useTaxProductRules({
    jurisdiction: jurisdiction || undefined,
    productCode: productCode || undefined,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaxProductRule | null>(null);
  const [form, setForm] = useState<RuleForm>({
    jurisdiction_code: "",
    product_code: "",
    rule_type: "TAXABLE",
    special_rate: null,
    valid_from: todayIso(),
    valid_to: null,
    notes: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const jurisdictionOptions = useMemo(() => {
    const nexus = settings?.default_nexus_jurisdictions || [];
    const unique = Array.from(new Set(nexus));
    return unique;
  }, [settings?.default_nexus_jurisdictions]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      jurisdiction_code: jurisdiction || jurisdictionOptions[0] || "",
      product_code: "",
      rule_type: "TAXABLE",
      special_rate: null,
      valid_from: todayIso(),
      valid_to: null,
      notes: "",
    });
    setFormOpen(true);
    setMessage(null);
  };

  const openEdit = (rule: TaxProductRule) => {
    setEditing(rule);
    setForm({
      jurisdiction_code: rule.jurisdictionCode,
      product_code: rule.productCode,
      rule_type: rule.ruleType,
      special_rate: rule.specialRate ?? null,
      valid_from: rule.validFrom,
      valid_to: rule.validTo ?? null,
      notes: rule.notes || "",
    });
    setFormOpen(true);
    setMessage(null);
  };

  const onSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (!form.jurisdiction_code.trim()) throw new Error("Jurisdiction is required.");
      if (!form.product_code.trim()) throw new Error("Product code is required.");
      if (!form.valid_from) throw new Error("Valid from date is required.");
      if (form.rule_type === "REDUCED" && (!form.special_rate || form.special_rate <= 0)) {
        throw new Error("Special rate is required for REDUCED and must be > 0.");
      }

      if (editing) {
        await updateRule(editing.id, {
          product_code: form.product_code,
          rule_type: form.rule_type,
          special_rate: form.rule_type === "REDUCED" ? form.special_rate : null,
          valid_from: form.valid_from,
          valid_to: form.valid_to,
          notes: form.notes,
        });
      } else {
        await createRule({
          jurisdiction_code: form.jurisdiction_code,
          product_code: form.product_code,
          rule_type: form.rule_type,
          special_rate: form.rule_type === "REDUCED" ? form.special_rate : null,
          valid_from: form.valid_from,
          valid_to: form.valid_to,
          notes: form.notes,
        });
      }
      await refetch();
      setFormOpen(false);
      setEditing(null);
      setMessage("Saved.");
    } catch (e: any) {
      setMessage(e?.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (rule: TaxProductRule) => {
    if (!confirm(`Delete rule ${rule.jurisdictionCode} / ${rule.productCode}?`)) return;
    try {
      await deleteRule(rule.id);
      await refetch();
    } catch (e: any) {
      setMessage(e?.message || "Failed to delete rule");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Tax</p>
            <h1 className="text-lg font-bold text-white">Tax Product Rules</h1>
            <p className="text-sm text-gray-400">Control how products are treated for tax in each jurisdiction.</p>
            <p className="text-xs text-gray-600 mt-1">These rules power T5_EXEMPT_TAXED anomalies and filing summaries.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/companion/tax" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Tax Guardian
            </Link>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-black bg-[#A3E635] rounded-xl shadow-sm hover:bg-[#bef264] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add rule
            </button>
          </div>
        </header>

        {message && <div className="text-sm text-[#A3E635] bg-[#A3E635]/10 border border-[#A3E635]/20 rounded-xl p-3">{message}</div>}
        {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>}

        <div className="bg-[#131316] border border-white/5 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-300">Jurisdiction</label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="">(Default nexus / all)</option>
                {jurisdictionOptions.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-1">Uses your Tax Settings nexus list by default.</p>
            </div>
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-300">Product code</label>
              <input
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="FOOD, GENERAL, SAAS"
                className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600"
              />
            </div>
            <div>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-300 bg-[#18181B] border border-white/10 rounded-xl hover:bg-[#27272A] transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#131316] border border-white/5 rounded-2xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#09090B] text-gray-500 border-b border-white/5">
              <tr>
                <th className="px-3 py-2 text-left font-bold uppercase text-[11px] tracking-wide">Jurisdiction</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-[11px] tracking-wide">Product</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-[11px] tracking-wide">Rule</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[11px] tracking-wide">Special rate</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-[11px] tracking-wide">Valid</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-[11px] tracking-wide">Notes</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[11px] tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-[#18181B] transition-colors">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-white">{r.jurisdictionCode}</div>
                    <div className="text-xs text-gray-500">{r.jurisdictionName}</div>
                  </td>
                  <td className="px-3 py-2 font-semibold text-white font-mono">{r.productCode}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${badgeClass(r.ruleType)}`}>
                      {ruleTypeLabel[r.ruleType] || r.ruleType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">{r.specialRate ? r.specialRate : "—"}</td>
                  <td className="px-3 py-2 text-gray-300">
                    <div>{r.validFrom}</div>
                    <div className="text-xs text-gray-600">{r.validTo ? `→ ${r.validTo}` : `→ (open)`}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-400 max-w-[360px] truncate">{r.notes || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-300 bg-[#27272A] border border-white/10 rounded-lg hover:bg-[#323232] transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>{" "}
                    <button
                      onClick={() => onDelete(r)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && rules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                    No tax product rules configured yet. Add rules to mark products as EXEMPT, ZERO-RATED, or REDUCED per jurisdiction.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {formOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-lg bg-[#131316] border border-white/10 rounded-2xl shadow-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white">{editing ? "Edit rule" : "Add rule"}</h2>
                <button onClick={() => setFormOpen(false)} className="text-sm text-gray-500 hover:text-white transition-colors">
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Jurisdiction</label>
                  <input
                    disabled={!!editing}
                    value={form.jurisdiction_code}
                    onChange={(e) => setForm({ ...form, jurisdiction_code: e.target.value.toUpperCase() })}
                    className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50 placeholder:text-gray-600"
                    placeholder="CA-ON"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Product code</label>
                  <input
                    value={form.product_code}
                    onChange={(e) => setForm({ ...form, product_code: e.target.value.toUpperCase() })}
                    className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600"
                    placeholder="FOOD"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rule type</label>
                    <select
                      value={form.rule_type}
                      onChange={(e) => setForm({ ...form, rule_type: e.target.value as RuleForm["rule_type"] })}
                      className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      {Object.keys(ruleTypeLabel).map((t) => (
                        <option key={t} value={t}>
                          {ruleTypeLabel[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Special rate</label>
                    <input
                      type="number"
                      step="0.000001"
                      disabled={form.rule_type !== "REDUCED"}
                      value={form.special_rate ?? ""}
                      onChange={(e) => setForm({ ...form, special_rate: e.target.value ? Number(e.target.value) : null })}
                      className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-40 placeholder:text-gray-600"
                      placeholder="0.050000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Valid from</label>
                    <input
                      type="date"
                      value={form.valid_from}
                      onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                      className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Valid to (optional)</label>
                    <input
                      type="date"
                      value={form.valid_to ?? ""}
                      onChange={(e) => setForm({ ...form, valid_to: e.target.value || null })}
                      className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setFormOpen(false)}
                    className="px-3 py-2 text-sm font-semibold text-gray-300 bg-[#18181B] border border-white/10 rounded-xl hover:bg-[#27272A] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={saving}
                    onClick={onSave}
                    className="px-3 py-2 text-sm font-bold text-black bg-[#A3E635] rounded-xl hover:bg-[#bef264] transition-colors disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaxProductRulesPage;
