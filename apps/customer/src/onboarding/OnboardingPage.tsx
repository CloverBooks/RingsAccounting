import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingProvider, useOnboarding, FAST_PATH_STEPS, GUIDED_PATH_STEPS } from "./OnboardingContext";
import { Sparkles, ArrowRight, Check, Building2, Target, Briefcase, Calendar, Database, Bot } from "lucide-react";
import { getMissingRequiredFields, OnboardingProfileV2 } from "./readiness";
import "./onboarding.css";

// =============================================================================
// Step Components
// =============================================================================

const WelcomeStep: React.FC = () => {
    const { setStep, logEvent, setFastPath } = useOnboarding();

    useEffect(() => {
        logEvent("Onboarding_Started", {});
    }, [logEvent]);

    return (
        <div className="onboarding-step">
            <div className="onboarding-card text-center">
                {/* Animated hero icon */}
                <div className="onboarding-hero-icon">
                    <Sparkles className="w-10 h-10 text-white" />
                </div>

                <div className="space-y-4 mb-8">
                    <h1 className="onboarding-title">
                        Welcome to <span className="onboarding-title-gradient">Clover Books</span>
                    </h1>
                    <p className="onboarding-subtitle">
                        We'll only ask what we need. You can skip almost anything.
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => { setFastPath(true); setStep("intent"); }}
                        className="w-full onboarding-btn-primary group"
                    >
                        <span>Quick setup</span>
                        <span className="text-sm opacity-60">~2 min</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                        onClick={() => { setFastPath(false); setStep("intent"); }}
                        className="w-full onboarding-btn-secondary group"
                    >
                        <span>Guided setup</span>
                        <span className="text-sm opacity-60">~5 min</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                <p className="text-xs text-slate-400 mt-6">
                    You can always change your answers later in Settings.
                </p>
            </div>
        </div>
    );
};

const IntentStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [selected, setSelected] = React.useState<string | null>(null);

    const options = [
        { value: "track_expenses", label: "Track expenses", icon: Briefcase },
        { value: "invoice_customers", label: "Invoice customers", icon: Target },
        { value: "manage_inventory", label: "Manage inventory", icon: Database },
        { value: "all", label: "All of the above", icon: Check },
    ];

    const handleNext = async () => {
        if (selected) {
            await updateProfile({ intent: selected });
            logEvent("Onboarding_Step_Completed", { step: "intent", value: selected });
        }
        setStep("business_basics");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Step 1</p>
                <h2 className="text-2xl font-bold text-slate-900">What's your main goal?</h2>
                <p className="text-slate-600">This helps us customize your experience.</p>
            </div>

            <div className="grid gap-3">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => setSelected(opt.value)}
                        className={`flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition ${selected === opt.value
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        <opt.icon className="w-5 h-5" />
                        <span className="font-medium">{opt.label}</span>
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const BusinessBasicsStep: React.FC = () => {
    const { profile, updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [name, setName] = React.useState(profile.business_name || "");

    const handleNext = async () => {
        if (name.trim()) {
            await updateProfile({ business_name: name.trim() });
            logEvent("Onboarding_Step_Completed", { step: "business_basics" });
        }
        setStep("industry");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Step 2</p>
                <h2 className="text-2xl font-bold text-slate-900">What's your business called?</h2>
            </div>

            <div>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                    autoFocus
                />
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const IndustryStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, fastPath, logEvent } = useOnboarding();
    const [selected, setSelected] = React.useState<string | null>(null);

    const industries = [
        "Retail", "Professional Services", "Restaurant/Food", "Construction",
        "Healthcare", "Technology", "Real Estate", "Other"
    ];

    const handleNext = async () => {
        if (selected) {
            await updateProfile({ industry: selected });
            logEvent("Onboarding_Step_Completed", { step: "industry", value: selected });
        }
        setStep(fastPath ? "team_size" : "entity");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Step 3</p>
                <h2 className="text-2xl font-bold text-slate-900">What industry are you in?</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {industries.map((ind) => (
                    <button
                        key={ind}
                        onClick={() => setSelected(ind)}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${selected === ind
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        {ind}
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const EntityStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [selected, setSelected] = React.useState<string | null>(null);

    const entities = ["Sole Proprietor", "LLC", "S-Corp", "C-Corp", "Partnership", "Non-profit"];

    const handleNext = async () => {
        if (selected) {
            await updateProfile({ entity_type: selected });
            logEvent("Onboarding_Step_Completed", { step: "entity", value: selected });
        }
        setStep("fiscal_pulse");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Step 4</p>
                <h2 className="text-2xl font-bold text-slate-900">What type of entity?</h2>
                <p className="text-slate-600">This helps with tax categorization.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {entities.map((ent) => (
                    <button
                        key={ent}
                        onClick={() => setSelected(ent)}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${selected === ent
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        <Building2 className="w-4 h-4" />
                        {ent}
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const FiscalPulseStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [selected, setSelected] = React.useState<string | null>(null);

    const months = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

    const handleNext = async () => {
        if (selected) {
            await updateProfile({ fiscal_year_end: selected });
            logEvent("Onboarding_Step_Completed", { step: "fiscal_pulse", value: selected });
        }
        setStep("team_size");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Step 5</p>
                <h2 className="text-2xl font-bold text-slate-900">When does your fiscal year end?</h2>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {months.map((month) => (
                    <button
                        key={month}
                        onClick={() => setSelected(month)}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${selected === month
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        {month}
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// New Steps for Enhanced AI Companion Context
// =============================================================================

const TeamSizeStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, fastPath, logEvent } = useOnboarding();
    const [selected, setSelected] = React.useState<string | null>(null);

    const sizes = [
        { value: "solo", label: "Just me", desc: "Solo operator" },
        { value: "2-5", label: "2-5 people", desc: "Small team" },
        { value: "6-20", label: "6-20 people", desc: "Growing team" },
        { value: "21-50", label: "21-50 people", desc: "Mid-size" },
        { value: "50+", label: "50+ people", desc: "Large organization" },
    ];

    const handleNext = async () => {
        if (selected) {
            await updateProfile({ employee_count: selected });
            logEvent("Onboarding_Step_Completed", { step: "team_size", value: selected });
        }
        setStep(fastPath ? "professional_profile" : "business_age");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide">Team</p>
                <h2 className="text-2xl font-bold text-slate-900">How big is your team?</h2>
                <p className="text-slate-600">This helps your AI Companion understand your scale.</p>
            </div>

            <div className="space-y-3">
                {sizes.map((size) => (
                    <button
                        key={size.value}
                        onClick={() => setSelected(size.value)}
                        className={`w-full flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${selected === size.value
                            ? "border-emerald-500 bg-emerald-50 shadow-md"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                    >
                        <span className="font-medium text-slate-900">{size.label}</span>
                        <span className="text-sm text-slate-500">{size.desc}</span>
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const BusinessAgeStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [selected, setSelected] = React.useState<string | null>(null);

    const ages = [
        { value: "new", label: "Just starting", desc: "Haven't launched yet" },
        { value: "<1", label: "Less than 1 year", desc: "Recently launched" },
        { value: "1-3", label: "1-3 years", desc: "Established" },
        { value: "3-10", label: "3-10 years", desc: "Mature" },
        { value: "10+", label: "10+ years", desc: "Well established" },
    ];

    const handleNext = async () => {
        if (selected) {
            await updateProfile({ business_age: selected });
            logEvent("Onboarding_Step_Completed", { step: "business_age", value: selected });
        }
        setStep("challenges");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide">Experience</p>
                <h2 className="text-2xl font-bold text-slate-900">How long have you been in business?</h2>
            </div>

            <div className="space-y-3">
                {ages.map((age) => (
                    <button
                        key={age.value}
                        onClick={() => setSelected(age.value)}
                        className={`w-full flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${selected === age.value
                            ? "border-emerald-500 bg-emerald-50 shadow-md"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                    >
                        <span className="font-medium text-slate-900">{age.label}</span>
                        <span className="text-sm text-slate-500">{age.desc}</span>
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const ChallengesStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [selected, setSelected] = React.useState<string[]>([]);

    const challenges = [
        "Tracking cash flow",
        "Managing invoices",
        "Tax preparation",
        "Expense categorization",
        "Bank reconciliation",
        "Financial reporting",
        "Staying organized",
        "Saving time",
    ];

    const toggleChallenge = (challenge: string) => {
        setSelected(prev =>
            prev.includes(challenge)
                ? prev.filter(c => c !== challenge)
                : [...prev, challenge]
        );
    };

    const handleNext = async () => {
        if (selected.length > 0) {
            await updateProfile({ biggest_challenges: selected });
            logEvent("Onboarding_Step_Completed", { step: "challenges", value: selected });
        }
        setStep("current_tools");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide">Pain Points</p>
                <h2 className="text-2xl font-bold text-slate-900">What are your biggest challenges?</h2>
                <p className="text-slate-600">Select all that apply — this helps us focus your AI Companion.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {challenges.map((challenge) => (
                    <button
                        key={challenge}
                        onClick={() => toggleChallenge(challenge)}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${selected.includes(challenge)
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        {selected.includes(challenge) && <Check className="w-3.5 h-3.5" />}
                        {challenge}
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const CurrentToolsStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [selected, setSelected] = React.useState<string | null>(null);

    const tools = [
        { value: "spreadsheets", label: "Spreadsheets", desc: "Excel, Google Sheets" },
        { value: "quickbooks", label: "QuickBooks", desc: "Desktop or Online" },
        { value: "xero", label: "Xero", desc: "Cloud accounting" },
        { value: "wave", label: "Wave", desc: "Free accounting" },
        { value: "freshbooks", label: "FreshBooks", desc: "Invoicing focus" },
        { value: "nothing", label: "Starting fresh", desc: "No existing system" },
    ];

    const handleNext = async () => {
        if (selected) {
            await updateProfile({ current_tools: selected });
            logEvent("Onboarding_Step_Completed", { step: "current_tools", value: selected });
        }
        setStep("transaction_volume");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide">Migration</p>
                <h2 className="text-2xl font-bold text-slate-900">What are you using today?</h2>
                <p className="text-slate-600">This helps us guide your data import.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {tools.map((tool) => (
                    <button
                        key={tool.value}
                        onClick={() => setSelected(tool.value)}
                        className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${selected === tool.value
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                    >
                        <span className="font-medium text-slate-900">{tool.label}</span>
                        <span className="text-xs text-slate-500">{tool.desc}</span>
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const TransactionVolumeStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [transactions, setTransactions] = React.useState<string | null>(null);
    const [accounts, setAccounts] = React.useState<string | null>(null);

    const txnVolumes = ["<50", "50-200", "200-500", "500-1000", "1000+"];
    const accountCounts = ["1", "2-3", "4-5", "6+"];

    const handleNext = async () => {
        const updates: { monthly_transactions?: string; bank_accounts_count?: string } = {};
        if (transactions) updates.monthly_transactions = transactions;
        if (accounts) updates.bank_accounts_count = accounts;
        if (Object.keys(updates).length > 0) {
            await updateProfile(updates);
            logEvent("Onboarding_Step_Completed", { step: "transaction_volume", ...updates });
        }
        setStep("accounting_habits");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide">Volume</p>
                <h2 className="text-2xl font-bold text-slate-900">How busy is your business?</h2>
            </div>

            <div className="space-y-6">
                <div>
                    <p className="text-sm font-medium text-slate-700 mb-3">Monthly transactions</p>
                    <div className="flex flex-wrap gap-2">
                        {txnVolumes.map((vol) => (
                            <button
                                key={vol}
                                onClick={() => setTransactions(vol)}
                                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${transactions === vol
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                {vol}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700 mb-3">Bank accounts</p>
                    <div className="flex flex-wrap gap-2">
                        {accountCounts.map((count) => (
                            <button
                                key={count}
                                onClick={() => setAccounts(count)}
                                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${accounts === count
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                {count}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const AccountingHabitsStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [hasAccountant, setHasAccountant] = React.useState<boolean | null>(null);
    const [frequency, setFrequency] = React.useState<string | null>(null);

    const frequencies = [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
        { value: "rarely", label: "Rarely / tax time only" },
    ];

    const handleNext = async () => {
        const updates: { has_accountant?: boolean; accounting_frequency?: string } = {};
        if (hasAccountant !== null) updates.has_accountant = hasAccountant;
        if (frequency) updates.accounting_frequency = frequency;
        if (Object.keys(updates).length > 0) {
            await updateProfile(updates);
            logEvent("Onboarding_Step_Completed", { step: "accounting_habits", ...updates });
        }
        setStep("data_source");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide">Habits</p>
                <h2 className="text-2xl font-bold text-slate-900">How do you handle your books?</h2>
            </div>

            <div className="space-y-6">
                <div>
                    <p className="text-sm font-medium text-slate-700 mb-3">Do you work with an accountant?</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setHasAccountant(true)}
                            className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition ${hasAccountant === true
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                        >
                            Yes, I have one
                        </button>
                        <button
                            onClick={() => setHasAccountant(false)}
                            className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition ${hasAccountant === false
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                        >
                            No, I handle it myself
                        </button>
                    </div>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700 mb-3">How often do you review finances?</p>
                    <div className="flex flex-wrap gap-2">
                        {frequencies.map((freq) => (
                            <button
                                key={freq.value}
                                onClick={() => setFrequency(freq.value)}
                                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${frequency === freq.value
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                {freq.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const DataSourceStep: React.FC = () => {
    const { updateProfile, setStep, skipStep, logEvent } = useOnboarding();
    const [selected, setSelected] = React.useState<string | null>(null);

    const sources = [
        { value: "bank_connect", label: "Connect my bank", desc: "Read-only access - we cannot move money." },
        { value: "csv_import", label: "Import CSV/Excel", desc: "Upload historical transactions" },
        { value: "manual", label: "Enter manually", desc: "Start fresh with manual entry" },
    ];

    const handleNext = async () => {
        if (selected) {
            await updateProfile({ data_source: selected });
            logEvent("Onboarding_Step_Completed", { step: "data_source", value: selected });
        }
        setStep("professional_profile");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Step 6</p>
                <h2 className="text-2xl font-bold text-slate-900">How do you want to get started?</h2>
            </div>

            <div className="space-y-3">
                {sources.map((src) => (
                    <button
                        key={src.value}
                        onClick={() => setSelected(src.value)}
                        className={`w-full flex flex-col items-start gap-1 rounded-2xl border px-5 py-4 text-left transition ${selected === src.value
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                    >
                        <span className="font-medium text-slate-900">{src.label}</span>
                        <span className="text-sm text-slate-500">{src.desc}</span>
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const ProfessionalProfileStep: React.FC = () => {
    const { profile, updateProfile, setStep, skipStep, logEvent } = useOnboarding();

    const [legalBusinessName, setLegalBusinessName] = React.useState(profile.legal_business_name || profile.business_name || "");
    const [operatingName, setOperatingName] = React.useState(profile.operating_name || "");
    const [country, setCountry] = React.useState(profile.country || "US");
    const [timezone, setTimezone] = React.useState(profile.primary_timezone || "America/Toronto");
    const [currency, setCurrency] = React.useState(profile.base_currency || "USD");

    const [taxRegistrationStatus, setTaxRegistrationStatus] = React.useState(profile.tax_registration_status || profile.tax_registration || "");
    const [primaryTaxJurisdiction, setPrimaryTaxJurisdiction] = React.useState(profile.primary_tax_jurisdiction || "");
    const [taxIdsRaw, setTaxIdsRaw] = React.useState(
        Array.isArray(profile.tax_ids_by_jurisdiction)
            ? profile.tax_ids_by_jurisdiction.map((x) => `${x.jurisdiction}:${x.tax_id}`).join("\n")
            : "",
    );
    const [fiscalYearEndMonth, setFiscalYearEndMonth] = React.useState<number>(
        profile.fiscal_year_end_month || 12,
    );
    const [fiscalYearEndDay, setFiscalYearEndDay] = React.useState<number>(profile.fiscal_year_end_day || 31);
    const [accountingMethod, setAccountingMethod] = React.useState(profile.accounting_method || "accrual");
    const [filingCadence, setFilingCadence] = React.useState(profile.filing_cadence || "monthly");

    const [monthlyTransactionBand, setMonthlyTransactionBand] = React.useState(
        profile.monthly_transaction_band || profile.monthly_transactions || "",
    );
    const [bankAccountCount, setBankAccountCount] = React.useState(
        profile.bank_account_count || profile.bank_accounts_count || "",
    );
    const [currentSystemTool, setCurrentSystemTool] = React.useState(
        profile.current_system_tool || profile.current_tools || "",
    );
    const [accountingReviewFrequency, setAccountingReviewFrequency] = React.useState(
        profile.accounting_review_frequency || profile.accounting_frequency || "",
    );
    const [defaultInvoiceTerms, setDefaultInvoiceTerms] = React.useState(profile.default_invoice_terms || "Net 30");
    const [defaultBillTerms, setDefaultBillTerms] = React.useState(profile.default_bill_terms || "Net 30");
    const [defaultTaxBehavior, setDefaultTaxBehavior] = React.useState(profile.default_tax_behavior || "exclusive");
    const [approvalThreshold, setApprovalThreshold] = React.useState<number>(
        profile.high_risk_approval_threshold || 1000,
    );

    const [companionIntentGoals, setCompanionIntentGoals] = React.useState(
        profile.companion_intent_goals || profile.intent || "",
    );
    const [topChallengesRaw, setTopChallengesRaw] = React.useState(
        (profile.top_accounting_challenges || profile.biggest_challenges || []).join(", "),
    );
    const [riskAppetite, setRiskAppetite] = React.useState(profile.risk_appetite || "balanced");
    const [explanationStyle, setExplanationStyle] = React.useState(profile.preferred_explanation_style || "concise");
    const [notificationPreference, setNotificationPreference] = React.useState(
        profile.notification_preference || "in_app",
    );

    const [contactRolesRaw, setContactRolesRaw] = React.useState(
        Array.isArray(profile.contact_roles) ? profile.contact_roles.map((x) => x.role).join(", ") : "",
    );
    const [industryFlagsRaw, setIndustryFlagsRaw] = React.useState(
        Array.isArray(profile.industry_specific_flags) ? profile.industry_specific_flags.join(", ") : "",
    );
    const [reportingPrefsRaw, setReportingPrefsRaw] = React.useState(
        Array.isArray(profile.reporting_preferences) ? profile.reporting_preferences.join(", ") : "",
    );
    const [missingFields, setMissingFields] = React.useState<string[]>([]);

    const parseCsv = (value: string) =>
        value
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

    const parseTaxIds = (value: string) =>
        value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [jurisdiction, taxId] = line.split(":");
                return { jurisdiction: (jurisdiction || "").trim(), tax_id: (taxId || "").trim() };
            })
            .filter((entry) => entry.jurisdiction && entry.tax_id);

    const handleNext = async () => {
        const payload: Partial<OnboardingProfileV2> = {
            legal_business_name: legalBusinessName.trim(),
            business_name: legalBusinessName.trim(),
            operating_name: operatingName.trim(),
            country,
            primary_timezone: timezone,
            base_currency: currency,
            tax_registration_status: taxRegistrationStatus,
            tax_registration: taxRegistrationStatus,
            primary_tax_jurisdiction: primaryTaxJurisdiction.trim(),
            tax_ids_by_jurisdiction: parseTaxIds(taxIdsRaw),
            fiscal_year_end_month: fiscalYearEndMonth,
            fiscal_year_end_day: fiscalYearEndDay,
            accounting_method: accountingMethod,
            filing_cadence: filingCadence,
            monthly_transaction_band: monthlyTransactionBand,
            monthly_transactions: monthlyTransactionBand,
            bank_account_count: bankAccountCount,
            bank_accounts_count: bankAccountCount,
            current_system_tool: currentSystemTool.trim(),
            current_tools: currentSystemTool.trim(),
            accounting_review_frequency: accountingReviewFrequency,
            accounting_frequency: accountingReviewFrequency,
            default_invoice_terms: defaultInvoiceTerms,
            default_bill_terms: defaultBillTerms,
            default_tax_behavior: defaultTaxBehavior,
            high_risk_approval_threshold: approvalThreshold,
            companion_intent_goals: companionIntentGoals.trim(),
            top_accounting_challenges: parseCsv(topChallengesRaw),
            biggest_challenges: parseCsv(topChallengesRaw),
            risk_appetite: riskAppetite,
            preferred_explanation_style: explanationStyle,
            notification_preference: notificationPreference,
            contact_roles: parseCsv(contactRolesRaw).map((role) => ({ role })),
            industry_specific_flags: parseCsv(industryFlagsRaw),
            reporting_preferences: parseCsv(reportingPrefsRaw),
        };

        const mergedProfile = { ...profile, ...payload } as OnboardingProfileV2;
        const missing = getMissingRequiredFields(mergedProfile);
        if (missing.length > 0) {
            setMissingFields(missing);
            return;
        }

        setMissingFields([]);
        await updateProfile(payload);
        logEvent("Onboarding_Step_Completed", {
            step: "professional_profile",
            required_fields_complete: true,
        });
        setStep("ai_handshake");
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Professional Setup</p>
                <h2 className="text-2xl font-bold text-slate-900">Accounting profile for Companion</h2>
                <p className="text-slate-600">
                    Fill required go-live fields so Companion can use verified business context.
                </p>
            </div>

            {missingFields.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    Missing required fields: {missingFields.slice(0, 6).join(", ")}
                    {missingFields.length > 6 ? ` (+${missingFields.length - 6} more)` : ""}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <input value={legalBusinessName} onChange={(e) => setLegalBusinessName(e.target.value)} placeholder="Legal business name" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input value={operatingName} onChange={(e) => setOperatingName(e.target.value)} placeholder="Operating name" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                </select>
                <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Primary timezone" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                </select>
                <select value={taxRegistrationStatus} onChange={(e) => setTaxRegistrationStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="">Tax registration status</option>
                    <option value="registered">Registered</option>
                    <option value="not_registered">Not registered</option>
                    <option value="pending">Pending</option>
                </select>
                <input value={primaryTaxJurisdiction} onChange={(e) => setPrimaryTaxJurisdiction(e.target.value)} placeholder="Primary tax jurisdiction (e.g., US-CA, CA-ON)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2" />
                <textarea value={taxIdsRaw} onChange={(e) => setTaxIdsRaw(e.target.value)} placeholder="Tax IDs by jurisdiction. One per line: US-CA:12345" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2 min-h-[84px]" />

                <input type="number" min={1} max={12} value={fiscalYearEndMonth} onChange={(e) => setFiscalYearEndMonth(Number(e.target.value))} placeholder="Fiscal year end month" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input type="number" min={1} max={31} value={fiscalYearEndDay} onChange={(e) => setFiscalYearEndDay(Number(e.target.value))} placeholder="Fiscal year end day" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <select value={accountingMethod} onChange={(e) => setAccountingMethod(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="accrual">Accrual</option>
                    <option value="cash">Cash</option>
                </select>
                <select value={filingCadence} onChange={(e) => setFilingCadence(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                </select>

                <input value={monthlyTransactionBand} onChange={(e) => setMonthlyTransactionBand(e.target.value)} placeholder="Monthly transaction band (e.g., 50-200)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input value={bankAccountCount} onChange={(e) => setBankAccountCount(e.target.value)} placeholder="Bank account count (e.g., 2-3)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input value={currentSystemTool} onChange={(e) => setCurrentSystemTool(e.target.value)} placeholder="Current accounting system/tool" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input value={accountingReviewFrequency} onChange={(e) => setAccountingReviewFrequency(e.target.value)} placeholder="Accounting review frequency" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />

                <input value={defaultInvoiceTerms} onChange={(e) => setDefaultInvoiceTerms(e.target.value)} placeholder="Default invoice terms" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input value={defaultBillTerms} onChange={(e) => setDefaultBillTerms(e.target.value)} placeholder="Default bill terms" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input value={defaultTaxBehavior} onChange={(e) => setDefaultTaxBehavior(e.target.value)} placeholder="Default tax behavior" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                <input type="number" min={0} step={100} value={approvalThreshold} onChange={(e) => setApprovalThreshold(Number(e.target.value))} placeholder="Approval threshold for high-risk actions" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />

                <textarea value={companionIntentGoals} onChange={(e) => setCompanionIntentGoals(e.target.value)} placeholder="Companion goals and intent" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2 min-h-[72px]" />
                <textarea value={topChallengesRaw} onChange={(e) => setTopChallengesRaw(e.target.value)} placeholder="Top accounting challenges (comma separated)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2 min-h-[72px]" />
                <select value={riskAppetite} onChange={(e) => setRiskAppetite(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="conservative">Conservative</option>
                    <option value="balanced">Balanced</option>
                    <option value="aggressive">Aggressive</option>
                </select>
                <select value={explanationStyle} onChange={(e) => setExplanationStyle(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="concise">Concise</option>
                    <option value="detailed">Detailed</option>
                    <option value="step_by_step">Step-by-step</option>
                </select>
                <select value={notificationPreference} onChange={(e) => setNotificationPreference(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2">
                    <option value="in_app">In-app</option>
                    <option value="email">Email</option>
                    <option value="in_app_and_email">In-app + Email</option>
                </select>

                <input value={contactRolesRaw} onChange={(e) => setContactRolesRaw(e.target.value)} placeholder="Optional contact roles (owner, controller, bookkeeper)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2" />
                <input value={industryFlagsRaw} onChange={(e) => setIndustryFlagsRaw(e.target.value)} placeholder="Optional industry flags (comma separated)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2" />
                <input value={reportingPrefsRaw} onChange={(e) => setReportingPrefsRaw(e.target.value)} placeholder="Optional reporting preferences (comma separated)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2" />
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Save for later
                </button>
                <button
                    onClick={handleNext}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const AIHandshakeStep: React.FC = () => {
    const { setStep, skipStep, logEvent } = useOnboarding();

    const handleComplete = () => {
        logEvent("Onboarding_Step_Completed", { step: "ai_handshake" });
        setStep("done");
    };

    return (
        <div className="space-y-8 max-w-xl mx-auto">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Step 7</p>
                <h2 className="text-2xl font-bold text-slate-900">Teach Clover in 30 seconds</h2>
                <p className="text-slate-600">
                    After you import transactions, we'll show you a few and ask simple questions to learn your categories.
                </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center space-y-4">
                <Bot className="w-12 h-12 mx-auto text-slate-400" />
                <p className="text-slate-600">
                    Once you connect a bank or import data, we'll show you 3-5 sample transactions
                    and ask questions like "Is this usually for gas?"
                </p>
                <p className="text-sm text-slate-500">
                    On completion, we will record your AI consent and initial policy defaults.
                </p>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={skipStep} className="text-sm text-slate-500 hover:text-slate-700">
                    Skip for now
                </button>
                <button
                    onClick={handleComplete}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-800 transition flex items-center gap-2"
                >
                    Got it <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const DoneStep: React.FC = () => {
    const { profile, completeOnboarding, readiness, contextUnknowns, setStep } = useOnboarding();
    const navigate = useNavigate();

    const handleFinish = async () => {
        if (!readiness.required_fields_complete) {
            setStep("professional_profile");
            return;
        }
        await completeOnboarding();
        navigate("/dashboard");
    };

    return (
        <div className="onboarding-step">
            <div className="onboarding-card text-center">
                {/* Animated completion icon */}
                <div className="onboarding-complete-icon">
                    <Check className="w-12 h-12 text-emerald-600" strokeWidth={3} />
                </div>

                <div className="space-y-3 mb-8">
                    <h2 className="onboarding-title">You're all set!</h2>
                    <p className="onboarding-subtitle">
                        {(profile.legal_business_name || profile.business_name)
                            ? `Welcome, ${profile.legal_business_name || profile.business_name}`
                            : "Welcome to Clover Books"}
                    </p>
                </div>

                {!readiness.required_fields_complete && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
                        Complete required onboarding fields first. Missing:
                        {" "}
                        {contextUnknowns.slice(0, 5).join(", ")}
                        {contextUnknowns.length > 5 ? ` (+${contextUnknowns.length - 5} more)` : ""}
                    </div>
                )}

                <button
                    onClick={handleFinish}
                    className="w-full max-w-xs mx-auto onboarding-btn-primary group bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600"
                    style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                >
                    Go to Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// Step Router
// =============================================================================

const StepRouter: React.FC = () => {
    const { currentStep, loading, fastPath } = useOnboarding();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse text-slate-400">Loading...</div>
            </div>
        );
    }

    const steps = fastPath ? FAST_PATH_STEPS : GUIDED_PATH_STEPS;
    const currentIndex = steps.indexOf(currentStep);
    const progress = currentIndex >= 0 ? ((currentIndex) / (steps.length - 1)) * 100 : 0;

    const renderStep = () => {
        switch (currentStep) {
            case "welcome": return <WelcomeStep />;
            case "intent": return <IntentStep />;
            case "business_basics": return <BusinessBasicsStep />;
            case "industry": return <IndustryStep />;
            case "entity": return <EntityStep />;
            case "fiscal_pulse": return <FiscalPulseStep />;
            // New enhanced AI context steps
            case "team_size": return <TeamSizeStep />;
            case "business_age": return <BusinessAgeStep />;
            case "challenges": return <ChallengesStep />;
            case "current_tools": return <CurrentToolsStep />;
            case "transaction_volume": return <TransactionVolumeStep />;
            case "accounting_habits": return <AccountingHabitsStep />;
            case "data_source": return <DataSourceStep />;
            case "professional_profile": return <ProfessionalProfileStep />;
            case "ai_handshake": return <AIHandshakeStep />;
            case "done": return <DoneStep />;
            default: return <WelcomeStep />;
        }
    };

    return (
        <div className="onboarding-page onboarding-root">
            {/* Animated progress bar */}
            {currentStep !== "welcome" && currentStep !== "done" && (
                <div className="onboarding-progress">
                    <div
                        className="onboarding-progress-bar"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            <div className="onboarding-step-container">
                {renderStep()}
            </div>

            {/* Save indicator */}
            <SaveIndicator />
        </div>
    );
};

const SaveIndicator: React.FC = () => {
    const { syncStatus, error, resetError, retrySync } = useOnboarding();

    if (syncStatus === "synced" && !error) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {syncStatus === "syncing" && (
                <div className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                </div>
            )}
            {syncStatus === "offline" && !error && (
                <button
                    onClick={retrySync}
                    className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm text-white shadow-lg hover:bg-amber-600"
                >
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Offline — tap to retry
                </button>
            )}
            {syncStatus === "synced" && (
                <div className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm text-white shadow-lg">
                    <div className="w-2 h-2 rounded-full bg-white" />
                    Saved ✓
                </div>
            )}
            {error && (
                <button
                    onClick={resetError}
                    className="flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm text-white shadow-lg hover:bg-rose-600"
                >
                    {error} — tap to dismiss
                </button>
            )}
        </div>
    );
};


// =============================================================================
// Main Page Component
// =============================================================================

const OnboardingPage: React.FC = () => {
    return (
        <OnboardingProvider>
            <StepRouter />
        </OnboardingProvider>
    );
};

export default OnboardingPage;

