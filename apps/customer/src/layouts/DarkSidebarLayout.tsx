import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ToastProvider } from "../contexts/ToastContext";
import {
    PieChart,
    ListOrdered,
    Receipt,
    CreditCard,
    Calculator,
    BarChart3,
    Landmark,
    Bell,
    LogOut,
    Menu,
    X,
    ChevronDown,
    ArrowRightLeft,
    FileText,
    Briefcase,
    Settings,
    ShoppingCart,
    Bot,
    GitBranch,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    href?: string;
    badge?: string;
    active?: boolean;
    onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, badge, onClick }) => (
    <div
        onClick={onClick}
        className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${active
            ? "bg-[#27272A] text-white font-medium shadow-sm border border-white/5"
            : "text-gray-400 hover:bg-[#18181B] hover:text-gray-200 border border-transparent"
            }`}
    >
        <div className="flex items-center gap-3">
            <span className={active ? "text-white" : "text-gray-500"}>{icon}</span>
            <span className="text-sm">{label}</span>
        </div>
        {badge && (
            <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${active ? "bg-[#3F3F46] text-white" : "bg-[#18181B] text-gray-400 border border-white/5"
                    }`}
            >
                {badge}
            </span>
        )}
    </div>
);

interface LabelItemProps {
    color: string;
    label: string;
    badge?: string;
}

