import { useCallback, useEffect, useState } from "react";
import { buildApiUrl } from "../api/client";
import {
  deriveOnboardingReadiness,
  normalizeReadinessPayload,
  OnboardingProfileV2,
  OnboardingReadiness,
} from "./readiness";

export type OnboardingReadinessSeed = {
  status: string;
  score: number;
  unknowns: string[];
  hasProfile: boolean;
};

type ReadinessSnapshot = {
  loading: boolean;
  error: string | null;
  status: string;
  unknowns: string[];
  readiness: OnboardingReadiness;
  hasProfile: boolean;
  refresh: () => Promise<void>;
};

const emptyReadiness = deriveOnboardingReadiness({}, { onboardingStatus: "not_started" });

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function readinessFromSeed(seed: OnboardingReadinessSeed): OnboardingReadiness {
  return {
    ...emptyReadiness,
    status:
      seed.status === "in_progress" ||
      seed.status === "ready_for_companion" ||
      seed.status === "completed"
        ? seed.status
        : "not_started",
    score: Math.max(0, Math.min(100, Math.round(seed.score))),
    missing_required_fields: seed.unknowns,
    required_fields_complete: seed.unknowns.length === 0,
  };
}

export function useOnboardingReadiness(
  options?: {
    enabled?: boolean;
    initialSnapshot?: OnboardingReadinessSeed | null;
  },
): ReadinessSnapshot {
  const initialSnapshot = options?.initialSnapshot ?? null;
  const [loading, setLoading] = useState(!initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(initialSnapshot?.status || "not_started");
  const [unknowns, setUnknowns] = useState<string[]>(initialSnapshot?.unknowns || emptyReadiness.missing_required_fields);
  const [readiness, setReadiness] = useState<OnboardingReadiness>(
    initialSnapshot ? readinessFromSeed(initialSnapshot) : emptyReadiness,
  );
  const [hasProfile, setHasProfile] = useState(Boolean(initialSnapshot?.hasProfile));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl("/api/onboarding/profile"), {
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Failed to fetch onboarding profile (${res.status})`);
      }

      const profile = ((data?.profile?.data || {}) as OnboardingProfileV2) || {};
      const serverStatus = String(data?.profile?.onboarding_status || "not_started");
      const fallback = deriveOnboardingReadiness(profile, { onboardingStatus: serverStatus });
      const nextReadiness = normalizeReadinessPayload(data?.readiness, fallback);
      const nextUnknowns = Array.isArray(data?.context?.unknowns)
        ? data.context.unknowns.map(String)
        : nextReadiness.missing_required_fields;

      setStatus(nextReadiness.status);
      setUnknowns(nextUnknowns);
      setReadiness(nextReadiness);
      setHasProfile(Boolean(data?.profile));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load onboarding readiness.";
      setError(message);
      setStatus("not_started");
      setUnknowns(emptyReadiness.missing_required_fields);
      setReadiness(emptyReadiness);
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSnapshot) {
      setStatus(initialSnapshot.status);
      setUnknowns(initialSnapshot.unknowns);
      setReadiness(readinessFromSeed(initialSnapshot));
      setHasProfile(Boolean(initialSnapshot.hasProfile));
      setLoading(false);
    }
  }, [initialSnapshot]);

  useEffect(() => {
    if (options?.enabled === false) {
      return;
    }
    void refresh();
  }, [options?.enabled, refresh]);

  return {
    loading,
    error,
    status,
    unknowns,
    readiness,
    hasProfile,
    refresh,
  };
}

export default useOnboardingReadiness;
