import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl } from "../api/client";
import {
  buildInitialHandshakeRules,
  deriveOnboardingReadiness,
  normalizeReadinessPayload,
  OnboardingProfileV2,
  OnboardingReadiness,
  REQUIRED_CONSENTS,
} from "./readiness";

export type OnboardingStep =
  | "welcome"
  | "intent"
  | "business_basics"
  | "industry"
  | "entity"
  | "fiscal_pulse"
  | "team_size"
  | "business_age"
  | "challenges"
  | "current_tools"
  | "transaction_volume"
  | "accounting_habits"
  | "data_source"
  | "professional_profile"
  | "ai_handshake"
  | "done";

export type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "ready_for_companion"
  | "completed"
  | "skipped";

export type SyncStatus = "synced" | "syncing" | "offline" | "error";

export interface OnboardingState {
  profile: OnboardingProfileV2;
  currentStep: OnboardingStep;
  status: OnboardingStatus;
  fastPath: boolean;
  loading: boolean;
  syncStatus: SyncStatus;
  error: string | null;
  serverUpdatedAt: string | null;
  readiness: OnboardingReadiness;
  contextUnknowns: string[];
}

export interface OnboardingContextType extends OnboardingState {
  updateProfile: (partial: Partial<OnboardingProfileV2>) => Promise<void>;
  updateField: <K extends keyof OnboardingProfileV2>(key: K, value: OnboardingProfileV2[K]) => void;
  setStep: (step: OnboardingStep) => void;
  skipStep: () => void;
  completeOnboarding: () => Promise<void>;
  logEvent: (eventName: string, properties?: Record<string, unknown>, clientEventId?: string) => void;
  setFastPath: (fast: boolean) => void;
  resetError: () => void;
  retrySync: () => void;
}

const FAST_PATH_STEPS: OnboardingStep[] = [
  "welcome",
  "intent",
  "business_basics",
  "industry",
  "team_size",
  "professional_profile",
  "ai_handshake",
  "done",
];

const GUIDED_PATH_STEPS: OnboardingStep[] = [
  "welcome",
  "intent",
  "business_basics",
  "industry",
  "entity",
  "fiscal_pulse",
  "team_size",
  "business_age",
  "challenges",
  "current_tools",
  "transaction_volume",
  "accounting_habits",
  "data_source",
  "professional_profile",
  "ai_handshake",
  "done",
];

const LOCAL_STORAGE_KEY = "clover_onboarding_state";
const RETRY_DELAYS = [1000, 2000, 4000, 8000];
const DEBOUNCE_MS = 500;

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const initialReadiness = deriveOnboardingReadiness({}, { onboardingStatus: "not_started" });

const defaultState: OnboardingState = {
  profile: {},
  currentStep: "welcome",
  status: "not_started",
  fastPath: true,
  loading: true,
  syncStatus: "synced",
  error: null,
  serverUpdatedAt: null,
  readiness: initialReadiness,
  contextUnknowns: initialReadiness.missing_required_fields,
};

function normalizeStatus(status?: string | null): OnboardingStatus {
  if (status === "completed") return "completed";
  if (status === "ready_for_companion") return "ready_for_companion";
  if (status === "in_progress") return "in_progress";
  if (status === "skipped") return "skipped";
  return "not_started";
}

