import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { buildApiUrl } from "../api/client";

// =============================================================================
// Types
// =============================================================================

export type OnboardingStep =
    | "welcome"
    | "intent"
    | "business_basics"
    | "industry"
    | "entity"
    | "fiscal_pulse"
    | "data_source"
    | "ai_handshake"
    | "done";

export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "skipped";

export type SyncStatus = "synced" | "syncing" | "offline" | "error";

export interface OnboardingProfile {
    // Core fields (allowlist matches backend)
    business_name?: string;
    intent?: string;
    industry?: string;
    entity_type?: string;
    fiscal_year_end?: string;
    data_source?: string;
    employee_count?: string;
    annual_revenue_bracket?: string;
    tax_registration?: string;
    accounting_method?: string;
    // Inferred fields (provenance tracking)
    _inferred?: Record<string, { value: unknown; confidence: number; source: string }>;
}

export interface OnboardingState {
    profile: OnboardingProfile;
    currentStep: OnboardingStep;
    status: OnboardingStatus;
    fastPath: boolean;
    loading: boolean;
    syncStatus: SyncStatus;
    error: string | null;
    serverUpdatedAt: string | null;
}

export interface OnboardingContextType extends OnboardingState {
    updateProfile: (partial: Partial<OnboardingProfile>) => Promise<void>;
    setStep: (step: OnboardingStep) => void;
    skipStep: () => void;
    completeOnboarding: () => Promise<void>;
    logEvent: (eventName: string, properties?: Record<string, unknown>, clientEventId?: string) => void;
    setFastPath: (fast: boolean) => void;
    resetError: () => void;
    retrySync: () => void;
}

const FAST_PATH_STEPS: OnboardingStep[] = ["welcome", "intent", "business_basics", "industry", "done"];
const GUIDED_PATH_STEPS: OnboardingStep[] = [
    "welcome", "intent", "business_basics", "industry",
    "entity", "fiscal_pulse", "data_source", "ai_handshake", "done"
];

const LOCAL_STORAGE_KEY = "clover_onboarding_state";
const RETRY_DELAYS = [1000, 2000, 4000, 8000]; // Exponential backoff

// =============================================================================
// Context
// =============================================================================

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboarding = () => {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
    return ctx;
};

