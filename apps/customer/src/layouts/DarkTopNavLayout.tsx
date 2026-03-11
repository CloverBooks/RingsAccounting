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
    Settings,
    Bell,
    LogOut,
    Menu,
    X,
    ChevronDown,
} from "lucide-react";

// Nav items for the top bar
const NAV_ITEMS = [
    { label: "Overview", href: "/dashboard", icon: <PieChart size={14} /> },
    { label: "Banking", href: "/banking", icon: <Landmark size={14} /> },
    { label: "Invoices", href: "/invoices", icon: <Receipt size={14} /> },
    { label: "Expenses", href: "/expenses", icon: <CreditCard size={14} /> },
    { label: "Tax", href: "/companion/tax", icon: <Calculator size={14} /> },
    { label: "Reports", href: "/reports/pl", icon: <BarChart3 size={14} /> },
];

export const DarkTopNavLayout: React.FC = () => {
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

    return (
        <ToastProvider>
            <div
                className="min-h-screen flex flex-col bg-[#080808] text-gray-300"
                style={{ fontFamily: "'Outfit', sans-serif" }}
            >
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>

                {/* ─── Top Navigation Bar ─── */}
                <header className="sticky top-0 z-50 w-full bg-[#080808]/95 backdrop-blur-md border-b border-white/5 shrink-0">
                    <div className="flex items-center h-14 px-6 gap-6">

                        {/* Logo */}
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="flex items-center gap-2.5 shrink-0 group"
                        >
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-purple-900/30">
                                R
                            </div>
                            <span className="text-white font-semibold text-sm tracking-wide hidden sm:block">
                                Rings
                            </span>
                        </button>

                        {/* Desktop nav links */}
                        <nav className="hidden md:flex items-center gap-1 flex-1">
                            {NAV_ITEMS.map((item) => (
                                <button
                                    key={item.href}
                                    onClick={() => navigate(item.href)}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${isActive(item.href)
                                        ? "bg-white text-black shadow-sm"
                                        : "text-gray-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </nav>

                        {/* Right side actions */}
                        <div className="flex items-center gap-2 ml-auto shrink-0">
                            {/* Date hint */}
                            <span className="hidden lg:flex items-center gap-1.5 text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                                Mar 2025
                            </span>

                            {/* Bell */}
                            <button className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all relative">
                                <Bell size={14} />
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#A3E635] rounded-full shadow-[0_0_4px_rgba(163,230,53,0.8)]" />
                            </button>

                            {/* Settings */}
                            <button
                                onClick={() => navigate("/settings")}
                                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <Settings size={14} />
                            </button>

                            {/* Avatar / User menu */}
                            <div className="relative group">
                                <button className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-full pl-1 pr-3 py-1 hover:bg-white/10 transition-all">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                        {initials}
                                    </div>
                                    <span className="text-white text-xs font-medium hidden sm:block max-w-[80px] truncate">
                                        {userName.split(" ")[0] || userName.split("@")[0]}
                                    </span>
                                    <ChevronDown size={12} className="text-gray-500" />
                                </button>

                                {/* Dropdown */}
                                <div className="absolute right-0 top-full mt-2 w-44 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                                    <div className="px-3 py-2 border-b border-white/5 mb-1">
                                        <p className="text-white text-xs font-medium truncate">{userName}</p>
                                    </div>
                                    <button
                                        onClick={() => navigate("/settings")}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        <Settings size={13} /> Settings
                                    </button>
                                    <button
                                        onClick={logout}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                                    >
                                        <LogOut size={13} /> Sign out
                                    </button>
                                </div>
                            </div>

                            {/* Mobile hamburger */}
                            <button
                                onClick={() => setMobileOpen((o) => !o)}
                                className="md:hidden w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                            >
                                {mobileOpen ? <X size={14} /> : <Menu size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Mobile nav drawer */}
                    {mobileOpen && (
                        <div className="md:hidden border-t border-white/5 bg-[#0A0A0A] px-4 py-3">
                            <div className="grid grid-cols-2 gap-2">
                                {NAV_ITEMS.map((item) => (
                                    <button
                                        key={item.href}
                                        onClick={() => { navigate(item.href); setMobileOpen(false); }}
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive(item.href)
                                            ? "bg-white text-black"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                            }`}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </header>

                {/* ─── Page Content ─── */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    <Outlet />
                </main>
            </div>
        </ToastProvider>
    );
};

export default DarkTopNavLayout;