function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function postJson(path: string, body: unknown): Promise<any> {
  const res = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
};

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OnboardingState>(defaultState);

  const retryCount = useRef(0);
  const pendingFieldSync = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSync = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyReadiness = useCallback(
    (
      profile: OnboardingProfileV2,
      onboardingStatus: OnboardingStatus,
      responseReadiness?: any,
      responseUnknowns?: unknown,
    ) => {
      const fallback = deriveOnboardingReadiness(profile, {
        onboardingStatus,
        grantedConsents: state.readiness.consents_complete ? REQUIRED_CONSENTS : [],
        aiHandshakeComplete: state.readiness.ai_handshake_complete,
      });
      const readiness = normalizeReadinessPayload(responseReadiness, fallback);
      const contextUnknowns = Array.isArray(responseUnknowns)
        ? responseUnknowns.map(String)
        : readiness.missing_required_fields;
      return { readiness, contextUnknowns };
    },
    [state.readiness.ai_handshake_complete, state.readiness.consents_complete],
  );

  const saveToServer = useCallback(
    async (
      profile: OnboardingProfileV2,
      step: OnboardingStep,
      status: OnboardingStatus,
      fastPath: boolean,
      isRetry = false,
    ): Promise<boolean> => {
      if (!isRetry) {
        setState((prev) => ({ ...prev, syncStatus: "syncing" }));
        retryCount.current = 0;
      }

      try {
        const res = await fetch(buildApiUrl("/api/onboarding/profile"), {
          method: "PUT",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
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

        setState((prev) => {
          const { readiness, contextUnknowns } = applyReadiness(
            profile,
            status,
            data.readiness,
            data?.context?.unknowns,
          );
          return {
            ...prev,
            syncStatus: "synced",
            error: null,
            serverUpdatedAt: data.updated_at || prev.serverUpdatedAt,
            readiness,
            contextUnknowns,
          };
        });
        retryCount.current = 0;
        return true;
      } catch {
        const shouldRetry = retryCount.current < RETRY_DELAYS.length;
        if (shouldRetry) {
          setState((prev) => ({ ...prev, syncStatus: "offline" }));
          const delay = RETRY_DELAYS[retryCount.current];
          retryCount.current += 1;

          if (pendingSync.current) clearTimeout(pendingSync.current);
          pendingSync.current = setTimeout(() => {
            void saveToServer(profile, step, status, fastPath, true);
          }, delay);
          return false;
        }

        setState((prev) => ({
          ...prev,
          syncStatus: "error",
          error: "Unable to save. Your changes are safe locally.",
        }));
        return false;
      }
    },
    [applyReadiness],
  );

  useEffect(() => {
    const loadProfile = async () => {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      let localState: Partial<OnboardingState> = {};
      if (local) {
        try {
          localState = JSON.parse(local);
        } catch {
          localState = {};
        }
      }

      try {
        const res = await fetch(buildApiUrl("/api/onboarding/profile"), {
          headers: getAuthHeaders(),
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.ok && data.profile) {
          const profile = (data.profile.data || {}) as OnboardingProfileV2;
          const status = normalizeStatus(data.profile.onboarding_status);
          const fallback = deriveOnboardingReadiness(profile, {
            onboardingStatus: status,
          });
          const readiness = normalizeReadinessPayload(data.readiness, fallback);
          const contextUnknowns = Array.isArray(data?.context?.unknowns)
            ? data.context.unknowns.map(String)
            : readiness.missing_required_fields;

          setState({
            profile,
            currentStep: (data.profile.current_step || localState.currentStep || "welcome") as OnboardingStep,
            status,
            fastPath: data.profile.fast_path ?? true,
            loading: false,
            syncStatus: "synced",
            error: null,
            serverUpdatedAt: data.profile.updated_at || null,
            readiness,
            contextUnknowns,
          });
        } else {
          const profile = (localState.profile || {}) as OnboardingProfileV2;
          const status = normalizeStatus(localState.status || "not_started");
          const readiness = deriveOnboardingReadiness(profile, {
            onboardingStatus: status,
          });
          setState((prev) => ({
            ...prev,
            ...localState,
            profile,
            status,
            readiness,
            contextUnknowns: readiness.missing_required_fields,
            loading: false,
            syncStatus: "synced",
          }));
        }
      } catch {
        const profile = (localState.profile || {}) as OnboardingProfileV2;
        const status = normalizeStatus(localState.status || "not_started");
        const readiness = deriveOnboardingReadiness(profile, {
          onboardingStatus: status,
        });
        setState((prev) => ({
          ...prev,
          ...localState,
          profile,
          status,
          readiness,
          contextUnknowns: readiness.missing_required_fields,
          loading: false,
          syncStatus: "offline",
          error: null,
        }));
      }
    };

    void loadProfile();
  }, []);

  useEffect(() => {
    if (state.loading) return;
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        profile: state.profile,
        currentStep: state.currentStep,
        status: state.status,
        fastPath: state.fastPath,
        readiness: state.readiness,
      }),
    );
  }, [state.profile, state.currentStep, state.status, state.fastPath, state.readiness, state.loading]);

  const logEventFn = useCallback(
    (eventName: string, properties?: Record<string, unknown>, clientEventId?: string) => {
      void fetch(buildApiUrl("/api/onboarding/event"), {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          event_name: eventName,
          properties: {
            ...properties,
            variant: state.fastPath ? "fast" : "guided",
          },
          client_event_id: clientEventId,
        }),
      }).catch(() => undefined);
    },
    [state.fastPath],
  );

  const updateProfile = useCallback(
    async (partial: Partial<OnboardingProfileV2>) => {
      const newProfile = { ...state.profile, ...partial };
      const readiness = deriveOnboardingReadiness(newProfile, {
        onboardingStatus: state.status,
        grantedConsents: state.readiness.consents_complete ? REQUIRED_CONSENTS : [],
        aiHandshakeComplete: state.readiness.ai_handshake_complete,
      });
      const nextStatus = normalizeStatus(readiness.status);
      setState((prev) => ({
        ...prev,
        profile: newProfile,
        status: nextStatus,
        readiness,
        contextUnknowns: readiness.missing_required_fields,
      }));
      await saveToServer(newProfile, state.currentStep, nextStatus, state.fastPath);
    },
    [saveToServer, state.currentStep, state.fastPath, state.profile, state.readiness, state.status],
  );

  const updateField = useCallback(
    <K extends keyof OnboardingProfileV2>(key: K, value: OnboardingProfileV2[K]) => {
      const newProfile = { ...state.profile, [key]: value };
      const readiness = deriveOnboardingReadiness(newProfile, {
        onboardingStatus: state.status,
        grantedConsents: state.readiness.consents_complete ? REQUIRED_CONSENTS : [],
        aiHandshakeComplete: state.readiness.ai_handshake_complete,
      });
      const nextStatus = normalizeStatus(readiness.status);
      setState((prev) => ({
        ...prev,
        profile: newProfile,
        status: nextStatus,
        readiness,
        contextUnknowns: readiness.missing_required_fields,
      }));

      if (pendingFieldSync.current) {
        clearTimeout(pendingFieldSync.current);
      }
      pendingFieldSync.current = setTimeout(() => {
        void saveToServer(newProfile, state.currentStep, nextStatus, state.fastPath);
      }, DEBOUNCE_MS);
    },
    [saveToServer, state.currentStep, state.fastPath, state.profile, state.readiness, state.status],
  );

  const steps = useMemo(() => (state.fastPath ? FAST_PATH_STEPS : GUIDED_PATH_STEPS), [state.fastPath]);

  const setStep = useCallback(
    (step: OnboardingStep) => {
      setState((prev) => ({ ...prev, currentStep: step }));
      void saveToServer(state.profile, step, state.status, state.fastPath);
    },
    [saveToServer, state.fastPath, state.profile, state.status],
  );

  const skipStep = useCallback(() => {
    const currentIndex = steps.indexOf(state.currentStep);
    const nextStep = steps[currentIndex + 1] || "done";
    const clientEventId = `skip_${state.currentStep}_${Date.now()}`;
    logEventFn("Onboarding_Step_Skipped", { skipped_step: state.currentStep }, clientEventId);
    setStep(nextStep);
  }, [logEventFn, setStep, state.currentStep, steps]);

  const completeOnboarding = useCallback(async () => {
    const variant = state.fastPath ? "fast" : "guided";
    const rules = buildInitialHandshakeRules(state.profile);
    let consentsComplete = state.readiness.consents_complete;
    let aiHandshakeComplete = state.readiness.ai_handshake_complete;

    try {
      for (const consentKey of REQUIRED_CONSENTS) {
        await postJson("/api/consents/grant", {
          consent_key: consentKey,
          metadata: { source: "onboarding_completion" },
        });
      }
      consentsComplete = true;

      if (rules.length > 0) {
        await postJson("/api/ai/handshake/confirm", { rules });
        aiHandshakeComplete = true;
      }

      const readiness = deriveOnboardingReadiness(state.profile, {
        onboardingStatus: "completed",
        grantedConsents: consentsComplete ? REQUIRED_CONSENTS : [],
        aiHandshakeComplete,
      });
      const finalStatus = normalizeStatus(readiness.status);

      setState((prev) => ({
        ...prev,
        status: finalStatus,
        currentStep: "done",
        readiness,
        contextUnknowns: readiness.missing_required_fields,
        error: null,
      }));
      await saveToServer(state.profile, "done", finalStatus, state.fastPath);
      logEventFn("Onboarding_Completed", { variant, readiness_status: finalStatus });
      if (finalStatus === "completed") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    } catch (error) {
      const readiness = deriveOnboardingReadiness(state.profile, {
        onboardingStatus: state.status,
        grantedConsents: consentsComplete ? REQUIRED_CONSENTS : [],
        aiHandshakeComplete,
      });
      const fallbackStatus = normalizeStatus(readiness.status);
      setState((prev) => ({
        ...prev,
        status: fallbackStatus,
        readiness,
        contextUnknowns: readiness.missing_required_fields,
        error: "Completion pending. Check connection and retry to finalize consent and AI setup.",
      }));
      await saveToServer(state.profile, state.currentStep, fallbackStatus, state.fastPath);
      throw error;
    }
  }, [logEventFn, saveToServer, state.currentStep, state.fastPath, state.profile, state.readiness, state.status]);

  const setFastPath = useCallback((fast: boolean) => {
    setState((prev) => ({ ...prev, fastPath: fast }));
  }, []);

  const resetError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const retrySync = useCallback(() => {
    void saveToServer(state.profile, state.currentStep, state.status, state.fastPath);
  }, [saveToServer, state.currentStep, state.fastPath, state.profile, state.status]);

  useEffect(() => {
    return () => {
      if (pendingSync.current) clearTimeout(pendingSync.current);
      if (pendingFieldSync.current) clearTimeout(pendingFieldSync.current);
    };
  }, []);

  const value: OnboardingContextType = useMemo(
    () => ({
      ...state,
      updateProfile,
      updateField,
      setStep,
      skipStep,
      completeOnboarding,
      logEvent: logEventFn,
      setFastPath,
      resetError,
      retrySync,
    }),
    [
      completeOnboarding,
      logEventFn,
      resetError,
      retrySync,
      setFastPath,
      setStep,
      skipStep,
      state,
      updateField,
      updateProfile,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export { FAST_PATH_STEPS, GUIDED_PATH_STEPS };