// =============================================================================
// Provider
// =============================================================================

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<OnboardingState>({
        profile: {},
        currentStep: "welcome",
        status: "not_started",
        fastPath: true,
        loading: true,
        syncStatus: "synced",
        error: null,
        serverUpdatedAt: null,
    });

    const retryCount = useRef(0);
    const pendingSync = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load from server + local storage on mount
    useEffect(() => {
        const loadProfile = async () => {
            // Try local storage first for immediate UI
            const local = localStorage.getItem(LOCAL_STORAGE_KEY);
            let localState: Partial<OnboardingState> = {};
            if (local) {
                try {
                    localState = JSON.parse(local);
                } catch { /* ignore */ }
            }

            // Fetch from server
            try {
                const token = localStorage.getItem("auth_token");
                const res = await fetch(buildApiUrl("/api/onboarding/profile"), {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    credentials: "include",
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const data = await res.json();

                if (data.ok && data.profile) {
                    const serverUpdatedAt = data.profile.updated_at || null;

                    // Server wins if it has data (cross-device resume)
                    setState({
                        profile: data.profile.data || {},
                        currentStep: data.profile.current_step || localState.currentStep || "welcome",
                        status: data.profile.onboarding_status || "not_started",
                        fastPath: data.profile.fast_path ?? true,
                        loading: false,
                        syncStatus: "synced",
                        error: null,
                        serverUpdatedAt,
                    });
                } else {
                    // No server profile, use local or defaults
                    setState(prev => ({
                        ...prev,
                        ...localState,
                        loading: false,
                        syncStatus: "synced",
                    }));
                }
            } catch {
                // Fallback to local state with offline indicator
                setState(prev => ({
                    ...prev,
                    ...localState,
                    loading: false,
                    syncStatus: "offline",
                    error: null, // Don't show error on load, just offline
                }));
            }
        };

        loadProfile();
    }, []);

    // Persist to local storage on changes (always, for offline support)
    useEffect(() => {
        if (!state.loading) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
                profile: state.profile,
                currentStep: state.currentStep,
                status: state.status,
                fastPath: state.fastPath,
            }));
        }
    }, [state.profile, state.currentStep, state.status, state.fastPath, state.loading]);

    const saveToServer = useCallback(async (
        profile: OnboardingProfile,
        step: OnboardingStep,
        status: OnboardingStatus,
        fastPath: boolean,
        isRetry = false
    ): Promise<boolean> => {
        if (!isRetry) {
            setState(prev => ({ ...prev, syncStatus: "syncing" }));
            retryCount.current = 0;
        }

        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch(buildApiUrl("/api/onboarding/profile"), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: "include",
                body: JSON.stringify({
                    profile,
                    current_step: step,
                    onboarding_status: status,
                    fast_path: fastPath,
                }),
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            if (!data.ok) {
                throw new Error(data.error_code || "Unknown error");
            }

            setState(prev => ({
                ...prev,
                syncStatus: "synced",
                error: null,
                serverUpdatedAt: data.updated_at || prev.serverUpdatedAt,
            }));
            retryCount.current = 0;
            return true;
        } catch (e) {
            const shouldRetry = retryCount.current < RETRY_DELAYS.length;

            if (shouldRetry) {
                setState(prev => ({ ...prev, syncStatus: "offline" }));
                const delay = RETRY_DELAYS[retryCount.current];
                retryCount.current += 1;

                // Schedule retry
                if (pendingSync.current) clearTimeout(pendingSync.current);
                pendingSync.current = setTimeout(() => {
                    saveToServer(profile, step, status, fastPath, true);
                }, delay);
                return false;
            } else {
                setState(prev => ({
                    ...prev,
                    syncStatus: "error",
                    error: "Unable to save. Your changes are safe locally.",
                }));
                return false;
            }
        }
    }, []);

    const updateProfile = useCallback(async (partial: Partial<OnboardingProfile>) => {
        const newProfile = { ...state.profile, ...partial };
        setState(prev => ({ ...prev, profile: newProfile, status: "in_progress" }));
        await saveToServer(newProfile, state.currentStep, "in_progress", state.fastPath);
    }, [state.profile, state.currentStep, state.fastPath, saveToServer]);

    const steps = useMemo(() => state.fastPath ? FAST_PATH_STEPS : GUIDED_PATH_STEPS, [state.fastPath]);

    const setStep = useCallback((step: OnboardingStep) => {
        setState(prev => ({ ...prev, currentStep: step }));
        saveToServer(state.profile, step, state.status, state.fastPath);
    }, [state.profile, state.status, state.fastPath, saveToServer]);

    const skipStep = useCallback(() => {
        const currentIndex = steps.indexOf(state.currentStep);
        const nextStep = steps[currentIndex + 1] || "done";
        const clientEventId = `skip_${state.currentStep}_${Date.now()}`;
        logEventFn("Onboarding_Step_Skipped", { skipped_step: state.currentStep }, clientEventId);
        setStep(nextStep as OnboardingStep);
    }, [state.currentStep, steps, setStep]);

    const completeOnboarding = useCallback(async () => {
        const variant = state.fastPath ? "fast" : "guided";
        setState(prev => ({ ...prev, status: "completed", currentStep: "done" }));
        await saveToServer(state.profile, "done", "completed", state.fastPath);
        logEventFn("Onboarding_Completed", { variant });
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }, [state.profile, state.fastPath, saveToServer]);

    const logEventFn = useCallback((
        eventName: string,
        properties?: Record<string, unknown>,
        clientEventId?: string
    ) => {
        const token = localStorage.getItem("auth_token");
        fetch(buildApiUrl("/api/onboarding/event"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: "include",
            body: JSON.stringify({
                event_name: eventName,
                properties: {
                    ...properties,
                    variant: state.fastPath ? "fast" : "guided",
                },
                client_event_id: clientEventId,
            }),
        }).catch(() => { /* silent - analytics are fire-and-forget */ });
    }, [state.fastPath]);

    const setFastPath = useCallback((fast: boolean) => {
        setState(prev => ({ ...prev, fastPath: fast }));
    }, []);

    const resetError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }));
    }, []);

    const retrySync = useCallback(() => {
        saveToServer(state.profile, state.currentStep, state.status, state.fastPath);
    }, [state.profile, state.currentStep, state.status, state.fastPath, saveToServer]);

    // Cleanup pending retries on unmount
    useEffect(() => {
        return () => {
            if (pendingSync.current) clearTimeout(pendingSync.current);
        };
    }, []);

    const value: OnboardingContextType = useMemo(() => ({
        ...state,
        updateProfile,
        setStep,
        skipStep,
        completeOnboarding,
        logEvent: logEventFn,
        setFastPath,
        resetError,
        retrySync,
    }), [state, updateProfile, setStep, skipStep, completeOnboarding, logEventFn, setFastPath, resetError, retrySync]);

    return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export { FAST_PATH_STEPS, GUIDED_PATH_STEPS };