const LabelItem: React.FC<LabelItemProps> = ({ color, label, badge }) => (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-gray-400 hover:bg-[#18181B] hover:text-gray-200 transition-all">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${color} shadow-sm`} />
            <span className="text-sm">{label}</span>
        </div>
        {badge && <span className="text-xs text-gray-500 font-medium">{badge}</span>}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────

export const DarkSidebarLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { auth, logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const userName = auth.user?.name || auth.user?.email || "Account";
    const initials = userName
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    const isActive = (href: string) =>
        location.pathname === href || location.pathname.startsWith(href + "/");

    const go = (href: string) => {
        navigate(href);
        setMobileOpen(false);
    };

    return (
        <ToastProvider>
            <div
                className="flex h-screen w-full bg-[#09090B] text-gray-300 overflow-hidden relative"
                style={{ fontFamily: "'Inter', sans-serif" }}
            >
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>

                {/* Mobile Top Bar */}
                <div className="lg:hidden absolute top-0 left-0 right-0 h-14 bg-[#09090B]/95 backdrop-blur-md border-b border-white/10 z-40 flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            R
                        </div>
                        <span className="text-white font-semibold tracking-tight">Rings OS</span>
                    </div>
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="p-2 bg-[#18181B] border border-white/5 rounded-md text-white"
                    >
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Sidebar */}
                <aside
                    className={`w-[260px] flex-col h-full bg-[#131316] border-r border-white/5 absolute lg:relative inset-y-0 left-0 z-40 transform ${mobileOpen ? "translate-x-0" : "-translate-x-full"
                        } lg:translate-x-0 transition-transform duration-300 ease-in-out flex shadow-2xl lg:shadow-none`}
                >
                    {/* Workspace Switcher */}
                    <div className="flex items-center gap-3 p-4 border-b border-white/5 pt-16 lg:pt-4">
                        <div className="flex items-center gap-3 bg-[#18181B] p-1.5 pr-3 rounded-xl border border-white/5 flex-1 cursor-pointer hover:bg-[#27272A] transition-colors group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#4F46E5] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                {initials.slice(0, 2) || "CB"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">
                                    {userName.split(" ")[0] || "Clover"} Agency
                                </p>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">
                                    Workspace
                                </p>
                            </div>
                            <ChevronDown size={14} className="text-gray-500" />
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" style={{ scrollbarWidth: "none" }}>
                        {/* General Ledger */}
                        <div>
                            <p className="px-3 text-xs font-semibold text-gray-500 mb-2">General Ledger</p>
                            <div className="space-y-0.5">
                                <NavItem
                                    icon={<PieChart size={16} />}
                                    label="Overview"
                                    active={isActive("/dashboard")}
                                    onClick={() => go("/dashboard")}
                                />
                                <NavItem
                                    icon={<ListOrdered size={16} />}
                                    label="Inbox & Triage"
                                    badge="12"
                                    active={isActive("/banking")}
                                    onClick={() => go("/banking")}
                                />
                                <NavItem
                                    icon={<BarChart3 size={16} />}
                                    label="Analytics"
                                    active={isActive("/expenses")}
                                    onClick={() => go("/expenses")}
                                />
                                <NavItem
                                    icon={<Bot size={16} />}
                                    label="AI Companion"
                                    active={isActive("/ai-companion")}
                                    onClick={() => go("/ai-companion")}
                                />
                                <NavItem
                                    icon={<GitBranch size={16} />}
                                    label="Workflows & Rules"
                                    active={isActive("/workflows")}
                                    onClick={() => go("/workflows")}
                                />
                            </div>
                        </div>

                        {/* Treasury & AP/AR */}
                        <div>
                            <p className="px-3 text-xs font-semibold text-gray-500 mb-2">Treasury & AP/AR</p>
                            <div className="space-y-0.5">
                                <NavItem
                                    icon={<Landmark size={16} />}
                                    label="Bank Accounts"
                                    active={isActive("/bank-accounts")}
                                    onClick={() => go("/bank-accounts")}
                                />
                                <NavItem
                                    icon={<CreditCard size={16} />}
                                    label="Corporate Cards"
                                    badge="2"
                                    active={isActive("/banking/setup")}
                                    onClick={() => go("/banking/setup")}
                                />
                                <NavItem
                                    icon={<ShoppingCart size={16} />}
                                    label="Expenses"
                                    active={isActive("/expense-list")}
                                    onClick={() => go("/expense-list")}
                                />
                                <NavItem
                                    icon={<Receipt size={16} />}
                                    label="Invoices (AR)"
                                    active={isActive("/invoices")}
                                    onClick={() => go("/invoices")}
                                />
                                <NavItem
                                    icon={<Briefcase size={16} />}
                                    label="Customers (CRM)"
                                    active={isActive("/customers")}
                                    onClick={() => go("/customers")}
                                />
                                <NavItem
                                    icon={<ArrowRightLeft size={16} />}
                                    label="Bills (AP)"
                                    active={isActive("/transactions")}
                                    onClick={() => go("/transactions")}
                                />
                            </div>
                        </div>

                        {/* Compliance */}
                        <div>
                            <p className="px-3 text-xs font-semibold text-gray-500 mb-2">Compliance</p>
                            <div className="space-y-0.5">
                                <NavItem
                                    icon={<Calculator size={16} />}
                                    label="Tax Guardian"
                                    active={isActive("/companion/tax")}
                                    onClick={() => go("/companion/tax")}
                                />
                                <NavItem
                                    icon={<FileText size={16} />}
                                    label="Document Hub"
                                    active={isActive("/reports/pl")}
                                    onClick={() => go("/reports/pl")}
                                />
                            </div>
                        </div>

                        {/* AI Flags */}
                        <div className="pt-2">
                            <div className="flex items-center justify-between px-3 mb-2">
                                <span className="text-xs font-semibold text-gray-500">AI Flags</span>
                            </div>
                            <div className="space-y-0.5">
                                <LabelItem color="bg-[#8B5CF6]" label="Missing Receipts" badge="4" />
                                <LabelItem color="bg-[#A3E635]" label="Anomaly Detected" badge="1" />
                                <LabelItem color="bg-[#F87171]" label="Nexus Warning" badge="3" />
                            </div>
                        </div>
                    </nav>

                    {/* Bottom user area */}
                    <div className="p-4 border-t border-white/5">
                        <div className="flex items-center justify-between px-2">
                            <div
                                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white cursor-pointer"
                                onClick={() => go("/settings")}
                            >
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] border border-white/10 flex items-center justify-center text-xs font-bold text-white">
                                    {initials.slice(0, 1)}
                                </div>
                                <span>{userName.split(" ")[0]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="text-gray-500 hover:text-white transition-colors" onClick={() => go("/settings")}>
                                    <Settings size={15} />
                                </button>
                                <button className="text-gray-500 hover:text-white transition-colors">
                                    <Bell size={15} />
                                </button>
                                <button
                                    className="text-gray-500 hover:text-rose-400 transition-colors"
                                    onClick={logout}
                                    title="Sign out"
                                >
                                    <LogOut size={15} />
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Page Content */}
                <main className="flex-1 h-full overflow-y-auto overflow-x-hidden relative flex flex-col pt-14 lg:pt-0">
                    <Outlet />
                </main>
            </div>
        </ToastProvider>
    );
};

export default DarkSidebarLayout;
