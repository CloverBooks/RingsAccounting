import { useCallback, useEffect, useState } from "react";
import { buildApiUrl } from "../api/client";
import {
  deriveOnboardingReadiness,
  normalizeReadinessPayload,
  OnboardingProfileV2,
  OnboardingReadiness,
} from "./readiness";

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

export function useOnboardingReadiness(): ReadinessSnapshot {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("not_started");
  const [unknowns, setUnknowns] = useState<string[]>(emptyReadiness.missing_required_fields);
  const [readiness, setReadiness] = useState<OnboardingReadiness>(emptyReadiness);
  const [hasProfile, setHasProfile] = useState(false);

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
    void refresh();
  }, [refresh]);

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
