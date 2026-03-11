import React, { useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import AppLink from "../routing/AppLink";
import {
  useOnboardingReadiness,
  type OnboardingReadinessSeed,
} from "../onboarding/useOnboardingReadiness";

interface SetupCardsProps {
  onDismiss?: () => void;
  initialReadiness?: OnboardingReadinessSeed | null;
  bootstrapPending?: boolean;
}

function headline(status: string): string {
  if (status === "ready_for_companion") return "Finalize Companion activation";
  if (status === "in_progress") return "Continue your setup";
  return "Complete your setup";
}

function body(status: string, unknownCount: number): string {
  if (status === "ready_for_companion") {
    return "Your profile is complete. Finish consent and AI handshake to unlock advanced Companion modes.";
  }
  if (unknownCount > 0) {
    return `${unknownCount} required setup field${unknownCount === 1 ? "" : "s"} remaining before go-live.`;
  }
  return "Tell us about your business so Companion can use accurate context.";
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const storage = window.localStorage as Storage;
  if (typeof storage.getItem !== "function") return null;
  if (typeof storage.setItem !== "function") return null;
  return storage;
}

export const SetupCards: React.FC<SetupCardsProps> = ({
  onDismiss,
  initialReadiness = null,
  bootstrapPending = false,
}) => {
  const storage = getStorage();
  const [dismissed, setDismissed] = useState(Boolean(storage?.getItem("setup_cards_dismissed")));
  const { loading, readiness, unknowns } = useOnboardingReadiness({
    enabled: !initialReadiness && !bootstrapPending,
    initialSnapshot: initialReadiness,
  });

  const status = readiness.status;
  const shouldHide = loading || dismissed || status === "completed";
  if (shouldHide) return null;

  const handleDismiss = () => {
    setDismissed(true);
    storage?.setItem("setup_cards_dismissed", "true");
    onDismiss?.();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center shadow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">{headline(status)}</h3>
            <p className="text-sm text-slate-600">{body(status, unknowns.length)}</p>
            <div className="mt-2 flex items-center gap-3">
              <AppLink
                href="/onboarding"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                {status === "ready_for_companion" ? "Finish setup" : "Continue"}
                <ArrowRight className="w-4 h-4" />
              </AppLink>
              <span className="text-xs text-slate-500">
                Readiness: <span className="font-semibold">{readiness.score}%</span>
              </span>
            </div>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 p-1" title="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SetupCards;
