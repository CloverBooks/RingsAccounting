import React, { useEffect, useMemo, useState } from "react";
import { PERMISSION_CATEGORIES, getPermissionsByCategory, type PermissionLevel, type PermissionScopeType } from "../permissions/permissionsRegistry";
import { useRoles, type RoleDetail } from "./useRoles";
import UserRoleOverridesPanel from "./UserRoleOverridesPanel";

const LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
  { value: "approve", label: "Approve" },
];

const SCOPES: { value: PermissionScopeType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "own_department", label: "Own department" },
  { value: "own_created", label: "Own created" },
  { value: "selected_accounts", label: "Selected accounts" },
];

function ensureRolePermission(role: RoleDetail, action: string) {
  const existing = role.permissions[action];
  if (existing) return existing;
  return { level: "none" as PermissionLevel, scope: { type: "all" as PermissionScopeType } };
}

function parseAccountIds(raw: string): number[] {
  return raw
    .split(/[,\s]+/g)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.trunc(n));
}

export const RolesSettingsPage: React.FC = () => {
  const {
    roles,
    activeRole,
    setActiveRole,
    loadingRoles,
    loadingRole,
    savingRole,
    warnings,
    error,
    refreshRoles,
    loadRole,
    createRole,
    saveRole,
    deleteRole,
  } = useRoles();

  const [activeCategory, setActiveCategory] = useState<string>("Global");

  useEffect(() => {
    refreshRoles();
  }, [refreshRoles]);

  const categories = useMemo(() => PERMISSION_CATEGORIES as unknown as string[], []);
  const perms = useMemo(() => getPermissionsByCategory(activeCategory), [activeCategory]);

  const updateRole = (updater: (role: RoleDetail) => RoleDetail) => {
    if (!activeRole) return;
    setActiveRole(updater(activeRole));
  };

  const handleCreate = async () => {
    const label = prompt("Role name (e.g. â€œAP Specialist (Marketing)â€)");
    if (!label) return;
    const cloneFromId = activeRole?.id;
    await createRole(label, cloneFromId);
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar: Roles list */}
        <aside className="bg-[#131316] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div>
              <h3 className="text-sm font-semibold text-white">Roles</h3>
              <p className="text-xs text-gray-500 mt-0.5">Templates and custom roles per workspace.</p>
            </div>
            <button type="button" onClick={handleCreate} disabled={savingRole}
              className="rounded-xl bg-[#A3E635] text-black px-3 py-2 text-xs font-bold hover:bg-[#bef264] disabled:opacity-60 transition-all">
              New role
            </button>
          </div>

          <div className="max-h-[600px] overflow-y-auto p-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
            {loadingRoles ? (
              <div className="px-3 py-4 text-sm text-gray-500">Loading rolesâ€¦</div>
            ) : (
              <div className="space-y-1">
                {roles.map(role => {
                  const isActive = activeRole?.id === role.id;
                  return (
                    <button key={role.id} type="button" onClick={() => loadRole(role.id)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition border ${isActive ? "bg-[#18181B] text-white border-white/10 shadow-sm" : "text-gray-400 border-transparent hover:bg-[#18181B] hover:text-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate text-white">{role.label}</div>
                          <div className="text-[11px] text-gray-500 font-mono">{role.key}</div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${role.is_builtin ? "border-white/10 bg-[#27272A] text-gray-400" : "border-[#8B5CF6]/30 bg-[#8B5CF6]/10 text-[#8B5CF6]"}`}>
                          {role.is_builtin ? "Template" : "Custom"}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {!roles.length && <div className="px-3 py-4 text-sm text-gray-500">No roles found.</div>}
              </div>
            )}
          </div>
        </aside>

        {/* Main: Role editor */}
        <section className="bg-[#131316] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Role editor</h3>
                <p className="text-xs text-gray-500 mt-0.5">Set permission levels and scopes. Changes affect new requests immediately.</p>
              </div>
              {activeRole && (
                <div className="flex items-center gap-2">
                  {!activeRole.is_builtin && (
                    <button type="button" onClick={async () => { if (!confirm("Delete this custom role?")) return; await deleteRole(activeRole.id); }}
                      disabled={savingRole}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-60">
                      Delete
                    </button>
                  )}
                  <button type="button" onClick={async () => { if (!activeRole) return; await saveRole(activeRole, false); }}
                    disabled={!activeRole || savingRole}
                    className="flex items-center gap-2 bg-[#A3E635] text-black px-5 py-2.5 text-xs font-bold rounded-xl hover:bg-[#bef264] transition-all disabled:opacity-60">
                    {savingRole ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg><span>Savingâ€¦</span></>
                    ) : (
                      <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Save changes</span></>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {warnings?.length ? (
              <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-400">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-semibold">Segregation of duties warnings</div>
                    <ul className="text-xs space-y-1 text-amber-300">
                      {warnings.map(w => (
                        <li key={w.id}><span className="font-semibold">{w.severity.toUpperCase()}</span> â€” {w.message}</li>
                      ))}
                    </ul>
                  </div>
                  {activeRole && (
                    <button type="button" onClick={async () => { await saveRole(activeRole, true); }} disabled={savingRole}
                      className="shrink-0 rounded-xl bg-amber-500 text-black px-3 py-2 text-xs font-bold hover:bg-amber-400 disabled:opacity-60">
                      Save anyway
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {!activeRole ? (
              <div className="rounded-xl border border-white/5 bg-[#09090B] p-6 text-sm text-gray-500">
                Select a role on the left to edit its permissions.
              </div>
            ) : loadingRole ? (
              <div className="text-sm text-gray-500">Loading roleâ€¦</div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Role name</label>
                    <input type="text" value={activeRole.label}
                      onChange={e => updateRole(r => ({ ...r, label: e.target.value }))}
                      className="w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#8B5CF6]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Key</label>
                    <div className="bg-[#09090B] border border-white/5 rounded-xl px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
                      <span className="font-mono">{activeRole.key}</span>
                      <span className="text-[11px] text-gray-600">{activeRole.is_builtin ? "Template" : "Custom"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
                  {/* Category sidebar */}
                  <div className="bg-[#09090B] border border-white/5 rounded-xl p-2 h-fit">
                    {categories.map(category => (
                      <button key={category} type="button" onClick={() => setActiveCategory(category)}
                        className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition ${activeCategory === category ? "bg-[#18181B] text-white" : "text-gray-500 hover:bg-[#131316] hover:text-gray-300"}`}>
                        {category}
                      </button>
                    ))}
                  </div>

                  {/* Permissions grid */}
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{activeCategory}</div>
                      <div className="text-xs text-gray-500">Choose a level and scope for each action.</div>
                    </div>

                    <div className="space-y-2">
                      {perms.map(p => {
                        const entry = ensureRolePermission(activeRole, p.action);
                        const scopeType = (entry.scope?.type || "all") as PermissionScopeType;
                        const selectedAccounts = scopeType === "selected_accounts" ? (entry.scope?.account_ids || []) : [];
                        return (
                          <div key={p.action} className="bg-[#09090B] border border-white/5 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-white">{p.label}</h4>
                              {p.sensitive && (
                                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                                  Sensitive
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3" style={{ maxWidth: "240px" }}>
                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Level</label>
                                <select value={entry.level}
                                  onChange={e => updateRole(r => ({ ...r, permissions: { ...r.permissions, [p.action]: { ...ensureRolePermission(r, p.action), level: e.target.value as PermissionLevel } } }))}
                                  className="w-full bg-[#131316] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#8B5CF6]">
                                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Scope</label>
                                <select value={scopeType}
                                  onChange={e => updateRole(r => ({ ...r, permissions: { ...r.permissions, [p.action]: { ...ensureRolePermission(r, p.action), scope: { type: e.target.value as PermissionScopeType } } } }))}
                                  className="w-full bg-[#131316] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#8B5CF6]">
                                  {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-gray-500">{p.description}</p>
                              <p className="text-[11px] text-gray-600 font-mono">{p.action}</p>
                            </div>

                            {scopeType === "selected_accounts" ? (
                              <div className="rounded-xl border border-white/5 bg-[#131316] p-3">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bank account IDs</label>
                                <input type="text" value={selectedAccounts.join(", ")}
                                  onChange={e => updateRole(r => ({ ...r, permissions: { ...r.permissions, [p.action]: { ...ensureRolePermission(r, p.action), scope: { type: "selected_accounts", account_ids: parseAccountIds(e.target.value) } } } }))}
                                  placeholder="e.g. 12, 15, 19"
                                  className="mt-1 w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#8B5CF6]" />
                                <div className="mt-1 text-xs text-gray-600">Enforced server-side when context includes <code className="text-gray-500">bank_account_id</code>.</div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {!perms.length && (
                        <div className="rounded-xl border border-white/5 bg-[#09090B] p-6 text-sm text-gray-500">
                          No permissions defined for this category yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      <UserRoleOverridesPanel roles={roles} />
    </div>
  );
};

export default RolesSettingsPage;
